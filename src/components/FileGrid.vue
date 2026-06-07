<script setup>
import FileCard from './FileCard.vue'

defineProps({ entries: { type: Array, default: () => [] } })
defineEmits(['open', 'preview', 'delete', 'rename', 'share', 'download'])
</script>

<template>
  <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3 pt-3">
    <FileCard
      v-for="entry in entries"
      :key="entry.Name"
      :entry="entry"
      @open="$emit('open', entry)"
      @preview="$emit('preview', entry)"
      @delete="$emit('delete', entry)"
      @rename="$emit('rename', entry)"
      @share="$emit('share', entry)"
      @download="$emit('download', entry)"
    />
  </div>
</template>
