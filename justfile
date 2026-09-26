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

# lane warmup: boop lane create runs this in each new worktree
boop-start:
    pnpm install --frozen-lockfile --prefer-offline

# dev-stamp and publish packages to local verdaccio from a throwaway worktree of HEAD
# usage: just publish-local trace md boop-xterm
publish-local +pkgs:
    #!/usr/bin/env bash
    set -euo pipefail
    reg=http://127.0.0.1:4873/
    wt=$(mktemp -d)/publish-local
    git worktree add -q --detach "$wt" HEAD
    trap 'git worktree remove --force "$wt"' EXIT
    ts=$(node -e 'console.log(Date.now())')
    for p in {{pkgs}}; do
      (cd "$wt/packages/$p" && npm pkg set version="$(node -e 'console.log(require("./package.json").version.split("-")[0])')-dev.$ts" publishConfig.registry=$reg)
    done
    cd "$wt"
    pnpm install --frozen-lockfile --prefer-offline >/dev/null
    filters=(); for p in {{pkgs}}; do filters+=(--filter "@hafley66/$p^..." --filter "@hafley66/$p"); done
    pnpm "${filters[@]}" build >/dev/null
    for p in {{pkgs}}; do (cd "packages/$p" && pnpm publish --registry $reg --no-git-checks --tag dev); done
