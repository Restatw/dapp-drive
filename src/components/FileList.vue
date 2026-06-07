<script setup>
import FileRow from './FileRow.vue'
import { useDriveStore } from '../stores/drive'

const props = defineProps({
  entries:  { type: Array, default: () => [] },
  selected: { type: Set,   default: () => new Set() },
})
defineEmits(['open', 'preview', 'delete', 'rename', 'share', 'download', 'select', 'pin'])

const drive = useDriveStore()

function entryPath(entry) {
  return drive.currentPath === '/' ? '/' + entry.Name : drive.currentPath + '/' + entry.Name
}
</script>

<template>
  <div class="mt-3 bg-white rounded-xl border border-gray-100 overflow-hidden">
    <table class="w-full text-sm">
      <thead>
        <tr class="border-b border-gray-100 bg-gray-50/50">
          <th class="py-2 pl-3 pr-1 w-8"></th>
          <th class="text-left py-2 px-2 text-xs font-medium text-gray-500">Name</th>
          <th class="text-left py-2 px-3 text-xs font-medium text-gray-500">Size</th>
          <th class="py-2 px-3"></th>
        </tr>
      </thead>
      <tbody>
        <FileRow
          v-for="entry in entries"
          :key="entry.Name"
          :entry="entry"
          :is-selected="selected.has(entry.Name)"
          :is-pinned="entry.Type === 1 && drive.isPinned(entryPath(entry))"
          @open="$emit('open', entry)"
          @preview="$emit('preview', entry)"
          @delete="$emit('delete', entry)"
          @rename="$emit('rename', entry)"
          @share="$emit('share', entry)"
          @download="$emit('download', entry)"
          @select="$emit('select', entry)"
          @pin="$emit('pin', entry)"
        />
      </tbody>
    </table>
  </div>
</template>
