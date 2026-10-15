import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// VITE_BASE lets the same source be hosted at a subpath (GitHub Pages: /laval-zoning-atlas/).
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  build: { outDir: 'dist', chunkSizeWarningLimit: 1800 },
});
