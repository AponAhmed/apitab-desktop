import { resolve } from 'path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  main: {
    // electron-store ships ESM-only (no CommonJS export condition), so a
    // plain runtime `require('electron-store')` doesn't unwrap its default
    // export. Bundling it (instead of externalizing) lets Rollup resolve
    // that at build time.
    plugins: [externalizeDepsPlugin({ exclude: ['electron-store'] })],
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
      },
    },
  },
  renderer: {
    root: 'src/renderer',
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/renderer/index.html'),
          // Sandboxed page (script iframe target) — see scriptRunner.ts.
          sandbox: resolve('src/renderer/sandbox.html'),
        },
      },
    },
    resolve: {
      alias: {
        // Matches the extension's `@/*` alias so ported UI code
        // (components/, features/, stores/, utils/, types/) drops in with
        // its imports unchanged.
        '@': resolve('src/renderer/src'),
        '@shared': resolve('src/shared'),
      },
    },
    plugins: [react(), tailwindcss()],
  },
});
