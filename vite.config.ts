import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
    // Optional: set VITE_API_BASE_URL=/api/v1 in development to proxy through Vite
    // instead of calling the canonical API URL directly.
    proxy: {
      '/api': {
        target: 'https://api.iconicwealth.tfnsolutions.us',
        changeOrigin: true,
        secure: true,
      },
    },
  },
});
