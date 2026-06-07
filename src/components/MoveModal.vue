<script setup>
import { ref, computed, onMounted } from 'vue'
import { useIpfsStore } from '../stores/ipfs'
import { useIdentityStore } from '../stores/identity'

const props = defineProps({
  count:         { type: Number,  required: true },
  sourcePath:    { type: String,  required: true },  // relative path
  selectedNames: { type: Array,   default: () => [] },
})
const emit = defineEmits(['confirm', 'close'])

const ipfs     = useIpfsStore()
const identity = useIdentityStore()
// browsePath is the user-visible relative path (same coordinate system as drive.currentPath)
const browsePath = ref('/')
const folders    = ref([])
const loading    = ref(false)

// Convert relative → absolute MFS path for IPFS calls
function toMfs(relativePath) {
  const root = identity.rootPath
  return relativePath === '/' ? root : root + relativePath
}

// Breadcrumbs for the browse path inside modal
const crumbs = computed(() => {
  const parts = browsePath.value.split('/').filter(Boolean)
  const list = [{ name: 'My Drive', path: '/' }]
  let acc = ''
  for (const p of parts) { acc += '/' + p; list.push({ name: p, path: acc }) }
  return list
})

async function loadFolders(relativePath) {
  loading.value    = true
  browsePath.value = relativePath
  try {
    const all     = await ipfs.listFiles(toMfs(relativePath))
    folders.value  = all.filter(e => e.Type === 1)
  } catch {
    folders.value = []
  } finally {
    loading.value = false
  }
}

function enterFolder(name) {
  const newPath = browsePath.value === '/' ? '/' + name : browsePath.value + '/' + name
  loadFolders(newPath)
}

// Folder is disabled if it would create a cycle (selected folder at same level)
function isDisabled(name) {
  return props.sourcePath === browsePath.value && props.selectedNames.includes(name)
}

const canConfirm = computed(() => browsePath.value !== props.sourcePath)

function onKey(e) { if (e.key === 'Escape') emit('close') }
onMounted(() => {
  window.addEventListener('keydown', onKey)
  loadFolders('/')
})
import { onUnmounted } from 'vue'
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      @click.self="$emit('close')"
    >
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden">

        <!-- Header -->
        <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 class="text-sm font-semibold text-gray-800">
            Move {{ count }} item{{ count !== 1 ? 's' : '' }} to…
          </h3>
          <button class="p-1 text-gray-400 hover:text-gray-600 transition" @click="$emit('close')">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <!-- Breadcrumb nav -->
        <div class="px-5 py-2 bg-gray-50 border-b border-gray-100 flex items-center gap-1 flex-wrap min-h-[36px]">
          <template v-for="(crumb, i) in crumbs" :key="crumb.path">
            <button
              class="text-xs text-gray-500 hover:text-blue-600 transition truncate max-w-[100px]"
              :class="i === crumbs.length - 1 ? 'font-semibold text-gray-700 cursor-default pointer-events-none' : ''"
              @click="loadFolders(crumb.path)"
            >{{ crumb.name }}</button>
            <span v-if="i < crumbs.length - 1" class="text-gray-300 text-xs">/</span>
          </template>
        </div>

        <!-- Folder list -->
        <div class="overflow-y-auto" style="min-height: 120px; max-height: 260px">
          <div v-if="loading" class="p-6 text-center text-sm text-gray-400">Loading…</div>
          <div v-else-if="folders.length === 0" class="p-6 text-center text-sm text-gray-400">
            No subfolders here
          </div>
          <button
            v-for="f in folders"
            :key="f.Name"
            class="w-full flex items-center gap-3 px-5 py-2.5 text-sm text-left transition"
            :class="isDisabled(f.Name)
              ? 'text-gray-300 cursor-not-allowed'
              : 'text-gray-700 hover:bg-blue-50'"
            :disabled="isDisabled(f.Name)"
            @click="!isDisabled(f.Name) && enterFolder(f.Name)"
          >
            <span class="text-xl shrink-0">📁</span>
            <span class="flex-1 truncate">{{ f.Name }}</span>
            <svg class="w-4 h-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
            </svg>
          </button>
        </div>

        <!-- Footer -->
        <div class="px-5 py-3.5 border-t border-gray-100 flex items-center justify-between gap-3">
          <span class="text-xs text-gray-400 truncate flex-1">
            → {{ browsePath === '/' ? 'My Drive' : browsePath }}
          </span>
          <div class="flex gap-2 shrink-0">
            <button
              class="px-3 py-1.5 text-xs font-medium text-gray-600 rounded-lg hover:bg-gray-100 transition"
              @click="$emit('close')"
            >Cancel</button>
            <button
              class="px-3 py-1.5 text-xs font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition disabled:opacity-40 disabled:cursor-not-allowed"
              :disabled="!canConfirm"
              @click="$emit('confirm', browsePath)"
            >Move here</button>
          </div>
        </div>

      </div>
    </div>
  </Teleport>
</template>
