import { rolldown } from "rolldown"
import { chmodSync, readFileSync } from "node:fs"

const metadata = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"))
const dependencies = Object.keys({ ...metadata.dependencies, ...metadata.peerDependencies })
const external = id => id.startsWith("node:") || dependencies.some(name => id === name || id.startsWith(name + "/"))

const bundle = await rolldown({
  input: new URL("./src/index.ts", import.meta.url).pathname,
  platform: "node",
  external,
})
try { await bundle.write({ file: new URL("./dist/index.js", import.meta.url).pathname, format: "esm" }) }
finally { await bundle.close() }

const cli = await rolldown({
  input: new URL("./src/cli/8_main.ts", import.meta.url).pathname,
  platform: "node",
  external,
})
try { await cli.write({ file: new URL("./dist/cli.js", import.meta.url).pathname, format: "esm" }) }
finally { await cli.close() }
chmodSync(new URL("./dist/cli.js", import.meta.url), 0o755)
