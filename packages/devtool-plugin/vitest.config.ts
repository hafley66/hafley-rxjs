import { defineConfig } from 'vitest/config';
import {rxjsHmrPlugin} from './src/1_runtime_vite_plugin/1_rxjs_hmr_plugin'

export default defineConfig({
  plugins: [
    rxjsHmrPlugin({ debug: false }) as any,
  ],
  optimizeDeps: {
    exclude: ["rxjs"],
  },
  test: {
    globals: true,
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/*.browser.test.{ts,tsx}',
    ],
    // Integration tests that start Vite servers must run sequentially
    // Vitest 4: fileParallelism replaces poolOptions.threads.singleThread
    fileParallelism: false,
  },
});
