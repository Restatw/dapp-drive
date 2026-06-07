import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  // './' makes all asset paths relative so the build works under any IPFS path/subdomain
  base: './',
  server: {
    proxy: {
      // Requires IPFS CORS to be configured:
      //   ipfs config --json API.HTTPHeaders.Access-Control-Allow-Origin '["*"]'
      //   ipfs config --json API.HTTPHeaders.Access-Control-Allow-Methods '["GET","POST","PUT"]'
      '/api/v0': { target: 'http://127.0.0.1:5001', changeOrigin: true },
      '/ipfs':   { target: 'http://127.0.0.1:8080', changeOrigin: true },
    },
  },
})
