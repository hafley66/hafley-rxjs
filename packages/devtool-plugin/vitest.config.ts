import { defineConfig } from 'vitest/config';
import {rxjsHmrPlugin} from './src/1_runtime_vite_plugin/1_rxjs_hmr_plugin'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [
    rxjsHmrPlugin({ debug: true }) as any,
    tsconfigPaths()
  ],
  optimizeDeps: {
    exclude: ["rxjs", "rxjs/operators"],
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
