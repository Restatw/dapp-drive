<script setup>
import { computed } from 'vue'
import { getFileIcon, formatSize } from '../utils/fileType'

const props = defineProps({ entry: { type: Object, required: true } })
defineEmits(['open', 'preview', 'delete', 'rename', 'share', 'download'])

const isFolder = computed(() => props.entry.Type === 1)
</script>

<template>
  <tr
    class="group hover:bg-gray-50 border-b border-gray-50 cursor-pointer transition"
    @dblclick="$emit('open')"
  >
    <td class="py-2 px-3">
      <div class="flex items-center gap-2.5 min-w-0">
        <span class="text-xl leading-none shrink-0">{{ getFileIcon(entry) }}</span>
        <span class="text-sm text-gray-800 font-medium truncate">{{ entry.Name }}</span>
      </div>
    </td>
    <td class="py-2 px-3 text-xs text-gray-400 whitespace-nowrap">
      {{ isFolder ? '—' : formatSize(entry.Size) }}
    </td>
    <td class="py-2 px-3">
      <div class="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition">
        <button v-if="!isFolder" class="row-action" @click.stop="$emit('preview')">Preview</button>
        <button v-if="!isFolder" class="row-action" @click.stop="$emit('download')">Download</button>
        <button v-if="!isFolder" class="row-action" @click.stop="$emit('share')">Share</button>
        <button class="row-action" @click.stop="$emit('rename')">Rename</button>
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
