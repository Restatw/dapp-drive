<script setup>
import { ref } from 'vue'
import { useDriveStore } from '../stores/drive'
import { useIdentityStore } from '../stores/identity'
import { useIpfsStore } from '../stores/ipfs'

defineEmits(['upload', 'toggle-sidebar'])

const drive    = useDriveStore()
const identity = useIdentityStore()
const ipfs     = useIpfsStore()
const showMenu   = ref(false)
const ipnsCopied = ref(false)

async function copyIpnsId() {
  if (!identity.ipnsKeyId) return
  await navigator.clipboard.writeText(identity.ipnsKeyId)
  ipnsCopied.value = true
  setTimeout(() => { ipnsCopied.value = false }, 1500)
}

function openIdentityMenu(e) {
  e.stopPropagation()
  if (showMenu.value) { showMenu.value = false; return }
  showMenu.value = true
  setTimeout(() => {
    document.addEventListener('click', () => { showMenu.value = false }, { once: true })
  }, 0)
}
</script>

<template>
  <header class="relative bg-white border-b border-gray-200 px-3 py-2 flex items-center gap-2 z-[45] shadow-sm shrink-0">

    <!-- ── Hamburger (mobile only) ──────────────────────────── -->
    <button
      class="md:hidden p-1.5 rounded-lg text-gray-500 active:bg-gray-100 transition shrink-0"
      @click="$emit('toggle-sidebar')"
      aria-label="Menu"
    >
      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
      </svg>
    </button>

    <!-- ── Logo ─────────────────────────────────────────────── -->
    <div class="flex items-center gap-2 shrink-0">
      <span class="text-2xl select-none leading-none">📦</span>
      <span class="text-lg font-semibold text-gray-800 tracking-tight hidden sm:inline">IPFS Drive</span>
    </div>

    <!-- ── Search ────────────────────────────────────────────── -->
    <div class="flex-1 min-w-0">
      <div class="relative">
        <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
             fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
        <input
          v-model="drive.searchQuery"
          type="text"
          placeholder="Search…"
          class="w-full pl-9 pr-8 py-1.5 bg-gray-100 rounded-full text-sm
                 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
        />
        <button
          v-if="drive.searchQuery"
          class="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
          @click="drive.searchQuery = ''"
        >✕</button>
      </div>
    </div>

    <!-- ── Right controls ────────────────────────────────────── -->
    <div class="flex items-center gap-1.5 shrink-0">

      <!-- IPFS status: mobile=dot only, desktop=full pill -->
      <button
        :class="[
          'flex items-center gap-1.5 rounded-full border transition',
          'p-1.5 sm:px-2.5 sm:py-1.5',          /* mobile: square; desktop: pill */
          ipfs.connected
            ? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
            : 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100',
        ]"
        :title="ipfs.connected ? `Node: ${ipfs.nodeId}` : 'Tap to retry'"
        @click="!ipfs.connected && ipfs.checkConnection()"
      >
        <span
          class="w-2 h-2 rounded-full shrink-0"
          :class="ipfs.checking ? 'bg-yellow-400 animate-pulse'
                : ipfs.connected ? 'bg-green-500' : 'bg-red-500'"
        />
        <!-- label: hidden on mobile -->
        <span class="hidden sm:inline text-xs">
          {{ ipfs.checking ? 'Connecting…' : ipfs.connected ? 'IPFS' : 'Offline' }}
        </span>
      </button>

      <!-- Upload: mobile=icon, desktop=icon+label -->
      <button
        class="flex items-center gap-1.5 bg-blue-600 text-white rounded-full
               p-2 sm:px-4 sm:py-2
               hover:bg-blue-700 active:scale-95 transition-all"
        @click="$emit('upload')"
        aria-label="Upload"
      >
        <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
        </svg>
        <span class="hidden sm:inline text-sm font-medium">Upload</span>
      </button>

      <!-- Identity: mobile=avatar only, desktop=avatar+address+chevron -->
      <div class="relative">
        <button
          class="flex items-center gap-1.5 rounded-full border border-gray-200
                 p-0.5 sm:pl-0.5 sm:pr-2.5 sm:py-1
                 hover:bg-gray-50 active:bg-gray-100 transition"
          @click="openIdentityMenu"
        >
          <!-- Avatar -->
          <div
            class="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
            :style="{ background: `hsl(${parseInt(identity.address?.slice(2,4) || '0', 16) * 1.41}, 60%, 50%)` }"
          >
            {{ identity.address?.slice(2, 4).toUpperCase() }}
          </div>
          <!-- Address + chevron: desktop only -->
          <span class="hidden sm:inline font-mono text-xs text-gray-600 tracking-tight">
            {{ identity.shortAddress }}
          </span>
          <svg class="hidden sm:block w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
          </svg>
        </button>

        <!-- Dropdown (same for both) -->
        <div
          v-if="showMenu"
          class="absolute right-0 top-10 w-64 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 z-50"
          @click.stop
        >
          <!-- Full address -->
          <div class="px-4 py-2 border-b border-gray-100 mb-1">
            <p class="text-[10px] text-gray-400 mb-0.5">Signed in as</p>
            <p class="text-xs font-mono text-gray-700 break-all leading-snug">{{ identity.address }}</p>
          </div>
          <!-- IPNS ID -->
          <div class="px-4 py-2 border-b border-gray-100 mb-1">
            <p class="text-[10px] text-gray-400 mb-0.5">
              IPNS ID <span class="text-gray-300">(cross-machine sync)</span>
            </p>
            <div v-if="identity.ipnsKeyId" class="flex items-center gap-1.5 mt-0.5">
              <p class="text-xs font-mono text-gray-500 truncate flex-1">{{ identity.ipnsKeyId }}</p>
              <button
                class="shrink-0 text-[10px] text-blue-500 hover:text-blue-700 px-1.5 py-0.5 rounded hover:bg-blue-50 transition"
                @click="copyIpnsId"
              >{{ ipnsCopied ? '✓' : 'Copy' }}</button>
            </div>
            <p v-else class="text-xs text-gray-400 italic mt-0.5">Setting up…</p>
          </div>
          <!-- Sign out -->
          <button
            class="w-full flex items-center gap-2 px-4 py-2 text-xs text-red-600 hover:bg-red-50 transition"
            @click="identity.signOut(); showMenu = false"
          >
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
            </svg>
            Sign out
          </button>
        </div>
      </div>

    </div>
  </header>
</template>
