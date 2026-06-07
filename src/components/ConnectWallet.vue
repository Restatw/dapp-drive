<script setup>
import { computed } from 'vue'
import { useIdentityStore } from '../stores/identity'

const identity = useIdentityStore()
const hasMetaMask = computed(() => typeof window.ethereum !== 'undefined')
</script>

<template>
  <div class="h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50 p-4">
    <div class="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm text-center border border-gray-100">

      <!-- Logo -->
      <div class="text-6xl mb-4 select-none">📦</div>
      <h1 class="text-2xl font-bold text-gray-800 mb-1">IPFS Drive</h1>
      <p class="text-sm text-gray-500 mb-8">
        Decentralized personal storage,<br>powered by your local IPFS node.
      </p>

      <!-- MetaMask not installed -->
      <div v-if="!hasMetaMask" class="rounded-xl bg-amber-50 border border-amber-200 p-4 mb-4">
        <p class="text-sm font-semibold text-amber-700 mb-1">MetaMask not detected</p>
        <p class="text-xs text-amber-600 mb-3">
          This app requires the MetaMask browser extension to authenticate your identity.
        </p>
        <a
          href="https://metamask.io/download/"
          target="_blank"
          rel="noopener"
          class="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 underline underline-offset-2 hover:text-amber-900 transition"
        >
          Install MetaMask
          <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
          </svg>
        </a>
      </div>

      <!-- Connect button -->
      <button
        v-else
        class="w-full flex items-center justify-center gap-3 px-5 py-3 rounded-xl font-semibold text-sm transition-all"
        :class="identity.isConnecting
          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
          : 'bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white shadow-md shadow-orange-200'"
        :disabled="identity.isConnecting"
        @click="identity.connect()"
      >
        <!-- MetaMask fox icon -->
        <svg class="w-5 h-5 shrink-0" viewBox="0 0 35 33" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M32.958 1L19.4 10.688l2.52-5.944L32.958 1z" fill="#E17726" stroke="#E17726" stroke-width=".25" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M2.042 1l13.44 9.78-2.4-5.836L2.042 1z" fill="#E27625" stroke="#E27625" stroke-width=".25" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M28.17 23.528l-3.6 5.52 7.704 2.12 2.208-7.508-6.312-.132z" fill="#E27625" stroke="#E27625" stroke-width=".25" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M.53 23.66l2.196 7.508 7.692-2.12-3.588-5.52L.53 23.66z" fill="#E27625" stroke="#E27625" stroke-width=".25" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M10.022 14.44l-2.14 3.236 7.62.348-.252-8.184-5.228 4.6z" fill="#E27625" stroke="#E27625" stroke-width=".25" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M24.978 14.44l-5.304-4.692-.168 8.276 7.608-.348-2.136-3.236z" fill="#E27625" stroke="#E27625" stroke-width=".25" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M10.418 29.048l4.572-2.232-3.948-3.084-.624 5.316z" fill="#E27625" stroke="#E27625" stroke-width=".25" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M20.01 26.816l4.56 2.232-.612-5.316-3.948 3.084z" fill="#E27625" stroke="#E27625" stroke-width=".25" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>{{ identity.isConnecting ? 'Waiting for MetaMask…' : 'Sign in with MetaMask' }}</span>
      </button>

      <!-- Error -->
      <Transition name="fade">
        <div v-if="identity.error" class="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
          <p class="text-xs text-red-600">{{ identity.error }}</p>
        </div>
      </Transition>

      <!-- SIWE explanation -->
      <p class="mt-6 text-xs text-gray-400 leading-relaxed">
        You'll be asked to sign a message to prove you own this wallet.<br>
        No transaction is made — signing is free.
      </p>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
