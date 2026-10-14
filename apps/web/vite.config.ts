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
        background_color: '#ffffff',
        theme_color: '#1a7f37',
        description: 'Point, price, basket. Spend vs budget through your trip.',
      },
      workbox: {
        // Step 4 wires runtime caching (catalog JSON, app shell).
        // Skeleton: precache only.
        globPatterns: ['**/*.{js,css,html,svg}'],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
  },
});
