<script setup>
defineProps({ crumbs: { type: Array, default: () => [] } })
defineEmits(['navigate'])
</script>

<template>
  <nav class="flex items-center flex-wrap gap-0.5 text-sm min-w-0">
    <template v-for="(crumb, i) in crumbs" :key="crumb.path">
      <span v-if="i > 0" class="text-gray-300 mx-0.5">/</span>
      <button
        :class="[
          'px-1.5 py-0.5 rounded hover:bg-gray-100 transition max-w-[160px] truncate',
          i === crumbs.length - 1
            ? 'font-semibold text-gray-800 cursor-default hover:bg-transparent'
            : 'text-gray-500 hover:text-gray-800',
        ]"
        :disabled="i === crumbs.length - 1"
        @click="$emit('navigate', crumb.path)"
      >
        {{ crumb.name }}
      </button>
    </template>
  </nav>
</template>
