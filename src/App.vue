<script setup>
import { watch, onMounted } from 'vue'
import { useIpfsStore } from './stores/ipfs'
import { useIdentityStore } from './stores/identity'
import { useDriveStore } from './stores/drive'
import ConnectWallet from './components/ConnectWallet.vue'

const ipfs     = useIpfsStore()
const identity = useIdentityStore()
const drive    = useDriveStore()

onMounted(() => {
  identity.restoreSession()
  identity.watchAccountChanges()
  ipfs.checkConnection()
})

// When identity becomes authenticated, trigger background IPNS check
// (after a short delay so the UI has time to render first)
watch(() => identity.isAuth, isAuth => {
  if (isAuth) {
    setTimeout(() => drive.checkRemoteSync(), 4000)
  }
})
</script>

<template>
  <ConnectWallet v-if="!identity.isAuth" />
  <router-view v-else />
</template>
