import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Tally — shopping assistant',
        short_name: 'Tally',
        start_url: '/',
        display: 'standalone',
        background_color: '#fbfbef',
        theme_color: '#1a7f37',
        description: 'Point, price, basket. Spend vs budget through your trip.',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        // App shell precaches here; the per-store price catalog caches in
        // Dexie (see src/offline/) so it survives without a service worker.
        globPatterns: ['**/*.{js,css,html,svg,png}'],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
  },
});
