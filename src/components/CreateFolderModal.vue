<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const emit = defineEmits(['close', 'create'])
const name = ref('')
const input = ref(null)

onMounted(() => input.value?.focus())

function submit() {
  const trimmed = name.value.trim()
  if (trimmed) emit('create', trimmed)
}

function onKey(e) {
  if (e.key === 'Escape') emit('close')
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" @click.self="$emit('close')">
      <div class="bg-white rounded-2xl shadow-2xl p-6 w-80">
        <h3 class="text-base font-semibold text-gray-800 mb-4">New folder</h3>
        <input
          ref="input"
          v-model="name"
          type="text"
          placeholder="Folder name"
          maxlength="255"
          class="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          @keydown.enter="submit"
        />
        <div class="flex gap-2 mt-4 justify-end">
          <button
            class="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition"
            @click="$emit('close')"
          >Cancel</button>
          <button
            :disabled="!name.trim()"
            class="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
            @click="submit"
          >Create</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
