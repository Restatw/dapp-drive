<script setup>
import { onMounted } from 'vue'
import { useIpfsStore } from './stores/ipfs'

const ipfs = useIpfsStore()
onMounted(() => ipfs.checkConnection())
</script>

<template>
  <router-view />
</template>
