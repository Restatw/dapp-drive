import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useIpfsStore } from './ipfs'

const SESSION_KEY = 'dapp-drive:session'
const SESSION_TTL = 24 * 60 * 60 * 1000 // 24 h

const PROXY_URL   = import.meta.env.VITE_PROXY_URL  ?? ''  // e.g. https://your-domain.com
const USE_PROXY   = import.meta.env.VITE_USE_PROXY === 'true'

// ── EIP-4361 SIWE message ─────────────────────────────────────────
function buildSiweMessage({ address, domain, uri, nonce, issuedAt, expirationTime }) {
  return [
    `${domain} wants you to sign in with your Ethereum account:`,
    address, '',
    'Sign in to IPFS Drive', '',
    `URI: ${uri}`,
    `Version: 1`,
    `Chain ID: 1`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
    `Expiration Time: ${expirationTime}`,
  ].join('\n')
}

function randomNonce() {
  const arr = new Uint8Array(8)
  crypto.getRandomValues(arr)
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
}

function hexToU8(hex) {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex
  const out = new Uint8Array(h.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16)
  return out
}

// ── Deterministic ed25519 key derivation ─────────────────────────
// Signs a fixed message with MetaMask → uses first 32 bytes of sig as seed.
// Same ETH account → same signature → same ed25519 keypair → same IPNS ID
// on every machine.
async function deriveEd25519FromAddress(address) {
  const { ed25519 } = await import('@noble/curves/ed25519')

  const message   = `dapp-drive-ipfs-key:v1:${address.toLowerCase()}`
  const signature = await window.ethereum.request({
    method: 'personal_sign',
    params: [message, address],
  })
  // Signature is 65 bytes (r + s + v). Use first 32 bytes as the ed25519 seed.
  const sigBytes = hexToU8(signature)
  const seed     = sigBytes.slice(0, 32)
  const pubKey   = ed25519.getPublicKey(seed)

  // Build libp2p protobuf PrivateKey { Type=Ed25519(1), Data=seed‖pubKey }
  // Wire format: field1 varint, field2 length-delimited
  const keyProto = new Uint8Array([
    0x08, 0x01,        // field 1 (Type) = 1 (Ed25519)
    0x12, 0x40,        // field 2 (Data), 64 bytes
    ...seed,           // 32-byte private seed
    ...pubKey,         // 32-byte public key
  ])

  return keyProto
}

// ── Signature verification ────────────────────────────────────────
async function recoverSigner(message, signature) {
  const { ethers } = await import('ethers')
  return ethers.verifyMessage(message, signature)
}

// ── Store ─────────────────────────────────────────────────────────
export const useIdentityStore = defineStore('identity', () => {
  const address      = ref(null)
  const isAuth       = ref(false)
  const isConnecting = ref(false)
  const error        = ref(null)
  const ipnsKeyId    = ref(null)   // k51qzi5…  (same on every machine for same ETH key)

  const shortAddress = computed(() =>
    address.value ? address.value.slice(0, 6) + '…' + address.value.slice(-4) : null
  )
  const rootPath    = computed(() => address.value ? `/dapp-drive/${address.value}` : null)
  const pinsKey     = computed(() => address.value ? `dapp-drive:pins:${address.value}` : null)
  const ipnsKeyName = computed(() => address.value ? `dapp-drive-${address.value.toLowerCase()}` : null)

  // ── Session ────────────────────────────────────────────────────
  function restoreSession() {
    try {
      const { addr, expiry, ipns } = _loadRaw()
      if (!addr || Date.now() > expiry) { localStorage.removeItem(SESSION_KEY); return false }
      address.value   = addr
      isAuth.value    = true
      ipnsKeyId.value = ipns || null
      return true
    } catch { return false }
  }

  function _saveSession(jwt = null) {
    const existing = _loadRaw()
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      addr:   address.value,
      expiry: Date.now() + SESSION_TTL,
      ipns:   ipnsKeyId.value,
      // Preserve existing JWT unless a new one is explicitly provided
      jwt:    jwt ?? existing?.jwt ?? null,
    }))
  }

  function _loadRaw() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) ?? '{}') } catch { return {} }
  }

  // Exchange the SIWE proof for a proxy JWT (called after connect(), only when proxy is enabled)
  async function _exchangeJwt(addr, message, signature) {
    if (!USE_PROXY || !PROXY_URL) return
    try {
      const resp = await fetch(`${PROXY_URL}/auth/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ address: addr, message, signature }),
      })
      if (!resp.ok) { console.warn('[identity] JWT exchange failed:', resp.status); return }
      const { token } = await resp.json()
      _saveSession(token)
    } catch (e) {
      console.warn('[identity] Could not reach proxy for JWT:', e.message)
    }
  }

  // ── IPFS key: ensure the deterministic key exists on this node ─
  async function ensureIpfsKey() {
    const ipfs = useIpfsStore()
    const name = ipnsKeyName.value
    if (!name) return

    // Check if already imported on this node
    const keys    = await ipfs.listKeys()
    const existing = keys.find(k => k.Name === name)
    if (existing) {
      ipnsKeyId.value = existing.Id
      _saveSession()
      return
    }

    // Derive from MetaMask and import (second MetaMask popup, first-time only per machine)
    try {
      const keyProto = await deriveEd25519FromAddress(address.value)
      const result   = await ipfs.importKey(name, keyProto)
      if (result?.Id) {
        ipnsKeyId.value = result.Id
        _saveSession()
      }
    } catch (e) {
      console.warn('IPFS key derivation failed:', e)
    }
  }

  // ── Connect (SIWE) ─────────────────────────────────────────────
  async function connect() {
    if (!window.ethereum) { error.value = 'MetaMask not detected'; return false }
    isConnecting.value = true
    error.value = null
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
      const addr     = accounts[0]

      // Build + sign SIWE message
      const domain         = window.location.host  || 'localhost'
      const uri            = window.location.origin || 'http://localhost'
      const nonce          = randomNonce()
      const issuedAt       = new Date().toISOString()
      const expirationTime = new Date(Date.now() + SESSION_TTL).toISOString()
      const message        = buildSiweMessage({ address: addr, domain, uri, nonce, issuedAt, expirationTime })

      const signature = await window.ethereum.request({
        method: 'personal_sign',
        params: [message, addr],
      })

      // Verify
      const recovered = await recoverSigner(message, signature)
      if (recovered.toLowerCase() !== addr.toLowerCase()) throw new Error('Signature mismatch')

      address.value = addr
      isAuth.value  = true
      _saveSession()

      // Exchange SIWE proof for a proxy JWT (no-op when USE_PROXY=false)
      _exchangeJwt(addr, message, signature)

      // Derive + import IPFS key in background (may show second MetaMask popup first time)
      ensureIpfsKey()

      return true
    } catch (e) {
      error.value = e.code === 4001 ? 'Request rejected in MetaMask' : (e.message || 'Connection failed')
      return false
    } finally {
      isConnecting.value = false
    }
  }

  function signOut() {
    address.value   = null
    isAuth.value    = false
    ipnsKeyId.value = null
    localStorage.removeItem(SESSION_KEY)
    // JWT lives inside the session object so it's cleared above
  }

  function watchAccountChanges() {
    if (!window.ethereum) return
    window.ethereum.on('accountsChanged', accounts => {
      if (!accounts.length || accounts[0].toLowerCase() !== address.value?.toLowerCase()) signOut()
    })
  }

  return {
    address, shortAddress, rootPath, pinsKey, ipnsKeyId, ipnsKeyName,
    isAuth, isConnecting, error,
    connect, signOut, restoreSession, watchAccountChanges, ensureIpfsKey,
  }
})
