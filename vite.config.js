import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      // 'autoUpdate' silently updates the SW when a new build is deployed.
      registerType: 'autoUpdate',

      // Include all built assets in the precache manifest.
      includeAssets: ['favicon.ico', 'icons/*.png'],

      manifest: {
        name:             'IPFS Drive',
        short_name:       'IPFS Drive',
        description:      'Decentralized cloud storage on IPFS',
        theme_color:      '#2563eb',
        background_color: '#ffffff',
        display:          'standalone',
        start_url:        './',
        icons: [
          { src: 'icons/192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },

      workbox: {
        // App shell: cache-first for all built JS/CSS/HTML assets.
        // These are fingerprinted so they're safe to cache indefinitely.
        globPatterns: ['**/*.{js,css,html,woff2}'],

        // Runtime caching rules applied by the Service Worker at runtime.
        runtimeCaching: [
          {
            // IPFS file content: immutable by CID → cache forever once fetched.
            urlPattern: /\/ipfs\/[a-zA-Z0-9]+/,
            handler:    'CacheFirst',
            options: {
              cacheName: 'ipfs-blobs',
              expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
          {
            // IPFS API directory listings: network first, fall back to cache.
            // (IndexedDB handles the more structured fallback in drive.js;
            //  this layer catches raw fetch failures at the SW level.)
            urlPattern: /\/api\/v0\/files\/(ls|stat)/,
            handler:    'NetworkFirst',
            options: {
              cacheName:        'ipfs-api',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 },
            },
          },
        ],
      },
    }),
  ],

  // './' makes all asset paths relative so the build works under any IPFS path/subdomain.
  base: './',

  server: {
    proxy: {
      '/api/v0': { target: 'http://127.0.0.1:5001', changeOrigin: true },
      '/ipfs':   { target: 'http://127.0.0.1:8080', changeOrigin: true },
    },
  },
})
