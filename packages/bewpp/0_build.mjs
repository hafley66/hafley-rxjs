import { rolldown } from "rolldown"
import { readFileSync } from "node:fs"

const metadata = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"))
const dependencies = Object.keys({ ...metadata.dependencies, ...metadata.peerDependencies })
const bundle = await rolldown({
  input: new URL("./src/index.ts", import.meta.url).pathname,
  platform: "node",
  external: id => id.startsWith("node:") || dependencies.some(name => id === name || id.startsWith(name + "/")),
})
try { await bundle.write({ file: new URL("./dist/index.js", import.meta.url).pathname, format: "esm" }) }
finally { await bundle.close() }
