<script setup>
defineProps({ uploads: { type: Array, default: () => [] } })
</script>

<template>
  <Teleport to="body">
    <div class="fixed bottom-5 right-5 z-50 flex flex-col gap-2 w-72 pointer-events-none">
      <TransitionGroup name="toast">
        <div
          v-for="u in uploads"
          :key="u.name + u.progress"
          class="bg-white rounded-xl shadow-xl border border-gray-200 p-3 pointer-events-auto"
        >
          <div class="flex items-center gap-2 mb-1.5">
            <svg class="w-4 h-4 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <span class="text-xs font-medium text-gray-700 truncate flex-1">{{ u.name }}</span>
            <span v-if="u.done" class="text-xs text-green-600 font-medium">Done ✓</span>
            <span v-else-if="u.error" class="text-xs text-red-500">Failed</span>
            <span v-else class="text-xs text-gray-400">{{ u.progress }}%</span>
          </div>
          <div class="h-1 bg-gray-100 rounded-full overflow-hidden">
            <div
              class="h-full rounded-full transition-all duration-300"
              :class="u.error ? 'bg-red-400' : u.done ? 'bg-green-500' : 'bg-blue-500'"
              :style="{ width: `${u.progress}%` }"
            />
          </div>
          <p v-if="u.error" class="text-xs text-red-500 mt-1">{{ u.error }}</p>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-enter-active { transition: all 0.25s ease; }
.toast-leave-active { transition: all 0.2s ease; }
.toast-enter-from { opacity: 0; transform: translateY(12px); }
.toast-leave-to   { opacity: 0; transform: translateX(110%); }
</style>
