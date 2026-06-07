<script setup>
import FileCard from './FileCard.vue'
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
  <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3 pt-3">
    <FileCard
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
  </div>
</template>
