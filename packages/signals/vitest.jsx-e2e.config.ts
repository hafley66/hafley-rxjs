import { defineConfig } from "vitest/config"
import { signalsJsx } from "./src/vite-plugin.ts"

// E2E on vite 8 native JSX (esbuild automatic runtime). No @vitejs/plugin-react
// (babel) — signalsJsx() redirects the jsx-runtime import the compiler emits.
export default defineConfig({
  plugins: [signalsJsx()],
  esbuild: { jsx: "automatic", jsxImportSource: "react" },
  test: {
    environment: "jsdom",
    include: ["src/*.jsx-e2e.test.tsx"],
  },
})
