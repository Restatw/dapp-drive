<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useIpfsStore } from '../stores/ipfs'
import { getFileType } from '../utils/fileType'

const props = defineProps({
  entry: { type: Object, required: true },
  currentPath: { type: String, default: '/' },
})
const emit = defineEmits(['close', 'download'])

const ipfs = useIpfsStore()
const cid = ref(props.entry.Hash || '')
const textContent = ref('')
const contentLoading = ref(false)
const cidLoading = ref(false)

const fileType = computed(() => getFileType(props.entry.Name))
const gatewayUrl = computed(() => cid.value ? ipfs.getGatewayUrl(cid.value) : '')

const entryPath = computed(() =>
  props.currentPath === '/' ? '/' + props.entry.Name : props.currentPath + '/' + props.entry.Name
)

onMounted(async () => {
  // Fetch CID if not already in entry
  if (!cid.value) {
    cidLoading.value = true
    const s = await ipfs.stat(entryPath.value)
    if (s) cid.value = s.Hash
    cidLoading.value = false
  }
})

// Fetch text content once CID is known
watch(cid, async val => {
  if (!val) return
  if (!['text', 'code'].includes(fileType.value)) return
  contentLoading.value = true
  try {
    const resp = await fetch(ipfs.getGatewayUrl(val))
    textContent.value = await resp.text()
  } catch {
    textContent.value = '— failed to load content —'
  } finally {
    contentLoading.value = false
  }
}, { immediate: true })

function onKey(e) { if (e.key === 'Escape') emit('close') }
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      @click.self="$emit('close')"
    >
      <div class="bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-4xl max-h-[92vh] overflow-hidden">

        <!-- Header -->
        <div class="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 shrink-0">
          <h3 class="text-sm font-semibold text-gray-800 truncate pr-4" :title="entry.Name">
            {{ entry.Name }}
          </h3>
          <div class="flex items-center gap-2 shrink-0">
            <button
              class="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition flex items-center gap-1.5"
              @click="$emit('download', entry)"
            >
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
              </svg>
              Download
            </button>
            <button
              class="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-500"
              @click="$emit('close')"
            >
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Body -->
        <div class="flex-1 min-h-0 flex items-center justify-center overflow-hidden bg-gray-50">
          <!-- Loading CID -->
          <div v-if="cidLoading || contentLoading" class="text-gray-400 text-sm">Loading…</div>

          <!-- Image -->
          <img
            v-else-if="fileType === 'image' && gatewayUrl"
            :src="gatewayUrl"
            :alt="entry.Name"
            class="max-w-full max-h-full object-contain"
          />

          <!-- Video -->
          <video
            v-else-if="fileType === 'video' && gatewayUrl"
            :src="gatewayUrl"
            controls
            class="max-w-full max-h-full"
          />

          <!-- Audio -->
          <div v-else-if="fileType === 'audio' && gatewayUrl" class="w-full max-w-lg p-8 text-center">
            <div class="text-7xl mb-6 select-none">🎵</div>
            <p class="text-sm font-medium text-gray-700 mb-4 truncate">{{ entry.Name }}</p>
            <audio :src="gatewayUrl" controls class="w-full" />
          </div>

          <!-- PDF -->
          <iframe
            v-else-if="fileType === 'pdf' && gatewayUrl"
            :src="gatewayUrl"
            class="w-full h-full"
            style="min-height: 60vh"
          />

          <!-- Text / Code -->
          <div v-else-if="['text', 'code'].includes(fileType)" class="w-full h-full overflow-auto p-0">
            <pre class="text-xs font-mono text-gray-800 bg-gray-50 p-5 min-h-full whitespace-pre-wrap break-words leading-relaxed">{{ textContent || '(empty file)' }}</pre>
          </div>

          <!-- No preview -->
          <div v-else class="text-center text-gray-400 p-8">
            <div class="text-6xl mb-4 select-none">📎</div>
            <p class="text-sm">No preview available for this file type</p>
            <button
              class="mt-4 px-4 py-2 text-sm font-medium text-blue-600 border border-blue-200 rounded-xl hover:bg-blue-50 transition"
              @click="$emit('download', entry)"
            >Download file</button>
          </div>
        </div>

        <!-- Footer: CID -->
        <div v-if="cid" class="px-5 py-2.5 border-t border-gray-100 flex items-center gap-2 shrink-0">
          <span class="text-xs text-gray-400 shrink-0">CID:</span>
          <code class="text-xs font-mono text-gray-500 truncate flex-1 select-all">{{ cid }}</code>
        </div>
      </div>
    </div>
  </Teleport>
</template>
