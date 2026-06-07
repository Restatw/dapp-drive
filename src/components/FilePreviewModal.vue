<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useIpfsStore } from '../stores/ipfs'
import { useDriveStore } from '../stores/drive'
import { getFileType, getFileIcon, formatSize } from '../utils/fileType'

const props = defineProps({
  entries:      { type: Array,  required: true },   // file-only list
  initialIndex: { type: Number, required: true },
  currentPath:  { type: String, default: '/' },
})
const emit = defineEmits(['close', 'download'])

const ipfs  = useIpfsStore()
const drive = useDriveStore()

// ── Navigation ────────────────────────────────────────────────────
const idx     = ref(props.initialIndex)
const entry   = computed(() => props.entries[idx.value] ?? null)
const hasPrev = computed(() => idx.value > 0)
const hasNext = computed(() => idx.value < props.entries.length - 1)
const posLabel = computed(() => `${idx.value + 1} / ${props.entries.length}`)

function prev() { if (hasPrev.value) idx.value-- }
function next() { if (hasNext.value) idx.value++ }

// ── Per-file state (reset on navigation) ─────────────────────────
const cid          = ref('')
const textContent  = ref('')
const loading      = ref(false)
const loadError    = ref(false)
const imgZoom   = ref(1)
const imgFit    = ref(true)    // true = contain; false = zoom with scroll
const imgRotate = ref(0)

const fileType   = computed(() => entry.value ? getFileType(entry.value.Name) : '')
const gatewayUrl = computed(() => cid.value ? ipfs.getGatewayUrl(cid.value) : '')

function entryRelPath(e) {
  return props.currentPath === '/' ? '/' + e.Name : props.currentPath + '/' + e.Name
}

watch(idx, () => {
  cid.value = ''
  textContent.value = ''
  loadError.value = false
  imgZoom.value = 1
  imgFit.value = true
  imgRotate.value = 0
  loadEntry()
}, { immediate: true })

async function loadEntry() {
  const e = entry.value
  if (!e) return
  loading.value = true
  try {
    let hash = e.Hash
    if (!hash) {
      const s = await drive.statEntry(entryRelPath(e))
      if (s) hash = s.Hash
    }
    cid.value = hash || ''

    if (hash && ['text', 'code'].includes(fileType.value)) {
      const resp = await fetch(ipfs.getGatewayUrl(hash))
      if (!resp.ok) throw new Error('fetch failed')
      textContent.value = await resp.text()
    }
  } catch {
    loadError.value = true
  } finally {
    loading.value = false
  }
}

// ── Image controls ────────────────────────────────────────────────
function zoomIn()  { imgZoom.value = Math.min(5,    +(imgZoom.value + 0.25).toFixed(2)); imgFit.value = false }
function zoomOut() { imgZoom.value = Math.max(0.25, +(imgZoom.value - 0.25).toFixed(2)); imgFit.value = false }
function zoomFit() { imgZoom.value = 1; imgFit.value = true }
function rotate()  { imgRotate.value = (imgRotate.value + 90) % 360 }

// ── Copy helpers ──────────────────────────────────────────────────
const copied = ref('')   // which thing was just copied: 'cid' | 'url' | 'text'

async function doCopy(text, label) {
  try {
    await navigator.clipboard.writeText(text)
    copied.value = label
    setTimeout(() => { copied.value = '' }, 1500)
  } catch { /* ignore */ }
}

const copyCid  = () => doCopy(cid.value,                    'cid')
const copyUrl  = () => doCopy(gatewayUrl.value,             'url')
const copyText = () => doCopy(textContent.value,            'text')
const openGw   = () => gatewayUrl.value && window.open(gatewayUrl.value, '_blank')

// ── Keyboard ──────────────────────────────────────────────────────
function onKey(e) {
  if (e.key === 'Escape')                         { emit('close'); return }
  if (e.key === 'ArrowLeft'  || e.key === 'a')    { prev(); return }
  if (e.key === 'ArrowRight' || e.key === 'd')    { next(); return }
  if (fileType.value === 'image') {
    if (e.key === '+' || e.key === '=')           zoomIn()
    if (e.key === '-')                            zoomOut()
    if (e.key === '0')                            zoomFit()
    if (e.key === 'r')                            rotate()
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3"
      @click.self="$emit('close')"
    >
      <!-- Modal — fixed size regardless of content type -->
      <div class="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style="width: min(92vw, 1100px); height: min(90vh, 780px)">

        <!-- ── Header ──────────────────────────────────────────── -->
        <div class="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 shrink-0 overflow-x-auto">

          <!-- Prev / counter / Next -->
          <div class="flex items-center gap-1 shrink-0">
            <button
              class="p-1.5 rounded-lg transition"
              :class="hasPrev ? 'text-gray-500 hover:bg-gray-100' : 'text-gray-200 cursor-default'"
              :disabled="!hasPrev" title="Previous (←)" @click="prev"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
              </svg>
            </button>
            <span class="text-xs text-gray-400 w-12 text-center tabular-nums select-none">{{ posLabel }}</span>
            <button
              class="p-1.5 rounded-lg transition"
              :class="hasNext ? 'text-gray-500 hover:bg-gray-100' : 'text-gray-200 cursor-default'"
              :disabled="!hasNext" title="Next (→)" @click="next"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
              </svg>
            </button>
          </div>

          <div class="w-px h-5 bg-gray-200 shrink-0 mx-1" />

          <!-- Icon + filename -->
          <span class="text-base shrink-0 select-none">{{ getFileIcon(entry) }}</span>
          <h3 class="text-sm font-semibold text-gray-800 truncate min-w-0" style="flex: 1 1 60px" :title="entry?.Name">
            {{ entry?.Name }}
          </h3>

          <!-- File size -->
          <span v-if="entry?.Size" class="text-xs text-gray-400 shrink-0">
            {{ formatSize(entry.Size) }}
          </span>

          <div class="w-px h-5 bg-gray-200 shrink-0 mx-1" />

          <!-- ── Type-specific toolbar ────────────────────────── -->

          <!-- Image tools -->
          <template v-if="fileType === 'image'">
            <button class="toolbar-btn" title="Zoom out (−)" @click="zoomOut">
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7"/></svg>
            </button>
            <button
              class="text-xs font-mono text-gray-500 px-1.5 py-1 rounded hover:bg-gray-100 transition w-12 text-center shrink-0"
              title="Reset to fit (0)" @click="zoomFit"
            >{{ imgFit ? 'Fit' : (imgZoom * 100).toFixed(0) + '%' }}</button>
            <button class="toolbar-btn" title="Zoom in (+)" @click="zoomIn">
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"/></svg>
            </button>
            <button class="toolbar-btn" title="Rotate 90° (r)" @click="rotate">
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            </button>
            <button class="toolbar-btn" title="Open in browser" @click="openGw">
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
            </button>
          </template>

          <!-- Text / Code tools -->
          <template v-else-if="['text','code'].includes(fileType)">
            <button class="toolbar-btn-label" @click="copyText">
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
              {{ copied === 'text' ? '✓ Copied' : 'Copy' }}
            </button>
          </template>

          <!-- PDF / Video: open in browser -->
          <template v-else-if="['pdf','video'].includes(fileType)">
            <button class="toolbar-btn-label" @click="openGw">
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
              Open
            </button>
          </template>

          <div class="w-px h-5 bg-gray-200 shrink-0 mx-1" />

          <!-- Download (always) -->
          <button class="toolbar-btn-label shrink-0" title="Download" @click="$emit('download', entry)">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
            Download
          </button>

          <!-- Close -->
          <button class="toolbar-btn ml-1 shrink-0" title="Close (Esc)" @click="$emit('close')">
            <svg style="width:18px;height:18px" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <!-- ── Body ─────────────────────────────────────────────── -->
        <div class="relative flex-1 min-h-0 bg-gray-50 overflow-hidden">

          <!-- Loading -->
          <div v-if="loading" class="absolute inset-0 flex items-center justify-center">
            <div class="w-8 h-8 border-[3px] border-blue-200 border-t-blue-500 rounded-full animate-spin"/>
          </div>

          <!-- Error -->
          <div v-else-if="loadError" class="absolute inset-0 flex flex-col items-center justify-center text-gray-400 gap-3">
            <span class="text-5xl select-none">⚠️</span>
            <p class="text-sm">Failed to load file</p>
            <button class="text-xs text-blue-500 hover:underline" @click="loadEntry">Retry</button>
          </div>

          <!-- ── Image ────────────────────────────────────────── -->
          <!-- Fit mode: image is contained inside the panel, centered.         -->
          <!-- Zoom mode: panel scrolls; image expands to imgZoom × natural size -->
          <div
            v-else-if="fileType === 'image' && gatewayUrl"
            :class="imgFit
              ? 'w-full h-full flex items-center justify-center overflow-hidden'
              : 'w-full h-full overflow-auto'"
          >
            <!-- Fit mode -->
            <img
              v-if="imgFit"
              :src="gatewayUrl"
              :alt="entry?.Name"
              :style="{
                maxWidth:  '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                transform: imgRotate ? `rotate(${imgRotate}deg)` : undefined,
                transition: 'transform 0.15s ease',
              }"
              class="select-none"
              draggable="false"
            />
            <!-- Zoom mode: scale via transform so scroll works naturally -->
            <div
              v-else
              class="flex items-center justify-center p-4"
              style="min-width: 100%; min-height: 100%"
            >
              <img
                :src="gatewayUrl"
                :alt="entry?.Name"
                :style="{
                  transform: `scale(${imgZoom})${imgRotate ? ` rotate(${imgRotate}deg)` : ''}`,
                  transformOrigin: 'center center',
                  transition: 'transform 0.15s ease',
                }"
                class="select-none block"
                draggable="false"
              />
            </div>
          </div>

          <!-- ── Video ────────────────────────────────────────── -->
          <div v-else-if="fileType === 'video' && gatewayUrl"
            class="w-full h-full flex items-center justify-center bg-black">
            <video
              :src="gatewayUrl"
              controls
              class="max-w-full max-h-full"
              style="outline: none"
            />
          </div>

          <!-- ── Audio ────────────────────────────────────────── -->
          <div v-else-if="fileType === 'audio' && gatewayUrl"
            class="w-full h-full flex flex-col items-center justify-center gap-6 p-8">
            <div class="text-8xl select-none">🎵</div>
            <p class="text-base font-semibold text-gray-700 text-center">{{ entry?.Name }}</p>
            <audio :src="gatewayUrl" controls class="w-full max-w-md" />
          </div>

          <!-- ── PDF ──────────────────────────────────────────── -->
          <iframe
            v-else-if="fileType === 'pdf' && gatewayUrl"
            :src="gatewayUrl"
            class="w-full h-full border-0"
          />

          <!-- ── Text / Code ───────────────────────────────────── -->
          <div v-else-if="['text','code'].includes(fileType)"
            class="w-full h-full overflow-auto">
            <pre class="text-xs font-mono text-gray-800 p-5 whitespace-pre-wrap break-words leading-relaxed min-h-full">{{ textContent || '(empty file)' }}</pre>
          </div>

          <!-- ── No preview ────────────────────────────────────── -->
          <div v-else class="w-full h-full flex flex-col items-center justify-center gap-4 text-gray-400">
            <span class="text-7xl select-none">📎</span>
            <p class="text-sm">No preview available for this file type</p>
            <button
              class="px-4 py-2 text-sm font-medium text-blue-600 border border-blue-200 rounded-xl hover:bg-blue-50 transition"
              @click="$emit('download', entry)"
            >Download to open</button>
          </div>

          <!-- Prev / Next side arrows (inside body) -->
          <button
            v-if="hasPrev"
            class="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/30 hover:bg-black/50 text-white transition backdrop-blur-sm"
            @click="prev"
          >
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7"/>
            </svg>
          </button>
          <button
            v-if="hasNext"
            class="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/30 hover:bg-black/50 text-white transition backdrop-blur-sm"
            @click="next"
          >
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"/>
            </svg>
          </button>
        </div>

        <!-- ── Footer: CID + copy actions ──────────────────────── -->
        <div v-if="cid" class="px-4 py-2 border-t border-gray-100 flex items-center gap-2 shrink-0 bg-white min-w-0">
          <span class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider shrink-0">CID</span>
          <code class="text-xs font-mono text-gray-500 truncate flex-1 min-w-0 select-all">{{ cid }}</code>
          <button
            class="shrink-0 text-xs text-gray-400 hover:text-gray-600 px-2 py-0.5 rounded hover:bg-gray-100 transition whitespace-nowrap"
            @click="copyCid"
          >{{ copied === 'cid' ? '✓ Copied' : 'Copy CID' }}</button>
          <button
            class="shrink-0 text-xs text-gray-400 hover:text-gray-600 px-2 py-0.5 rounded hover:bg-gray-100 transition whitespace-nowrap"
            @click="copyUrl"
          >{{ copied === 'url' ? '✓ Copied' : 'Copy URL' }}</button>
        </div>

      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.toolbar-btn {
  @apply p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition shrink-0;
}
.toolbar-btn-label {
  @apply flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 rounded-lg hover:bg-gray-100 transition shrink-0;
}
</style>
