import { defineConfig } from 'vite';

export default defineConfig({
  base: '/pixel-dungeon-inn/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
  },
});
