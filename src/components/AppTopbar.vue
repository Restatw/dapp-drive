<script setup>
import { useDriveStore } from '../stores/drive'
import NodeStatus from './NodeStatus.vue'

defineEmits(['upload'])

const drive = useDriveStore()
</script>

<template>
  <header class="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center gap-4 z-10 shadow-sm shrink-0">
    <!-- Logo -->
    <div class="flex items-center gap-2 w-52 shrink-0">
      <span class="text-2xl select-none">📦</span>
      <span class="text-lg font-semibold text-gray-800 tracking-tight">IPFS Drive</span>
    </div>

    <!-- Search -->
    <div class="flex-1 max-w-xl">
      <div class="relative">
        <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          v-model="drive.searchQuery"
          type="text"
          placeholder="Search in Drive…"
          class="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
        />
        <button
          v-if="drive.searchQuery"
          class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          @click="drive.searchQuery = ''"
        >✕</button>
      </div>
    </div>

    <!-- Right -->
    <div class="flex items-center gap-2 ml-auto">
      <NodeStatus />
      <button
        class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-full text-sm font-medium hover:bg-blue-700 active:scale-95 transition-all"
        @click="$emit('upload')"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        Upload
      </button>
    </div>
  </header>
</template>
