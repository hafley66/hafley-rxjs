#!/usr/bin/env node
import("../dist/bin.js")
  .then((module) => module.main())
  .then((code) => process.exit(code))
  .catch((error) => { process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`); process.exit(1) })
