import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

const renameAdminHtmlToIndex = () => ({
  name: 'rename-admin-html-to-index',
  closeBundle() {
    const outDir = path.resolve(process.cwd(), 'dist-admin');
    const adminHtml = path.join(outDir, 'admin.html');
    const indexHtml = path.join(outDir, 'index.html');

    if (fs.existsSync(adminHtml)) {
      fs.renameSync(adminHtml, indexHtml);
    }
  },
});

export default defineConfig({
  plugins: [react(), renameAdminHtmlToIndex()],
  build: {
    outDir: 'dist-admin',
    rollupOptions: {
      input: 'admin.html',
    },
  },
});
