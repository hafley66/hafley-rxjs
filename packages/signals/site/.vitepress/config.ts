import { fileURLToPath } from "node:url"
import { docsConfig, renderedOnly } from "@hafley66/docs-kit/config"
import { signalsJsx } from "../../src/vite-plugin.js"
import { CONTENT } from "../content.js"

const src = (name: string): string => fileURLToPath(new URL(`../../src/${name}`, import.meta.url))

export default docsConfig({
  title: "signals",
  description:
    "@hafley66/signals: RxJS-native reactive signals. One constructor, four forms, proxy-based nested access, and no value and onChange pair anywhere.",
  content: CONTENT,
  srcExclude: [renderedOnly(CONTENT)],
  devPort: 5182,
  previewPort: 5183,
  vite: {
    // The one page whose subject is the React binding brings React with it, and `signalsJsx` is
    // what rewrites the runtime import esbuild emits for its `.tsx`. The kit stays framework-free.
    plugins: [signalsJsx()],
    esbuild: { jsx: "automatic", jsxImportSource: "react" },
    // The rewrite names the published package and the examples import `../src/`, so without these
    // three a read tracked by one copy would never reach the collector held by the other.
    resolve: {
      alias: [
        { find: "@hafley66/signals/jsx-dev-runtime", replacement: src("jsx-dev-runtime.ts") },
        { find: "@hafley66/signals/jsx-runtime", replacement: src("jsx-runtime.ts") },
        { find: /^@hafley66\/signals$/, replacement: src("index.ts") },
      ],
    },
  },
})
