import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiProxy = {
  '/api': {
    target: 'http://127.0.0.1:5000',
    changeOrigin: true,
  },
};

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // For Cloudflare Quick Tunnels, set VITE_EXTRA_ALLOWED_HOST to the exact
    // generated hostname; never disable Vite's host validation globally.
    allowedHosts: [
      'portions-sally-foo-fin.trycloudflare.com',
      ...(process.env.VITE_EXTRA_ALLOWED_HOST ? [process.env.VITE_EXTRA_ALLOWED_HOST] : []),
    ],
    proxy: apiProxy,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: true,
    proxy: apiProxy,
  },
});
