<script setup>
import { computed } from 'vue'
import { useDriveStore } from '../stores/drive'
import { useIpfsStore } from '../stores/ipfs'
import { formatSize } from '../utils/fileType'

defineEmits(['new-folder', 'upload'])

const drive = useDriveStore()
const ipfs = useIpfsStore()

const used = computed(() => formatSize(ipfs.repoSize))
const max = computed(() => formatSize(ipfs.repoMaxSize))
</script>

<template>
  <aside class="w-52 bg-white border-r border-gray-200 flex flex-col py-3 shrink-0 overflow-y-auto">
    <!-- New buttons -->
    <div class="px-3 mb-3 space-y-1">
      <button
        class="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm transition"
        @click="$emit('upload')"
      >
        <svg class="w-5 h-5 text-blue-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        Upload files
      </button>
      <button
        class="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition"
        @click="$emit('new-folder')"
      >
        <svg class="w-5 h-5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        </svg>
        New folder
      </button>
    </div>

    <hr class="mx-3 border-gray-100 mb-2" />

    <!-- Nav items -->
    <nav class="flex-1 px-2 space-y-0.5">
      <button
        :class="[
          'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition',
          drive.currentPath !== null
            ? 'bg-blue-50 text-blue-700'
            : 'text-gray-700 hover:bg-gray-100',
        ]"
        @click="drive.navigate('/')"
      >
        <svg class="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
        My Drive
      </button>

      <button disabled class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-300 cursor-not-allowed">
        <svg class="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
        Starred
      </button>

      <button disabled class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-300 cursor-not-allowed">
        <svg class="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        Trash
      </button>
    </nav>

    <!-- Storage -->
    <div class="mx-3 mt-3 pt-3 border-t border-gray-100">
      <div class="flex justify-between text-xs text-gray-400 mb-1">
        <span>Storage</span>
        <span>{{ used }} / {{ max }}</span>
      </div>
      <div class="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          class="h-full bg-blue-500 rounded-full transition-all duration-700"
          :style="{ width: `${ipfs.storagePercent || 0}%` }"
        ></div>
      </div>
      <p class="text-xs text-gray-400 mt-1">{{ ipfs.storagePercent }}% used</p>
    </div>
  </aside>
</template>
