/**
 * Thin wrapper around IndexedDB (via `idb`) for caching directory listings.
 *
 * Schema:
 *   DB: dapp-drive-cache  v1
 *   Store: directories
 *     key:   "{address}:{relativePath}"   e.g. "0xABC:/photos"
 *     value: { address, path, entries, cachedAt }
 */

import { openDB } from 'idb'

const DB_NAME    = 'dapp-drive-cache'
const DB_VERSION = 1
const STORE      = 'directories'
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000  // keep cache entries up to 7 days

let _db = null

async function db() {
  if (_db) return _db
  _db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('by_address', 'address')
        store.createIndex('by_cachedAt', 'cachedAt')
      }
    },
  })
  return _db
}

function makeId(address, path) {
  return `${address.toLowerCase()}:${path}`
}

// Read a cached directory listing. Returns null if not found or expired.
export async function getCachedDir(address, path) {
  try {
    const d   = await db()
    const row = await d.get(STORE, makeId(address, path))
    if (!row) return null
    if (Date.now() - row.cachedAt > MAX_AGE_MS) return null
    return row
  } catch { return null }
}

// Write (or overwrite) a directory listing to the cache.
export async function setCachedDir(address, path, entries) {
  try {
    const d = await db()
    await d.put(STORE, {
      id:       makeId(address, path),
      address:  address.toLowerCase(),
      path,
      entries,
      cachedAt: Date.now(),
    })
  } catch (e) {
    console.warn('[dirCache] write failed:', e)
  }
}

// Remove a single cached path (call after rename / delete so stale data isn't shown).
export async function invalidateCachedDir(address, path) {
  try {
    const d = await db()
    await d.delete(STORE, makeId(address, path))
  } catch {}
}

// Wipe all cached entries for one identity (called on sign-out).
export async function clearCacheForAddress(address) {
  try {
    const d     = await db()
    const index = d.transaction(STORE, 'readwrite').store.index('by_address')
    let cursor  = await index.openCursor(IDBKeyRange.only(address.toLowerCase()))
    while (cursor) {
      await cursor.delete()
      cursor = await cursor.continue()
    }
  } catch {}
}
