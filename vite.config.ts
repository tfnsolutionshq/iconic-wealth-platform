import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
    // Allows VITE_API_BASE_URL=/api/v1 in development, so the browser never makes a
    // cross-origin request and the API host is configured in exactly one place.
    proxy: {
      '/api': {
        target: 'https://api.iconicwealth.tfnsolutions.us',
        changeOrigin: true,
        secure: true,
      },
    },
  },
});
