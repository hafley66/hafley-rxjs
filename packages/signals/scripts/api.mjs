// The generator lives in `@hafley66/docs-kit`. This names the barrel it reads for what is public
// and where the page lands, which is the whole of what is signals-specific about it.
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { generateApi } from "@hafley66/docs-kit/scripts/api"

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), "..")

const result = generateApi({
  pkg: PKG,
  // The three entry points `package.json` publishes: the root, the React subpath and the plugin.
  barrels: ["src/index.ts", "src/3_react.ts", "src/vite-plugin.ts"],
  out: "docs/reference-api.md",
  title: "Every export",
  intro:
    "The whole public surface of `@hafley66/signals`, one section per module. The pages above this one explain what to reach for; this one is the list.",
})

console.log(`api: ${result.exports} export(s) across ${result.modules} module(s) into ${result.file}`)
