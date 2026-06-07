<script setup>
import { watch, onMounted, onUnmounted } from 'vue'
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
  ipfs.startPolling()       // keep NodeStatus in sync every 30 s
})

onUnmounted(() => {
  ipfs.stopPolling()
})

// When identity becomes authenticated, trigger background IPNS check
// (after a short delay so the UI has time to render first)
watch(() => identity.isAuth, isAuth => {
  if (isAuth) {
    setTimeout(() => drive.checkRemoteSync(), 4000)
  }
})

// When IPFS comes back online AND the key hasn't been imported yet,
// retry ensureIpfsKey() automatically (handles the case where the user
// was offline during login so the key import silently failed).
watch(() => ipfs.connected, connected => {
  if (connected && identity.isAuth && !identity.ipnsKeyId) {
    identity.ensureIpfsKey()
  }
})
</script>

<template>
  <ConnectWallet v-if="!identity.isAuth" />
  <router-view v-else />
</template>
