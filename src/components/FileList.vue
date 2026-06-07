<script setup>
import FileRow from './FileRow.vue'

defineProps({ entries: { type: Array, default: () => [] } })
defineEmits(['open', 'preview', 'delete', 'rename', 'share', 'download'])
</script>

<template>
  <div class="mt-3 bg-white rounded-xl border border-gray-100 overflow-hidden">
    <table class="w-full text-sm">
      <thead>
        <tr class="border-b border-gray-100 bg-gray-50/50">
          <th class="text-left py-2 px-3 text-xs font-medium text-gray-500">Name</th>
          <th class="text-left py-2 px-3 text-xs font-medium text-gray-500">Size</th>
          <th class="py-2 px-3"></th>
        </tr>
      </thead>
      <tbody>
        <FileRow
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
      </tbody>
    </table>
  </div>
</template>
