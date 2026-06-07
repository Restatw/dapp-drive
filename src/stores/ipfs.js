import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// Dev: empty → Vite proxy forwards /api/v0 to localhost:5001 (no CORS issue)
// Prod: set VITE_IPFS_API=http://127.0.0.1:5001 in .env.production
const API_BASE = import.meta.env.VITE_IPFS_API ?? ''
const GW_BASE  = import.meta.env.VITE_IPFS_GW  ?? ''
const API = `${API_BASE}/api/v0`

export const useIpfsStore = defineStore('ipfs', () => {
  const connected = ref(false)
  const nodeId = ref('')
  const agentVersion = ref('')
  const repoSize = ref(0)
  const repoMaxSize = ref(0)
  const checking = ref(false)

  const storagePercent = computed(() => {
    if (!repoMaxSize.value) return 0
    return Math.min(100, Math.round((repoSize.value / repoMaxSize.value) * 100))
  })

  async function checkConnection() {
    checking.value = true
    try {
      const resp = await fetch(`${API}/id`, { method: 'POST' })
      if (!resp.ok) throw new Error('not ok')
      const data = await resp.json()
      nodeId.value = data.ID
      agentVersion.value = data.AgentVersion
      connected.value = true
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
      const data = await resp.json()
      repoSize.value = data.RepoSize || 0
      repoMaxSize.value = data.StorageMax || 0
    } catch {}
  }

  async function listFiles(path = '/') {
    const resp = await fetch(`${API}/files/ls?arg=${encodeURIComponent(path)}&long=true`, { method: 'POST' })
    if (!resp.ok) return []
    const data = await resp.json()
    const entries = data.Entries || []
    return entries.sort((a, b) => {
      if (a.Type !== b.Type) return b.Type - a.Type // folders first
      return a.Name.localeCompare(b.Name)
    })
  }

  async function mkdir(path) {
    const resp = await fetch(`${API}/files/mkdir?arg=${encodeURIComponent(path)}&parents=true`, { method: 'POST' })
    return resp.ok
  }

  async function stat(path) {
    const resp = await fetch(`${API}/files/stat?arg=${encodeURIComponent(path)}`, { method: 'POST' })
    if (!resp.ok) return null
    return resp.json()
  }

  async function rm(path) {
    const resp = await fetch(
      `${API}/files/rm?arg=${encodeURIComponent(path)}&recursive=true&force=true`,
      { method: 'POST' }
    )
    return resp.ok
  }

  async function mv(from, to) {
    const resp = await fetch(
      `${API}/files/mv?arg=${encodeURIComponent(from)}&arg=${encodeURIComponent(to)}`,
      { method: 'POST' }
    )
    return resp.ok
  }

  // Upload a File via XHR so we can track progress
  function writeFile(path, file, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      const url = `${API}/files/write?arg=${encodeURIComponent(path)}&create=true&parents=true&truncate=true`
      xhr.upload.onprogress = e => {
        if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100))
      }
      xhr.onload = () => resolve(xhr.status < 400)
      xhr.onerror = () => reject(new Error('Upload failed'))
      const fd = new FormData()
      fd.append('file', file)
      xhr.open('POST', url)
      xhr.send(fd)
    })
  }

  function getGatewayUrl(cid) {
    return `${GW_BASE}/ipfs/${cid}`
  }

  return {
    connected, nodeId, agentVersion, repoSize, repoMaxSize, checking, storagePercent,
    checkConnection, fetchRepoStat,
    listFiles, mkdir, stat, rm, mv, writeFile, getGatewayUrl,
  }
})
