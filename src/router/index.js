import { createRouter, createWebHashHistory } from 'vue-router'
import DriveView from '../views/DriveView.vue'

export default createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', component: DriveView, name: 'drive' },
  ],
})
