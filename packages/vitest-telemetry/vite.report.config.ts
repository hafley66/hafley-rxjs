import { renameSync } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Vite names the emitted html after the entry file (index.html); html.ts expects
// dist/report-template.html, so rename it once the bundle is written.
function renameToReportTemplate(): Plugin {
  return {
    name: 'rename-to-report-template',
    closeBundle() {
      renameSync(resolve(import.meta.dirname, 'dist/index.html'), resolve(import.meta.dirname, 'dist/report-template.html'))
    },
  }
}

// Builds src/report-app -> dist/report-template.html: one file, no external assets, no
// <script src> or <link href>. html.ts reads this file at runtime and substitutes the data blob.
export default defineConfig({
  root: resolve(import.meta.dirname, 'src/report-app'),
  plugins: [react(), viteSingleFile(), renameToReportTemplate()],
  build: {
    outDir: resolve(import.meta.dirname, 'dist'),
    emptyOutDir: false,
    rollupOptions: {
      input: resolve(import.meta.dirname, 'src/report-app/index.html'),
    },
  },
})
