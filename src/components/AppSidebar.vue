<script setup>
import { computed } from 'vue'
import { useDriveStore } from '../stores/drive'
import { useIdentityStore } from '../stores/identity'
import { useIpfsStore } from '../stores/ipfs'
import { formatSize } from '../utils/fileType'

const props = defineProps({
  open: { type: Boolean, default: false },
})
defineEmits(['new-folder', 'upload', 'close'])

const drive    = useDriveStore()
const identity = useIdentityStore()
const ipfs     = useIpfsStore()

const used = computed(() => formatSize(ipfs.repoSize))
const max  = computed(() => formatSize(ipfs.repoMaxSize))

const syncLabel = computed(() => {
  switch (drive.syncState) {
    case 'publishing': return '↑ Publishing…'
    case 'checking':   return '⟳ Checking…'
    case 'syncing':    return '↓ Syncing…'
    case 'error':      return '⚠ Sync error'
    default:
      if (!ipfs.connected)        return '— IPFS offline'
      if (!identity.ipnsKeyId)    return '⟳ Importing key…'
      if (drive.lastPublishedAt) {
        const diff = Math.round((Date.now() - drive.lastPublishedAt) / 60000)
        return diff < 1 ? '↑ Just published' : `↑ ${diff}m ago`
      }
      return 'IPNS ready'
  }
})

const syncLabelClass = computed(() => {
  if (drive.syncState === 'error')  return 'text-red-500'
  if (drive.syncState !== 'idle')   return 'text-blue-500'
  if (!ipfs.connected)              return 'text-gray-400'
  if (!identity.ipnsKeyId)          return 'text-amber-500'
  return 'text-gray-400'
})
</script>

<template>
  <!-- Mobile backdrop -->
  <Transition name="backdrop">
    <div
      v-if="open"
      class="fixed inset-0 z-30 bg-black/40 md:hidden"
      @click="$emit('close')"
    />
  </Transition>

  <!-- Sidebar panel -->
  <aside
    class="bg-white border-r border-gray-200 flex flex-col py-3 shrink-0 overflow-y-auto
           fixed inset-y-0 left-0 z-40 w-64 transition-transform duration-200
           md:relative md:w-52 md:translate-x-0 md:z-auto"
    :class="open ? 'translate-x-0 shadow-xl' : '-translate-x-full'"
  >

    <!-- Mobile header row (close button) -->
    <div class="md:hidden flex items-center justify-between px-3 mb-2">
      <div class="flex items-center gap-2">
        <span class="text-xl select-none">📦</span>
        <span class="text-base font-semibold text-gray-800">IPFS Drive</span>
      </div>
      <button class="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition" @click="$emit('close')">
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>

    <!-- Action buttons -->
    <div class="px-3 mb-3 mt-2 space-y-1">
      <button
        class="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm transition"
        @click="$emit('upload'); $emit('close')"
      >
        <svg class="w-5 h-5 text-blue-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
        </svg>
        Upload files
      </button>
      <button
        class="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition"
        @click="$emit('new-folder'); $emit('close')"
      >
        <svg class="w-5 h-5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
        </svg>
        New folder
      </button>
    </div>

    <hr class="mx-3 border-gray-100 mb-2" />

    <!-- Main nav -->
    <nav class="px-2 space-y-0.5">
      <button
        :class="['w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition',
          drive.currentPath === '/' ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100']"
        @click="drive.navigate('/'); $emit('close')"
      >
        <svg class="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
        </svg>
        My Drive
      </button>
    </nav>

    <!-- ── Pinned folders ──────────────────────────────────────── -->
    <template v-if="drive.pinnedFolders.length > 0">
      <div class="mx-3 mt-3 mb-1 flex items-center gap-1">
        <span class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Pinned</span>
        <div class="flex-1 h-px bg-gray-100 ml-1" />
      </div>
      <nav class="px-2 space-y-0.5">
        <div
          v-for="pin in drive.pinnedFolders"
          :key="pin.path"
          class="group/pin w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition cursor-pointer"
          :class="drive.currentPath === pin.path ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'"
          @click="drive.navigate(pin.path); $emit('close')"
        >
          <svg class="w-4 h-4 shrink-0 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/>
          </svg>
          <span class="flex-1 truncate text-xs font-medium">{{ pin.name }}</span>
          <button
            class="opacity-0 group-hover/pin:opacity-100 transition p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-red-500"
            @click.stop="drive.unpinFolder(pin.path)"
          >
            <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </nav>
    </template>

    <div class="flex-1" />

    <!-- ── IPNS sync status ────────────────────────────────────── -->
    <div class="mx-3 mb-2 rounded-xl border border-gray-100 overflow-hidden">
      <div class="px-3 py-2 bg-gray-50 flex items-center justify-between gap-2">
        <span class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Sync</span>
        <!-- Spinner when active -->
        <span
          v-if="drive.syncState !== 'idle'"
          class="w-3 h-3 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin"
        />
      </div>
      <div class="px-3 pb-2.5 pt-1 space-y-1.5">
        <!-- State label -->
        <p class="text-xs transition" :class="syncLabelClass">{{ syncLabel }}</p>

        <!-- Remote update available banner -->
        <div v-if="drive.remoteUpdateAvailable" class="rounded-lg bg-blue-50 border border-blue-200 p-2">
          <p class="text-[11px] text-blue-700 font-medium mb-1.5">Remote update available</p>
          <div class="flex gap-1.5">
            <button
              class="flex-1 text-[11px] font-semibold text-white bg-blue-500 hover:bg-blue-600 rounded-md py-1 transition"
              :disabled="drive.syncState === 'syncing'"
              @click="drive.applySyncFromRemote()"
            >Sync now</button>
            <button
              class="text-[11px] text-gray-500 hover:text-gray-700 px-2 rounded-md hover:bg-gray-100 transition"
              @click="drive.dismissRemoteUpdate()"
            >Dismiss</button>
          </div>
        </div>

        <!-- Manual publish button -->
        <button
          v-if="drive.syncState === 'idle' && identity.ipnsKeyId"
          class="w-full text-[11px] text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md py-1 transition text-center"
          @click="drive.publishDrive()"
        >Publish now</button>
      </div>
    </div>

    <!-- ── Storage bar ─────────────────────────────────────────── -->
    <div class="mx-3 pt-3 border-t border-gray-100">
      <div class="flex justify-between text-xs text-gray-400 mb-1">
        <span>Storage</span>
        <span>{{ used }} / {{ max }}</span>
      </div>
      <div class="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          class="h-full bg-blue-500 rounded-full transition-all duration-700"
          :style="{ width: `${ipfs.storagePercent || 0}%` }"
        />
      </div>
      <p class="text-xs text-gray-400 mt-1">{{ ipfs.storagePercent }}% used</p>
    </div>
  </aside>
</template>

<style scoped>
.backdrop-enter-active, .backdrop-leave-active { transition: opacity 0.2s; }
.backdrop-enter-from, .backdrop-leave-to { opacity: 0; }
</style>
