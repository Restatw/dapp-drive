<script setup>
import { computed } from 'vue'
import { getFileIcon, formatSize } from '../utils/fileType'
import { useDriveStore } from '../stores/drive'

const props = defineProps({
  entry:      { type: Object,  required: true },
  isSelected: { type: Boolean, default: false },
  isPinned:   { type: Boolean, default: false },
})
defineEmits(['open', 'preview', 'delete', 'rename', 'share', 'download', 'select', 'pin'])

const drive   = useDriveStore()
const isFolder = computed(() => props.entry.Type === 1)
</script>

<template>
  <tr
    class="group border-b border-gray-50 cursor-pointer transition"
    :class="isSelected ? 'bg-blue-50/60' : 'hover:bg-gray-50'"
    @dblclick="$emit('open')"
  >
    <!-- Checkbox -->
    <td class="py-2 pl-3 pr-1 w-8">
      <div
        class="w-4.5 h-4.5 rounded-full border-2 flex items-center justify-center transition cursor-pointer"
        style="width:18px;height:18px"
        :class="isSelected
          ? 'bg-blue-500 border-blue-500'
          : 'bg-white border-gray-200 opacity-0 group-hover:opacity-100 hover:border-blue-400'"
        @click.stop="$emit('select')"
      >
        <svg v-if="isSelected" class="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
        </svg>
      </div>
    </td>

    <!-- Name -->
    <td class="py-2 px-2">
      <div class="flex items-center gap-2.5 min-w-0">
        <span class="text-xl leading-none shrink-0">{{ getFileIcon(entry) }}</span>
        <span class="text-sm text-gray-800 font-medium truncate">{{ entry.Name }}</span>
        <!-- Pin badge -->
        <svg v-if="isFolder && isPinned" class="w-3 h-3 text-blue-400 shrink-0" fill="currentColor" viewBox="0 0 24 24">
          <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/>
        </svg>
      </div>
    </td>

    <!-- Size -->
    <td class="py-2 px-3 text-xs text-gray-400 whitespace-nowrap">
      {{ isFolder ? '—' : formatSize(entry.Size) }}
    </td>

    <!-- Actions -->
    <td class="py-2 px-3">
      <div class="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition">
        <button v-if="!isFolder" class="row-action" @click.stop="$emit('preview')">Preview</button>
        <button v-if="!isFolder" class="row-action" @click.stop="$emit('download')">Download</button>
        <button v-if="!isFolder" class="row-action" @click.stop="$emit('share')">Share</button>
        <button class="row-action" @click.stop="$emit('rename')">Rename</button>
        <button v-if="isFolder" class="row-action" @click.stop="$emit('pin')">
          {{ isPinned ? 'Unpin' : 'Pin' }}
        </button>
        <button class="row-action !text-red-500 hover:!bg-red-50" @click.stop="$emit('delete')">Delete</button>
      </div>
    </td>
  </tr>
</template>

<style scoped>
.row-action {
  @apply px-2 py-1 text-xs text-gray-500 hover:bg-gray-200 rounded transition;
}
</style>
