import { build } from 'vite';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import react from '@vitejs/plugin-react';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

async function runBuild() {
  console.log('[Inspo Build] 1/2 Building Library & Service Worker...');
  // 1. Build Library & Service Worker
  await build({
    configFile: false,
    root: rootDir,
    base: './',
    plugins: [react()],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          library: resolve(rootDir, 'library.html'),
          'service-worker': resolve(rootDir, 'src/background/service-worker.ts'),
        },
        output: {
          entryFileNames: (chunkInfo) => {
            if (chunkInfo.name === 'service-worker') return 'service-worker.js';
            return 'assets/[name]-[hash].js';
          },
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]',
        },
      },
    },
  });

  console.log('[Inspo Build] 2/2 Building Standalone Content Script (IIFE)...');
  // 2. Build Content Script as Standalone IIFE (No chunk splitting, 100% self-contained)
  await build({
    configFile: false,
    root: rootDir,
    base: './',
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      lib: {
        entry: resolve(rootDir, 'src/content/index.ts'),
        name: 'InspoContent',
        formats: ['iife'],
        fileName: () => 'content.js',
      },
      rollupOptions: {
        output: {
          extend: true,
          inlineDynamicImports: true,
        },
      },
    },
  });

  // 3. Copy Manifest & Icons
  console.log('[Inspo Build] Copying manifest.json and icons...');
  const manifestSrc = resolve(rootDir, 'manifest.json');
  const manifestDist = resolve(rootDir, 'dist/manifest.json');
  if (fs.existsSync(manifestSrc)) {
    fs.copyFileSync(manifestSrc, manifestDist);
  }

  const iconsSrc = resolve(rootDir, 'public/icons');
  const iconsDist = resolve(rootDir, 'dist/icons');
  if (fs.existsSync(iconsSrc)) {
    fs.mkdirSync(iconsDist, { recursive: true });
    for (const file of fs.readdirSync(iconsSrc)) {
      fs.copyFileSync(resolve(iconsSrc, file), resolve(iconsDist, file));
    }
  }

  console.log('[Inspo Build] Build completed successfully!');
}

runBuild().catch((err) => {
  console.error('[Inspo Build Error]:', err);
  process.exit(1);
});
