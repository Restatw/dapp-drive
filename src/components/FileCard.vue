<script setup>
import { ref, computed } from 'vue'
import { getFileIcon, getFileType } from '../utils/fileType'
import { useIpfsStore } from '../stores/ipfs'

const props = defineProps({
  entry:      { type: Object,  required: true },
  isSelected: { type: Boolean, default: false },
  isPinned:   { type: Boolean, default: false },
})
defineEmits(['open', 'preview', 'delete', 'rename', 'share', 'download', 'select', 'pin'])

const ipfs = useIpfsStore()
const showMenu = ref(false)
const imgError = ref(false)

const isFolder = computed(() => props.entry.Type === 1)
const isImage  = computed(() => !isFolder.value && getFileType(props.entry.Name) === 'image')
const thumbUrl = computed(() =>
  isImage.value && props.entry.Hash ? ipfs.getGatewayUrl(props.entry.Hash) : null
)

function openMenu(e) {
  e.stopPropagation()
  if (showMenu.value) { showMenu.value = false; return }
  showMenu.value = true
  setTimeout(() => {
    document.addEventListener('click', closeMenu, { once: true })
  }, 0)
}

function closeMenu() {
  showMenu.value = false
}
</script>

<template>
  <div
    class="relative group flex flex-col rounded-xl border bg-white hover:shadow-md cursor-pointer transition-all select-none overflow-visible"
    :class="isSelected
      ? 'border-blue-400 bg-blue-50/40 shadow-sm ring-1 ring-blue-300'
      : 'border-gray-100 hover:border-gray-200'"
    @dblclick="$emit('open')"
  >
    <!-- ● Checkbox (top-left, hover or selected) -->
    <div
      class="absolute top-1.5 left-1.5 z-10 transition"
      :class="isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'"
      @click.stop="$emit('select')"
    >
      <div
        class="w-5 h-5 rounded-full border-2 flex items-center justify-center shadow-sm cursor-pointer transition"
        :class="isSelected
          ? 'bg-blue-500 border-blue-500'
          : 'bg-white/90 border-gray-300 hover:border-blue-400'"
      >
        <svg v-if="isSelected" class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
        </svg>
      </div>
    </div>

    <!-- Thumbnail / icon area -->
    <div class="w-full aspect-square flex items-center justify-center rounded-t-xl overflow-hidden bg-gray-50">
      <img
        v-if="thumbUrl && !imgError"
        :src="thumbUrl"
        :alt="entry.Name"
        class="w-full h-full object-cover"
        loading="lazy"
        @error="imgError = true"
      />
      <span v-else class="text-4xl leading-none">{{ getFileIcon(entry) }}</span>
    </div>

    <!-- Name -->
    <div class="px-2 py-2">
      <p class="text-xs text-gray-700 truncate font-medium leading-tight" :title="entry.Name">
        {{ entry.Name }}
      </p>
    </div>

    <!-- ⋮ menu button (top-right, shows on hover) -->
    <div class="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition z-10">
      <button
        class="p-1 rounded-full bg-white/80 hover:bg-gray-200 shadow-sm"
        @click="openMenu"
      >
        <svg class="w-3.5 h-3.5 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/>
        </svg>
      </button>

      <!-- Dropdown -->
      <div
        v-if="showMenu"
        class="absolute right-0 top-7 w-44 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-50 text-left"
        @click.stop
      >
        <button v-if="!isFolder" class="context-item" @click="closeMenu(); $emit('preview')">
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
          Preview
        </button>
        <button v-if="!isFolder" class="context-item" @click="closeMenu(); $emit('download')">
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
          Download
        </button>
        <button v-if="!isFolder" class="context-item" @click="closeMenu(); $emit('share')">
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
          Copy link
        </button>
        <hr class="my-1 border-gray-100" />
        <button class="context-item" @click="closeMenu(); $emit('rename')">
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
          Rename
        </button>
        <!-- Pin to sidebar (folders only) -->
        <button v-if="isFolder" class="context-item" @click="closeMenu(); $emit('pin')">
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>
          {{ isPinned ? 'Unpin from sidebar' : 'Pin to sidebar' }}
        </button>
        <hr class="my-1 border-gray-100" />
        <button class="context-item text-red-600 hover:bg-red-50" @click="closeMenu(); $emit('delete')">
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          Delete
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.context-item {
  @apply w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 transition;
}
</style>
