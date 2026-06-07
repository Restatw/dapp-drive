<script setup>
import { useIpfsStore } from '../stores/ipfs'

const ipfs = useIpfsStore()
</script>

<template>
  <button
    :class="[
      'flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full border transition',
      ipfs.connected
        ? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
        : 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100',
    ]"
    :title="ipfs.connected ? `Node: ${ipfs.nodeId}` : 'Click to retry connection'"
    @click="!ipfs.connected && ipfs.checkConnection()"
  >
    <span
      class="w-1.5 h-1.5 rounded-full"
      :class="ipfs.checking ? 'bg-yellow-400 animate-pulse' : ipfs.connected ? 'bg-green-500' : 'bg-red-500'"
    ></span>
    <span>{{ ipfs.checking ? 'Connecting…' : ipfs.connected ? 'IPFS' : 'Offline' }}</span>
  </button>
</template>
