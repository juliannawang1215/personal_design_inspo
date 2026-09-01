import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import fs from 'node:fs';

function copyExtensionAssets() {
  return {
    name: 'copy-extension-assets',
    closeBundle() {
      // 1. Copy manifest.json to dist
      if (fs.existsSync(resolve(__dirname, 'manifest.json'))) {
        fs.copyFileSync(
          resolve(__dirname, 'manifest.json'),
          resolve(__dirname, 'dist/manifest.json')
        );
      }

      // 2. Ensure dist/icons directory exists and copy icons
      const srcIcons = resolve(__dirname, 'public/icons');
      const distIcons = resolve(__dirname, 'dist/icons');
      if (fs.existsSync(srcIcons)) {
        fs.mkdirSync(distIcons, { recursive: true });
        for (const file of fs.readdirSync(srcIcons)) {
          fs.copyFileSync(resolve(srcIcons, file), resolve(distIcons, file));
        }
      }
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), copyExtensionAssets()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        library: resolve(__dirname, 'library.html'),
        content: resolve(__dirname, 'src/content/index.ts'),
        'service-worker': resolve(__dirname, 'src/background/service-worker.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'content') return 'content.js';
          if (chunkInfo.name === 'service-worker') return 'service-worker.js';
          return 'assets/[name]-[hash].js';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
});
