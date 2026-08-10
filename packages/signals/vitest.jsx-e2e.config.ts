import { defineConfig } from "vitest/config"
import { signalsJsx } from "./src/vite-plugin.ts"

// E2E: the signalsJsx plugin transforms this run's JSX. Plain components in the
// test file get auto-wrapped at compile time. jsdom renders them.
export default defineConfig({
  plugins: [signalsJsx()],
  esbuild: { jsx: "automatic", jsxImportSource: "react" },
  test: {
    environment: "jsdom",
    include: ["src/*.jsx-e2e.test.tsx"],
  },
})
