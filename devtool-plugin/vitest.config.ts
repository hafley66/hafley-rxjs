import { defineConfig } from 'vitest/config';
import { rxjsHmrPlugin } from "./src/vite-plugin/1_rxjs_hmr_plugin"

export default defineConfig({
  plugins: [
    rxjsHmrPlugin({ debug: false }),
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
  },
});
