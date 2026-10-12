import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, projectRoot, '');
  const apiPort = process.env.PORT ?? env.PORT ?? '4000';
  const apiTarget = process.env.VITE_API_PROXY_TARGET ?? `http://localhost:${apiPort}`;

  return {
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
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
