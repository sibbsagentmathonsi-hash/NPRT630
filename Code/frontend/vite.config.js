import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        worker: 'index.html',
        admin: 'admin.html',
      },
    },
  },
  server: {
    port: 5175,
    host: '0.0.0.0',
  },
});
