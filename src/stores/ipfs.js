import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

const API_BASE = import.meta.env.VITE_IPFS_API ?? ''
const GW_BASE  = import.meta.env.VITE_IPFS_GW  ?? ''
const API = `${API_BASE}/api/v0`

export const useIpfsStore = defineStore('ipfs', () => {
  const connected     = ref(false)
  const nodeId        = ref('')
  const agentVersion  = ref('')
  const repoSize      = ref(0)
  const repoMaxSize   = ref(0)
  const checking      = ref(false)

  const storagePercent = computed(() => {
    if (!repoMaxSize.value) return 0
    return Math.min(100, Math.round((repoSize.value / repoMaxSize.value) * 100))
  })

  // ── Node ───────────────────────────────────────────────────────
  async function checkConnection() {
    checking.value = true
    try {
      const resp = await fetch(`${API}/id`, { method: 'POST' })
      if (!resp.ok) throw new Error('not ok')
      const data = await resp.json()
      nodeId.value       = data.ID
      agentVersion.value = data.AgentVersion
      connected.value    = true
      await fetchRepoStat()
    } catch {
      connected.value = false
    } finally {
      checking.value = false
    }
  }

  async function fetchRepoStat() {
    try {
      const resp = await fetch(`${API}/repo/stat`, { method: 'POST' })
      if (!resp.ok) return
      const data      = await resp.json()
      repoSize.value    = data.RepoSize    || 0
      repoMaxSize.value = data.StorageMax  || 0
    } catch {}
  }

  // ── MFS ────────────────────────────────────────────────────────
  async function listFiles(path = '/') {
    const resp = await fetch(`${API}/files/ls?arg=${encodeURIComponent(path)}&long=true`, { method: 'POST' })
    if (!resp.ok) return []
    const entries = (await resp.json()).Entries || []
    return entries.sort((a, b) =>
      a.Type !== b.Type ? b.Type - a.Type : a.Name.localeCompare(b.Name)
    )
  }

  async function mkdir(path) {
    return (await fetch(`${API}/files/mkdir?arg=${encodeURIComponent(path)}&parents=true`, { method: 'POST' })).ok
  }

  async function stat(path) {
    const resp = await fetch(`${API}/files/stat?arg=${encodeURIComponent(path)}`, { method: 'POST' })
    return resp.ok ? resp.json() : null
  }

  // Returns just the CID hash of an MFS path (fast)
  async function statHash(mfsPath) {
    const resp = await fetch(`${API}/files/stat?arg=${encodeURIComponent(mfsPath)}&hash=true`, { method: 'POST' })
    if (!resp.ok) return null
    return (await resp.json()).Hash || null
  }

  async function rm(path) {
    return (await fetch(`${API}/files/rm?arg=${encodeURIComponent(path)}&recursive=true&force=true`, { method: 'POST' })).ok
  }

  async function mv(from, to) {
    return (await fetch(`${API}/files/mv?arg=${encodeURIComponent(from)}&arg=${encodeURIComponent(to)}`, { method: 'POST' })).ok
  }

  // Copy an IPFS CID into an MFS path (used for sync)
  async function filesCp(cid, destMfsPath) {
    const params = new URLSearchParams([['arg', `/ipfs/${cid}`], ['arg', destMfsPath]])
    params.append('parents', 'true')
    return (await fetch(`${API}/files/cp?${params}`, { method: 'POST' })).ok
  }

  // XHR upload with progress tracking
  function writeFile(path, file, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      const url = `${API}/files/write?arg=${encodeURIComponent(path)}&create=true&parents=true&truncate=true`
      xhr.upload.onprogress = e => {
        if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100))
      }
      xhr.onload  = () => resolve(xhr.status < 400)
      xhr.onerror = () => reject(new Error('Upload failed'))
      const fd = new FormData()
      fd.append('file', file)
      xhr.open('POST', url)
      xhr.send(fd)
    })
  }

  // ── IPNS ───────────────────────────────────────────────────────
  // List all IPFS keys on this node
  async function listKeys() {
    const resp = await fetch(`${API}/key/list`, { method: 'POST' })
    if (!resp.ok) return []
    return (await resp.json()).Keys || []
  }

  // Import a raw ed25519 key (libp2p protobuf bytes) under a given name
  async function importKey(name, keyBytes) {
    const form = new FormData()
    form.append('file', new Blob([keyBytes], { type: 'application/octet-stream' }), 'key')
    const resp = await fetch(
      `${API}/key/import?arg=${encodeURIComponent(name)}&ipns-base=b58mh`,
      { method: 'POST', body: form }
    )
    return resp.ok ? resp.json() : null  // { Id, Name }
  }

  // Publish an MFS root CID to IPNS under a named key (non-blocking: allow-offline)
  async function publishIPNS(cid, keyName) {
    const params = new URLSearchParams({
      arg:            `/ipfs/${cid}`,
      key:            keyName,
      'allow-offline': 'true',
      lifetime:       '168h',   // record valid for 1 week
      quieter:        'true',
    })
    const resp = await fetch(`${API}/name/publish?${params}`, { method: 'POST' })
    return resp.ok ? resp.json() : null  // { Name, Value }
  }

  // Resolve an IPNS ID → CID (returns null on failure / not found)
  async function resolveIPNS(ipnsId) {
    const params = new URLSearchParams({
      arg:     `/ipns/${ipnsId}`,
      nocache: 'true',
      timeout: '15s',
    })
    const resp = await fetch(`${API}/name/resolve?${params}`, { method: 'POST' })
    if (!resp.ok) return null
    const { Path } = await resp.json()
    // Path = "/ipfs/bafy..."  → strip prefix
    return Path?.startsWith('/ipfs/') ? Path.slice(6) : null
  }

  function getGatewayUrl(cid) {
    return `${GW_BASE}/ipfs/${cid}`
  }

  return {
    connected, nodeId, agentVersion, repoSize, repoMaxSize, checking, storagePercent,
    checkConnection, fetchRepoStat,
    listFiles, mkdir, stat, statHash, rm, mv, filesCp, writeFile,
    listKeys, importKey, publishIPNS, resolveIPNS,
    getGatewayUrl,
  }
})
