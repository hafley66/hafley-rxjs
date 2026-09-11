// The generator lives in `@hafley66/docs-kit`. This names the barrel it reads for what is public
// and where the page lands, which is the whole of what is grid-specific about it.
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { generateApi } from "@hafley66/docs-kit/scripts/api"

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), "..")

const result = generateApi({
  pkg: PKG,
  barrel: "src/index.ts",
  out: "docs/reference-api.md",
  title: "Every export",
  intro:
    "The whole public surface of `@hafley66/signal-grid`, one section per module in the order the kernel runs. The pages above this one explain what to reach for; this one is the list.",
})

console.log(`api: ${result.exports} export(s) across ${result.modules} module(s) into ${result.file}`)
