import { defineStore } from 'pinia'
import { ref, computed, reactive } from 'vue'
import { useIpfsStore } from './ipfs'

function joinPath(base, name) {
  return base === '/' ? '/' + name : base + '/' + name
}

export const useDriveStore = defineStore('drive', () => {
  const ipfs = useIpfsStore()

  const currentPath = ref('/')
  const entries = ref([])
  const loading = ref(false)
  const viewMode = ref('grid')
  const selected = ref(new Set())
  const uploads = ref([])
  const searchQuery = ref('')
  const error = ref(null)

  const breadcrumbs = computed(() => {
    const parts = currentPath.value.split('/').filter(Boolean)
    const crumbs = [{ name: 'My Drive', path: '/' }]
    let acc = ''
    for (const p of parts) {
      acc += '/' + p
      crumbs.push({ name: p, path: acc })
    }
    return crumbs
  })

  const filteredEntries = computed(() => {
    if (!searchQuery.value.trim()) return entries.value
    const q = searchQuery.value.toLowerCase()
    return entries.value.filter(e => e.Name.toLowerCase().includes(q))
  })

  async function navigate(path) {
    currentPath.value = path
    selected.value = new Set()
    searchQuery.value = ''
    await refresh()
  }

  async function refresh() {
    loading.value = true
    error.value = null
    try {
      entries.value = await ipfs.listFiles(currentPath.value)
    } catch {
      error.value = 'Failed to load directory'
      entries.value = []
    } finally {
      loading.value = false
    }
  }

  async function createFolder(name) {
    const ok = await ipfs.mkdir(joinPath(currentPath.value, name))
    if (ok) await refresh()
    return ok
  }

  async function uploadFiles(files) {
    for (const file of files) {
      const upload = reactive({ name: file.name, progress: 0, done: false, error: null })
      uploads.value.push(upload)
      try {
        await ipfs.writeFile(joinPath(currentPath.value, file.name), file, p => { upload.progress = p })
        upload.progress = 100
        upload.done = true
      } catch (e) {
        upload.error = e.message || 'Upload failed'
      }
    }
    await refresh()
    await ipfs.fetchRepoStat()
    setTimeout(() => {
      uploads.value = uploads.value.filter(u => !u.done)
    }, 2500)
  }

  async function deleteEntry(entry) {
    const ok = await ipfs.rm(joinPath(currentPath.value, entry.Name))
    if (ok) entries.value = entries.value.filter(e => e.Name !== entry.Name)
    return ok
  }

  async function renameEntry(entry, newName) {
    const ok = await ipfs.mv(
      joinPath(currentPath.value, entry.Name),
      joinPath(currentPath.value, newName)
    )
    if (ok) await refresh()
    return ok
  }

  function toggleSelect(name) {
    const s = new Set(selected.value)
    s.has(name) ? s.delete(name) : s.add(name)
    selected.value = s
  }

  function clearSelection() { selected.value = new Set() }

  return {
    currentPath, entries, loading, viewMode, selected, uploads, searchQuery, error,
    breadcrumbs, filteredEntries,
    navigate, refresh, createFolder, uploadFiles, deleteEntry, renameEntry,
    toggleSelect, clearSelection,
  }
})
