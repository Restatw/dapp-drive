<script setup>
import { ref, onMounted } from 'vue'
import { useDriveStore } from '../stores/drive'
import { useIpfsStore } from '../stores/ipfs'
import AppTopbar from '../components/AppTopbar.vue'
import AppSidebar from '../components/AppSidebar.vue'
import BreadCrumb from '../components/BreadCrumb.vue'
import FileGrid from '../components/FileGrid.vue'
import FileList from '../components/FileList.vue'
import CreateFolderModal from '../components/CreateFolderModal.vue'
import FilePreviewModal from '../components/FilePreviewModal.vue'
import UploadProgress from '../components/UploadProgress.vue'

const drive = useDriveStore()
const ipfs = useIpfsStore()

const showCreateFolder = ref(false)
const previewEntry = ref(null)
const isDragging = ref(false)

onMounted(() => drive.navigate('/'))

// ── Drag & drop ───────────────────────────────────────────────────
function onDragOver(e) {
  e.preventDefault()
  isDragging.value = true
}

function onDragLeave(e) {
  // Only clear when leaving the drop zone entirely
  if (!e.currentTarget.contains(e.relatedTarget)) isDragging.value = false
}

function onDrop(e) {
  e.preventDefault()
  isDragging.value = false
  const files = Array.from(e.dataTransfer.files)
  if (files.length) drive.uploadFiles(files)
}

// ── File input ────────────────────────────────────────────────────
function openFileInput() {
  const input = document.createElement('input')
  input.type = 'file'
  input.multiple = true
  input.onchange = e => {
    const files = Array.from(e.target.files)
    if (files.length) drive.uploadFiles(files)
  }
  input.click()
}

// ── Entry actions ─────────────────────────────────────────────────
function handleOpen(entry) {
  if (entry.Type === 1) {
    const next = drive.currentPath === '/' ? '/' + entry.Name : drive.currentPath + '/' + entry.Name
    drive.navigate(next)
  } else {
    previewEntry.value = entry
  }
}

function handleRename(entry) {
  const newName = window.prompt('Rename to:', entry.Name)
  if (newName && newName.trim() && newName.trim() !== entry.Name) {
    drive.renameEntry(entry, newName.trim())
  }
}

async function handleShare(entry) {
  let hash = entry.Hash
  if (!hash) {
    const p = drive.currentPath === '/' ? '/' + entry.Name : drive.currentPath + '/' + entry.Name
    const s = await ipfs.stat(p)
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
    const p = drive.currentPath === '/' ? '/' + entry.Name : drive.currentPath + '/' + entry.Name
    const s = await ipfs.stat(p)
    if (s) hash = s.Hash
  }
  if (!hash) return
  const a = document.createElement('a')
  a.href = ipfs.getGatewayUrl(hash)
  a.download = entry.Name
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}
</script>

<template>
  <div class="h-screen flex flex-col bg-gray-50 overflow-hidden">
    <AppTopbar @upload="openFileInput" />

    <!-- Offline banner -->
    <Transition name="banner">
      <div
        v-if="!ipfs.connected && !ipfs.checking"
        class="bg-amber-50 border-b border-amber-200 px-5 py-2 text-sm text-amber-700 flex items-center gap-2 shrink-0"
      >
        <span class="text-base">⚠️</span>
        <span>IPFS node is offline. Run <code class="font-mono bg-amber-100 px-1 rounded text-xs">ipfs daemon</code> then
          <button class="underline font-semibold ml-0.5" @click="ipfs.checkConnection()">retry</button>.
        </span>
      </div>
    </Transition>

    <div class="flex flex-1 overflow-hidden min-h-0">
      <AppSidebar @new-folder="showCreateFolder = true" @upload="openFileInput" />

      <!-- Main content area -->
      <main
        class="relative flex-1 flex flex-col overflow-hidden min-w-0"
        @dragover="onDragOver"
        @dragleave="onDragLeave"
        @drop="onDrop"
      >
        <!-- Drag overlay (pointer-events-none so drop fires on parent) -->
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
              <svg class="w-4.5 h-4.5" style="width:18px;height:18px" fill="currentColor" viewBox="0 0 24 24">
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
              Drag files here or click <button class="text-blue-500 hover:underline" @click="openFileInput">Upload</button>
            </p>
          </div>
        </div>

        <!-- File grid / list -->
        <div v-else class="flex-1 overflow-y-auto px-5 pb-6 min-h-0">
          <FileGrid
            v-if="drive.viewMode === 'grid'"
            :entries="drive.filteredEntries"
            @open="handleOpen"
            @preview="previewEntry = $event"
            @delete="drive.deleteEntry"
            @rename="handleRename"
            @share="handleShare"
            @download="handleDownload"
          />
          <FileList
            v-else
            :entries="drive.filteredEntries"
            @open="handleOpen"
            @preview="previewEntry = $event"
            @delete="drive.deleteEntry"
            @rename="handleRename"
            @share="handleShare"
            @download="handleDownload"
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
      v-if="previewEntry"
      :entry="previewEntry"
      :current-path="drive.currentPath"
      @close="previewEntry = null"
      @download="handleDownload"
    />
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.15s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
.banner-enter-active, .banner-leave-active { transition: all 0.2s; }
.banner-enter-from, .banner-leave-to { opacity: 0; transform: translateY(-100%); }
</style>
