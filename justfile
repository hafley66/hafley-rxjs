default:
    just --list

# consume changesets: bump versions + changelogs
version:
    pnpm release:version

# gate + publish everything pending; prompts 2FA once, rest rides session grace
publish:
    pnpm release:publish

# same gate as publish, nothing shipped
audit:
    pnpm release:audit

# 404 = publish pending or lost tarball; non-zero exit when any are pending
pending:
    #!/usr/bin/env node
    const { readdirSync, readFileSync, existsSync } = require("node:fs")
    const { execFileSync } = require("node:child_process")
    let rc = 0
    for (const dir of readdirSync("packages", { withFileTypes: true })) {
      if (!dir.isDirectory()) continue
      const manifest = `packages/${dir.name}/package.json`
      if (!existsSync(manifest)) continue
      const pkg = JSON.parse(readFileSync(manifest, "utf8"))
      if (pkg.private) continue
      const bare = pkg.name.replace(/^@[^/]+\//, "")
      const url = `https://registry.npmjs.org/${pkg.name}/-/${bare}-${pkg.version}.tgz`
      const code = execFileSync("curl", ["-so", "/dev/null", "-w", "%{http_code}", url]).toString()
      if (code.trim() === "200") {
        console.log(`LIVE    ${pkg.name}@${pkg.version}`)
      } else {
        console.log(`PENDING ${pkg.name}@${pkg.version} (tarball ${code.trim()})`)
        rc = 1
      }
    }
    process.exit(rc)
