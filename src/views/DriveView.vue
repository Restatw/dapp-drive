<script setup>
import { ref, computed, onMounted } from 'vue'
import { useDriveStore } from '../stores/drive'
import { useIpfsStore } from '../stores/ipfs'
import AppTopbar from '../components/AppTopbar.vue'
import AppSidebar from '../components/AppSidebar.vue'
import BreadCrumb from '../components/BreadCrumb.vue'
import FileGrid from '../components/FileGrid.vue'
import FileList from '../components/FileList.vue'
import CreateFolderModal from '../components/CreateFolderModal.vue'
import FilePreviewModal from '../components/FilePreviewModal.vue'
import MoveModal from '../components/MoveModal.vue'
import UploadProgress from '../components/UploadProgress.vue'

const drive = useDriveStore()
const ipfs  = useIpfsStore()

const showCreateFolder = ref(false)
const showMoveModal    = ref(false)
const isDragging       = ref(false)
const sidebarOpen      = ref(false)

// Preview: index into the file-only list
const previewIndex   = ref(-1)
const previewEntries = computed(() => drive.filteredEntries.filter(e => e.Type !== 1))

const selectionCount = computed(() => drive.selected.size)
const selectedNames  = computed(() => [...drive.selected])

onMounted(() => drive.navigate('/'))

// ── Drag & drop ───────────────────────────────────────────────────
function onDragOver(e)  { e.preventDefault(); isDragging.value = true }
function onDragLeave(e) { if (!e.currentTarget.contains(e.relatedTarget)) isDragging.value = false }
function onDrop(e) {
  e.preventDefault(); isDragging.value = false
  const files = Array.from(e.dataTransfer.files)
  if (files.length) drive.uploadFiles(files)
}

// ── File input ────────────────────────────────────────────────────
function openFileInput() {
  const input = document.createElement('input')
  input.type = 'file'; input.multiple = true
  input.onchange = e => {
    const files = Array.from(e.target.files)
    if (files.length) drive.uploadFiles(files)
  }
  input.click()
}

// ── Entry actions ─────────────────────────────────────────────────
function openPreview(entry) {
  const i = previewEntries.value.findIndex(e => e.Name === entry.Name)
  if (i >= 0) previewIndex.value = i
}

function handleOpen(entry) {
  if (entry.Type === 1) {
    drive.navigate(drive.currentPath === '/' ? '/' + entry.Name : drive.currentPath + '/' + entry.Name)
  } else {
    openPreview(entry)
  }
}

function handleSelect(entry) {
  drive.toggleSelect(entry.Name)
}

function handleRename(entry) {
  const newName = window.prompt('Rename to:', entry.Name)
  if (newName && newName.trim() && newName.trim() !== entry.Name) {
    drive.renameEntry(entry, newName.trim())
  }
}

function entryRelativePath(entry) {
  return drive.currentPath === '/' ? '/' + entry.Name : drive.currentPath + '/' + entry.Name
}

async function handleShare(entry) {
  let hash = entry.Hash
  if (!hash) {
    const s = await drive.statEntry(entryRelativePath(entry))
    if (s) hash = s.Hash
  }
  if (!hash) return alert('Could not resolve CID for this file.')
  const url = ipfs.getGatewayUrl(hash)
  try {
    await navigator.clipboard.writeText(url)
    alert(`Link copied!\n\n${url}\n\nNote: only accessible while your IPFS node is running.`)
  } catch {
    prompt('Copy this IPFS link:', url)
  }
}

async function handleDownload(entry) {
  let hash = entry.Hash
  if (!hash) {
    const s = await drive.statEntry(entryRelativePath(entry))
    if (s) hash = s.Hash
  }
  if (!hash) return
  const a = document.createElement('a')
  a.href = ipfs.getGatewayUrl(hash)
  a.download = entry.Name
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
}

function handlePin(entry) {
  const rel = entryRelativePath(entry)
  drive.isPinned(rel) ? drive.unpinFolder(rel) : drive.pinFolder(rel, entry.Name)
}

// ── Bulk selection actions ────────────────────────────────────────
async function handleBulkDelete() {
  if (!confirm(`Delete ${selectionCount.value} item(s)? This cannot be undone.`)) return
  await drive.deleteSelected()
}

async function handleMoveConfirm(destPath) {
  showMoveModal.value = false
  await drive.moveSelected(destPath)
}
</script>

<template>
  <div class="h-screen flex flex-col bg-gray-50 overflow-hidden">
    <AppTopbar @upload="openFileInput" @toggle-sidebar="sidebarOpen = !sidebarOpen" />

    <!-- Offline banner -->
    <Transition name="banner">
      <div
        v-if="drive.isOffline"
        class="bg-amber-50 border-b border-amber-200 px-5 py-2 text-sm text-amber-700 flex items-center gap-2 shrink-0"
      >
        <span class="text-base">⚠️</span>
        <span>
          {{ drive.isCachedView ? 'IPFS 離線，顯示上次快取的目錄。' : 'IPFS node is offline.' }}
          Run <code class="font-mono bg-amber-100 px-1 rounded text-xs">ipfs daemon</code> then
          <button class="underline font-semibold ml-0.5" @click="ipfs.checkConnection().then(() => drive.refresh())">retry</button>.
        </span>
      </div>
    </Transition>

    <div class="flex flex-1 overflow-hidden min-h-0">
      <AppSidebar
        :open="sidebarOpen"
        @new-folder="showCreateFolder = true; sidebarOpen = false"
        @upload="openFileInput; sidebarOpen = false"
        @close="sidebarOpen = false"
      />

      <!-- Main content -->
      <main
        class="relative flex-1 flex flex-col overflow-hidden min-w-0"
        @dragover="onDragOver"
        @dragleave="onDragLeave"
        @drop="onDrop"
      >
        <!-- Drag overlay -->
        <Transition name="fade">
          <div
            v-if="isDragging"
            class="absolute inset-2 z-30 bg-blue-50/95 border-2 border-dashed border-blue-400 rounded-2xl flex flex-col items-center justify-center pointer-events-none"
          >
            <div class="text-6xl mb-3 select-none">📂</div>
            <p class="text-xl font-semibold text-blue-600">Drop to upload</p>
            <p class="text-sm text-blue-400 mt-1">Files will be added to current folder</p>
          </div>
        </Transition>

        <!-- Toolbar -->
        <div class="px-5 pt-4 pb-2 flex items-center justify-between gap-4 shrink-0">
          <BreadCrumb :crumbs="drive.breadcrumbs" @navigate="drive.navigate" />
          <div class="flex items-center gap-1 shrink-0">
            <button
              :class="['p-1.5 rounded-lg transition', drive.viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:bg-gray-100']"
              title="Grid view"
              @click="drive.viewMode = 'grid'"
            >
              <svg style="width:18px;height:18px" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 3h8v8H3zm10 0h8v8h-8zM3 13h8v8H3zm10 0h8v8h-8z"/>
              </svg>
            </button>
            <button
              :class="['p-1.5 rounded-lg transition', drive.viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:bg-gray-100']"
              title="List view"
              @click="drive.viewMode = 'list'"
            >
              <svg style="width:18px;height:18px" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- ── Selection toolbar ──────────────────────────────── -->
        <Transition name="sel-bar">
          <div
            v-if="selectionCount > 0"
            class="mx-5 mb-2 px-4 py-2.5 bg-blue-500 text-white rounded-xl flex items-center gap-3 shadow-md shrink-0"
          >
            <!-- Count + clear -->
            <button
              class="flex items-center gap-2 text-sm font-semibold hover:text-blue-100 transition"
              title="Clear selection"
              @click="drive.clearSelection()"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/>
              </svg>
              {{ selectionCount }} selected
            </button>

            <div class="flex-1" />

            <!-- Select all -->
            <button
              class="text-xs font-medium bg-white/20 hover:bg-white/30 px-2.5 py-1 rounded-lg transition"
              @click="drive.selectAll()"
            >
              Select all
            </button>

            <!-- Move -->
            <button
              class="flex items-center gap-1.5 text-xs font-medium bg-white/20 hover:bg-white/30 px-2.5 py-1 rounded-lg transition"
              @click="showMoveModal = true"
            >
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
              </svg>
              Move
            </button>

            <!-- Delete -->
            <button
              class="flex items-center gap-1.5 text-xs font-medium bg-white/20 hover:bg-red-400/60 px-2.5 py-1 rounded-lg transition"
              @click="handleBulkDelete"
            >
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
              Delete
            </button>
          </div>
        </Transition>

        <!-- Loading spinner -->
        <div v-if="drive.loading" class="flex-1 flex items-center justify-center">
          <div class="w-8 h-8 border-[3px] border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
        </div>

        <!-- Error -->
        <div v-else-if="drive.error" class="flex-1 flex items-center justify-center text-center p-8">
          <div>
            <div class="text-5xl mb-3 select-none">⚠️</div>
            <p class="text-base font-medium text-gray-600">{{ drive.error }}</p>
            <button class="mt-3 text-sm text-blue-600 hover:underline" @click="drive.refresh()">Retry</button>
          </div>
        </div>

        <!-- Empty state -->
        <div
          v-else-if="!drive.loading && drive.filteredEntries.length === 0"
          class="flex-1 flex items-center justify-center text-center p-8"
        >
          <div>
            <div class="text-7xl mb-4 select-none">{{ drive.searchQuery ? '🔍' : '📁' }}</div>
            <p class="text-lg font-semibold text-gray-600">
              {{ drive.searchQuery ? 'No matching files' : 'This folder is empty' }}
            </p>
            <p v-if="!drive.searchQuery" class="text-sm text-gray-400 mt-1.5">
              Drag files here or click
              <button class="text-blue-500 hover:underline" @click="openFileInput">Upload</button>
            </p>
          </div>
        </div>

        <!-- File grid / list -->
        <div v-else class="flex-1 overflow-y-auto px-5 pb-6 min-h-0">
          <FileGrid
            v-if="drive.viewMode === 'grid'"
            :entries="drive.filteredEntries"
            :selected="drive.selected"
            @open="handleOpen"
            @preview="openPreview($event)"
            @delete="drive.deleteEntry"
            @rename="handleRename"
            @share="handleShare"
            @download="handleDownload"
            @select="handleSelect"
            @pin="handlePin"
          />
          <FileList
            v-else
            :entries="drive.filteredEntries"
            :selected="drive.selected"
            @open="handleOpen"
            @preview="openPreview($event)"
            @delete="drive.deleteEntry"
            @rename="handleRename"
            @share="handleShare"
            @download="handleDownload"
            @select="handleSelect"
            @pin="handlePin"
          />
        </div>
      </main>
    </div>

    <!-- Upload progress toasts -->
    <UploadProgress :uploads="drive.uploads" />

    <!-- Modals -->
    <CreateFolderModal
      v-if="showCreateFolder"
      @close="showCreateFolder = false"
      @create="name => { drive.createFolder(name); showCreateFolder = false }"
    />
    <FilePreviewModal
      v-if="previewIndex >= 0"
      :entries="previewEntries"
      :initial-index="previewIndex"
      :current-path="drive.currentPath"
      @close="previewIndex = -1"
      @download="handleDownload"
    />
    <MoveModal
      v-if="showMoveModal"
      :count="selectionCount"
      :source-path="drive.currentPath"
      :selected-names="selectedNames"
      @close="showMoveModal = false"
      @confirm="handleMoveConfirm"
    />
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.15s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.banner-enter-active, .banner-leave-active { transition: all 0.2s; }
.banner-enter-from, .banner-leave-to { opacity: 0; transform: translateY(-100%); }
.sel-bar-enter-active, .sel-bar-leave-active { transition: all 0.2s ease; }
.sel-bar-enter-from, .sel-bar-leave-to { opacity: 0; transform: translateY(-8px); }
</style>
