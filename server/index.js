/**
 * IPFS Drive — Backend Proxy
 *
 * Sits between the browser DApp and the local IPFS API node.
 * Every request must carry a valid JWT obtained via SIWE (/auth/login).
 *
 * Environment variables (copy server/.env.example → server/.env):
 *   PORT              default 3000
 *   HOST              default 0.0.0.0
 *   IPFS_API          default http://127.0.0.1:5001
 *   ALLOWED_ORIGINS   comma-separated, e.g. https://k51…ipns.inbrowser.link
 *   MAX_FILE_BYTES    default 104857600   (100 MB)
 *   MAX_USER_BYTES    default 5368709120  (5 GB)
 */

import Fastify           from 'fastify'
import cors              from '@fastify/cors'
import Database          from 'better-sqlite3'
import { SignJWT, jwtVerify } from 'jose'
import { ethers }        from 'ethers'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

// ── Config ────────────────────────────────────────────────────────
const IPFS_API        = process.env.IPFS_API       ?? 'http://127.0.0.1:5001'
const PORT            = parseInt(process.env.PORT  ?? '3000', 10)
const HOST            = process.env.HOST           ?? '0.0.0.0'
const MAX_FILE_BYTES  = parseInt(process.env.MAX_FILE_BYTES ?? String(100  * 1024 * 1024),    10)
const MAX_USER_BYTES  = parseInt(process.env.MAX_USER_BYTES ?? String(5    * 1024 * 1024 * 1024), 10)
const TOKEN_TTL_SEC   = 24 * 60 * 60   // 24 h

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173')
  .split(',').map(s => s.trim()).filter(Boolean)

// ── JWT secret (auto-generated on first run, persisted to file) ───
const SECRET_FILE = new URL('./jwt-secret.key', import.meta.url).pathname
let JWT_SECRET
if (existsSync(SECRET_FILE)) {
  JWT_SECRET = new TextEncoder().encode(readFileSync(SECRET_FILE, 'utf8').trim())
} else {
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0')).join('')
  writeFileSync(SECRET_FILE, hex, 'utf8')
  JWT_SECRET = new TextEncoder().encode(hex)
  console.warn('[proxy] Generated jwt-secret.key — back it up so existing tokens stay valid after restarts.')
}

// ── SQLite quota store ────────────────────────────────────────────
const db = new Database(new URL('./quota.db', import.meta.url).pathname)
db.exec(`
  CREATE TABLE IF NOT EXISTS quota (
    address    TEXT    PRIMARY KEY,
    used_bytes INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  )
`)
const stmtGet      = db.prepare('SELECT used_bytes FROM quota WHERE address = ?')
const stmtUpsertAdd = db.prepare(`
  INSERT INTO quota (address, used_bytes, updated_at) VALUES (?, ?, unixepoch())
  ON CONFLICT(address) DO UPDATE
  SET used_bytes = used_bytes + excluded.used_bytes, updated_at = unixepoch()
`)
const stmtDeduct   = db.prepare(`
  UPDATE quota SET used_bytes = MAX(0, used_bytes - ?), updated_at = unixepoch()
  WHERE address = ?
`)

// ── Fastify setup ─────────────────────────────────────────────────
const app = Fastify({ logger: { level: 'info' } })

await app.register(cors, {
  origin:         ALLOWED_ORIGINS,
  methods:        ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials:    true,
})

// Disable automatic body parsing for proxy routes so we can stream the
// raw request body directly to IPFS without buffering it in memory.
// JSON parsing is kept for /auth/* routes only.
app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
  try { done(null, JSON.parse(body)) } catch (e) { done(e) }
})
app.addContentTypeParser(/.*/, (_req, _payload, done) => done(null))

// ── JWT helpers ───────────────────────────────────────────────────
async function signToken(address) {
  return new SignJWT({ sub: address.toLowerCase() })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_SEC}s`)
    .sign(JWT_SECRET)
}

async function verifyToken(token) {
  const { payload } = await jwtVerify(token, JWT_SECRET, { algorithms: ['HS256'] })
  return payload   // { sub: address, iat, exp }
}

// ── Auth preHandler ───────────────────────────────────────────────
async function requireAuth(req, reply) {
  const auth = req.headers['authorization'] ?? ''
  if (!auth.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'Authorization header missing' })
  }
  try {
    req.user = await verifyToken(auth.slice(7))
  } catch {
    return reply.code(401).send({ error: 'Invalid or expired token — please sign in again' })
  }
}

// ── POST /auth/login  (SIWE message + signature → JWT) ────────────
app.post('/auth/login', async (req, reply) => {
  const { address, message, signature } = req.body ?? {}
  if (!address || !message || !signature)
    return reply.code(400).send({ error: 'address, message, signature are required' })

  try {
    const recovered = ethers.verifyMessage(message, signature)
    if (recovered.toLowerCase() !== address.toLowerCase())
      return reply.code(401).send({ error: 'Signature does not match address' })
  } catch {
    return reply.code(401).send({ error: 'Could not verify signature' })
  }

  const token   = await signToken(address)
  const row     = stmtGet.get(address.toLowerCase())
  return {
    token,
    expiresIn:  TOKEN_TTL_SEC,
    usedBytes:  row?.used_bytes ?? 0,
    maxBytes:   MAX_USER_BYTES,
  }
})

// ── GET /auth/quota ───────────────────────────────────────────────
app.get('/auth/quota', { preHandler: requireAuth }, (req) => {
  const row = stmtGet.get(req.user.sub)
  return {
    usedBytes:    row?.used_bytes ?? 0,
    maxBytes:     MAX_USER_BYTES,
    maxFileBytes: MAX_FILE_BYTES,
  }
})

// ── Proxy helper ──────────────────────────────────────────────────
async function proxyToIpfs(req, reply) {
  const url = `${IPFS_API}${req.url}`

  // Build forwarded headers — drop authorization (JWT must not reach IPFS)
  const headers = {}
  for (const [k, v] of Object.entries(req.headers)) {
    if (k === 'host' || k === 'authorization') continue
    headers[k] = v
  }

  const isBodyless = req.method === 'GET' || req.method === 'HEAD'
  const resp = await fetch(url, {
    method:  req.method,
    headers,
    body:    isBodyless ? undefined : req.raw,
    duplex:  'half',
  })

  reply.code(resp.status)
  for (const [k, v] of resp.headers.entries()) {
    if (k === 'transfer-encoding' || k === 'connection') continue
    reply.header(k, v)
  }
  return resp.body
}

// ── POST /api/v0/files/write  (upload — enforce size + quota) ─────
app.post('/api/v0/files/write', { preHandler: requireAuth }, async (req, reply) => {
  const address       = req.user.sub
  const contentLength = parseInt(req.headers['content-length'] ?? '0', 10)

  if (contentLength > MAX_FILE_BYTES)
    return reply.code(413).send({
      error: `File too large. Maximum size is ${(MAX_FILE_BYTES / 1024 / 1024).toFixed(0)} MB.`
    })

  const row  = stmtGet.get(address)
  const used = row?.used_bytes ?? 0
  if (used + contentLength > MAX_USER_BYTES)
    return reply.code(507).send({
      error: `Storage quota exceeded. You have ${((MAX_USER_BYTES - used) / 1024 / 1024).toFixed(1)} MB remaining.`
    })

  const body = await proxyToIpfs(req, reply)

  if (reply.statusCode < 300 && contentLength > 0) {
    stmtUpsertAdd.run(address, contentLength)
  }

  return body
})

// ── POST /api/v0/files/rm  (delete — deduct quota) ────────────────
app.post('/api/v0/files/rm', { preHandler: requireAuth }, async (req, reply) => {
  const address = req.user.sub

  // Stat the path before deleting to know how many bytes to reclaim
  const statParams = new URL(`http://x${req.url}`).searchParams
  let size = 0
  try {
    const statResp = await fetch(
      `${IPFS_API}/api/v0/files/stat?${statParams}`,
      { method: 'POST' }
    )
    if (statResp.ok) size = (await statResp.json()).CumulativeSize ?? 0
  } catch {}

  const body = await proxyToIpfs(req, reply)

  if (reply.statusCode < 300 && size > 0) {
    stmtDeduct.run(size, address)
  }

  return body
})

// ── All other /api/v0/*  (auth required, transparent proxy) ───────
app.all('/api/v0/*', { preHandler: requireAuth }, (req, reply) => proxyToIpfs(req, reply))

// ── Health check (no auth) ────────────────────────────────────────
app.get('/health', async () => {
  try {
    const resp = await fetch(`${IPFS_API}/api/v0/id`, { method: 'POST' })
    const { ID } = await resp.json()
    return { status: 'ok', ipfsNode: ID }
  } catch {
    return { status: 'degraded', ipfsNode: null }
  }
})

// ── Start ─────────────────────────────────────────────────────────
await app.listen({ port: PORT, host: HOST })
console.log(`[proxy] Listening on http://${HOST}:${PORT}`)
console.log(`[proxy] Proxying IPFS at ${IPFS_API}`)
console.log(`[proxy] Allowed origins: ${ALLOWED_ORIGINS.join(', ')}`)
