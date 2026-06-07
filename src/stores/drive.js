import { defineStore } from 'pinia'
import { ref, computed, reactive } from 'vue'
import { useIpfsStore } from './ipfs'
import { useIdentityStore } from './identity'

function toMfsPath(identity, relativePath) {
  const root = identity.rootPath
  return relativePath === '/' ? root : root + relativePath
}

function joinRelative(base, name) {
  return base === '/' ? '/' + name : base + '/' + name
}

function loadPins(identity) {
  if (!identity.pinsKey) return []
  try { return JSON.parse(localStorage.getItem(identity.pinsKey) || '[]') } catch { return [] }
}

export const useDriveStore = defineStore('drive', () => {
  const ipfs     = useIpfsStore()
  const identity = useIdentityStore()

  const currentPath   = ref('/')
  const entries       = ref([])
  const loading       = ref(false)
  const viewMode      = ref('grid')
  const selected      = ref(new Set())
  const uploads       = ref([])
  const searchQuery   = ref('')
  const error         = ref(null)
  const pinnedFolders = ref([])

  // ── Sync state ────────────────────────────────────────────────
  const syncState        = ref('idle')   // 'idle' | 'publishing' | 'checking' | 'syncing' | 'error'
  const lastPublishedAt  = ref(null)     // timestamp
  const remoteUpdateAvailable = ref(false)
  const remoteCidPending = ref(null)     // CID waiting to be applied

  // ── Pins ──────────────────────────────────────────────────────
  function _savePins() {
    if (identity.pinsKey) localStorage.setItem(identity.pinsKey, JSON.stringify(pinnedFolders.value))
  }

  // ── Computed ──────────────────────────────────────────────────
  const breadcrumbs = computed(() => {
    const parts = currentPath.value.split('/').filter(Boolean)
    const crumbs = [{ name: 'My Drive', path: '/' }]
    let acc = ''
    for (const p of parts) { acc += '/' + p; crumbs.push({ name: p, path: acc }) }
    return crumbs
  })

  const filteredEntries = computed(() => {
    if (!searchQuery.value.trim()) return entries.value
    const q = searchQuery.value.toLowerCase()
    return entries.value.filter(e => e.Name.toLowerCase().includes(q))
  })

  // ── Navigation ────────────────────────────────────────────────
  async function navigate(path) {
    pinnedFolders.value = loadPins(identity)
    currentPath.value   = path
    selected.value      = new Set()
    searchQuery.value   = ''
    await refresh()
  }

  async function refresh() {
    loading.value = true
    error.value   = null
    try {
      await ipfs.mkdir(identity.rootPath)   // ensure identity root exists
      entries.value = await ipfs.listFiles(toMfsPath(identity, currentPath.value))
    } catch {
      error.value   = 'Failed to load directory'
      entries.value = []
    } finally {
      loading.value = false
    }
  }

  // ── CRUD (all schedule a publish after writing) ───────────────
  async function createFolder(name) {
    const ok = await ipfs.mkdir(toMfsPath(identity, joinRelative(currentPath.value, name)))
    if (ok) { await refresh(); schedulePublish() }
    return ok
  }

  async function uploadFiles(files) {
    for (const file of files) {
      const upload = reactive({ name: file.name, progress: 0, done: false, error: null })
      uploads.value.push(upload)
      try {
        const dest = toMfsPath(identity, joinRelative(currentPath.value, file.name))
        await ipfs.writeFile(dest, file, p => { upload.progress = p })
        upload.progress = 100
        upload.done = true
      } catch (e) {
        upload.error = e.message || 'Upload failed'
      }
    }
    await refresh()
    await ipfs.fetchRepoStat()
    schedulePublish()
    setTimeout(() => { uploads.value = uploads.value.filter(u => !u.done) }, 2500)
  }

  async function deleteEntry(entry) {
    const ok = await ipfs.rm(toMfsPath(identity, joinRelative(currentPath.value, entry.Name)))
    if (ok) { entries.value = entries.value.filter(e => e.Name !== entry.Name); schedulePublish() }
    return ok
  }

  async function renameEntry(entry, newName) {
    const ok = await ipfs.mv(
      toMfsPath(identity, joinRelative(currentPath.value, entry.Name)),
      toMfsPath(identity, joinRelative(currentPath.value, newName))
    )
    if (ok) { await refresh(); schedulePublish() }
    return ok
  }

  // ── Selection ─────────────────────────────────────────────────
  function toggleSelect(name) {
    const s = new Set(selected.value)
    s.has(name) ? s.delete(name) : s.add(name)
    selected.value = s
  }
  function selectAll()     { selected.value = new Set(entries.value.map(e => e.Name)) }
  function clearSelection() { selected.value = new Set() }

  // ── Bulk ops ──────────────────────────────────────────────────
  async function deleteSelected() {
    await Promise.all([...selected.value].map(n => ipfs.rm(toMfsPath(identity, joinRelative(currentPath.value, n)))))
    selected.value = new Set()
    await refresh()
    schedulePublish()
  }

  async function moveSelected(destRelativePath) {
    await Promise.all(
      [...selected.value].map(n =>
        ipfs.mv(toMfsPath(identity, joinRelative(currentPath.value, n)),
                toMfsPath(identity, joinRelative(destRelativePath, n)))
      )
    )
    selected.value = new Set()
    await refresh()
    schedulePublish()
  }

  // ── Pinned folders ────────────────────────────────────────────
  function pinFolder(rel, name) {
    if (pinnedFolders.value.some(p => p.path === rel)) return
    pinnedFolders.value = [...pinnedFolders.value, { name, path: rel }]
    _savePins()
  }
  function unpinFolder(rel) {
    pinnedFolders.value = pinnedFolders.value.filter(p => p.path !== rel)
    _savePins()
  }
  function isPinned(rel) { return pinnedFolders.value.some(p => p.path === rel) }

  async function statEntry(relativePath) {
    return ipfs.stat(toMfsPath(identity, relativePath))
  }

  // ── IPNS publish (debounced) ──────────────────────────────────
  let _publishTimer = null

  function schedulePublish() {
    clearTimeout(_publishTimer)
    _publishTimer = setTimeout(publishDrive, 3000)
  }

  async function publishDrive() {
    if (!identity.ipnsKeyName || !identity.ipnsKeyId) return
    syncState.value = 'publishing'
    try {
      const cid = await ipfs.statHash(identity.rootPath)
      if (cid) {
        await ipfs.publishIPNS(cid, identity.ipnsKeyName)
        lastPublishedAt.value = Date.now()
      }
    } catch (e) {
      console.warn('IPNS publish failed:', e)
    } finally {
      syncState.value = 'idle'
    }
  }

  // ── IPNS sync check (runs in background on login) ─────────────
  async function checkRemoteSync() {
    if (!identity.ipnsKeyId) return
    syncState.value = 'checking'
    try {
      const remoteCid = await ipfs.resolveIPNS(identity.ipnsKeyId)
      if (!remoteCid) { syncState.value = 'idle'; return }

      const localCid = await ipfs.statHash(identity.rootPath)
      if (localCid === remoteCid) { syncState.value = 'idle'; return }

      // Remote differs from local → notify user
      remoteCidPending.value      = remoteCid
      remoteUpdateAvailable.value = true
    } catch (e) {
      console.warn('IPNS resolve failed:', e)
    } finally {
      syncState.value = 'idle'
    }
  }

  // Apply pending remote update
  async function applySyncFromRemote() {
    const cid = remoteCidPending.value
    if (!cid) return
    syncState.value = 'syncing'
    try {
      // Remove current local tree, copy remote CID into its place
      await ipfs.rm(identity.rootPath)
      await ipfs.filesCp(cid, identity.rootPath)
      remoteUpdateAvailable.value = false
      remoteCidPending.value      = null
      lastPublishedAt.value       = Date.now()
      await navigate('/')          // reload from new tree
    } catch (e) {
      syncState.value = 'error'
      console.error('Sync failed:', e)
    } finally {
      if (syncState.value !== 'error') syncState.value = 'idle'
    }
  }

  function dismissRemoteUpdate() {
    remoteUpdateAvailable.value = false
    remoteCidPending.value      = null
  }

  return {
    currentPath, entries, loading, viewMode, selected, uploads, searchQuery, error,
    pinnedFolders,
    syncState, lastPublishedAt, remoteUpdateAvailable, remoteCidPending,
    breadcrumbs, filteredEntries,
    navigate, refresh, createFolder, uploadFiles,
    deleteEntry, renameEntry,
    deleteSelected, moveSelected,
    toggleSelect, selectAll, clearSelection,
    pinFolder, unpinFolder, isPinned,
    statEntry,
    schedulePublish, publishDrive, checkRemoteSync, applySyncFromRemote, dismissRemoteUpdate,
  }
})
