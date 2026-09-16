#!/usr/bin/env bash
# One scaffolder for the workspace and for the workspace itself.
#
#   bash scripts/0_scaffold.sh package NAME [--description TEXT] [--private] [--dry-run]
#   bash scripts/0_scaffold.sh repo NAME [--out DIR] [--scope @scope] [--dry-run]
#
# A package comes from templates/package; a repository comes from templates/repo plus the root files the
# scaffold block names, and then gets one package scaffolded inside it by this same script. Everything a
# template cannot know — scope, license, repository URL, the devDependency versions the root already
# pins, the Node and pnpm the root declares, and biome's version which only biome.json records — is read
# from the root package.json and biome.json at run time. The only word a template contains is a token.
set -euo pipefail
shopt -s nullglob

cd "$(dirname "${BASH_SOURCE[0]}")/.."
root=$PWD

usage() {
  cat <<'HELP'
Usage: bash scripts/0_scaffold.sh COMMAND [ARGS] [--dry-run]

  package NAME [--description TEXT] [--private]
      Scaffold packages/NAME from templates/package: the four verbs, the prepack release gate, and a
      tsconfig pair that extends tsconfig.base.json. Public by default.

  repo NAME [--out DIR] [--scope @scope]
      Scaffold a whole repository at DIR (default: ../NAME) from templates/repo plus the root files the
      root package.json scaffold.repoFiles names, then scaffold NAME inside it. It does not run
      `pnpm install`; it prints that step.

Inputs live in the root package.json under "scaffold". A token that has no input fails the run by name.
Files are never overwritten: an existing target directory fails. --dry-run prints what would be written.
HELP
}

fail() { printf 'scaffold: %s\n' "$*" >&2; exit 1; }
identifier() {
  [[ $1 =~ ^[a-z][a-z0-9-]*$ ]] || fail "invalid name: $1 (lowercase letters, digits, dashes; start with a letter)"
  case "$1" in package|repo|help|new) fail "reserved name: $1" ;; esac
}

[[ $# -gt 0 ]] || { usage; exit 0; }
case "$1" in help|-h|--help) usage; exit 0 ;; esac

command=$1
shift
dry_run=false
name=""
description=""
visibility="public"
out=""
scope=""
args=()
for arg in "$@"; do
  case "$arg" in
    --dry-run) dry_run=true ;;
    *) args+=("$arg") ;;
  esac
done
set -- "${args[@]}"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --description) [[ $# -ge 2 ]] || fail "--description needs a value"; description=$2; shift 2 ;;
    --out) [[ $# -ge 2 ]] || fail "--out needs a value"; out=$2; shift 2 ;;
    --scope) [[ $# -ge 2 ]] || fail "--scope needs a value"; scope=$2; shift 2 ;;
    --private) visibility="private"; shift ;;
    -*) fail "unknown flag: $1" ;;
    *) [[ -z $name ]] || fail "unexpected argument: $1"; name=$1; shift ;;
  esac
done
[[ -n $name ]] || fail "missing NAME"
identifier "$name"

# Params are data: every input the templates need is read out of the manifest that already knows it.
params=$(node -e '
const fs = require("node:fs")
const pkg = JSON.parse(fs.readFileSync(process.argv[1], "utf8"))
const s = pkg.scaffold ?? {}
const dep = pkg.devDependencies ?? {}
const biomeSchema = JSON.parse(fs.readFileSync("biome.json", "utf8")).$schema ?? ""
const rows = {
  scope: s.scope ?? "@" + (pkg.name ?? "scope"),
  dir: s.dir ?? "packages",
  template: s.template ?? "templates/package",
  repoTemplate: s.repoTemplate ?? "templates/repo",
  license: s.license ?? "MIT",
  author: s.author ?? "",
  repository: s.repository ?? "",
  homepage: s.homepage ?? "",
  registry: s.registry ?? "https://registry.npmjs.org/",
  node: pkg.engines?.node ?? ">=24",
  nodeMajor: (pkg.engines?.node ?? ">=24").match(/\d+/)?.[0] ?? "24",
  pkgManager: pkg.packageManager ?? "",
  typescript: dep.typescript ?? "",
  vitest: dep.vitest ?? "",
  vite: dep.vite ?? "",
  attw: dep["@arethetypeswrong/cli"] ?? "",
  changesets: dep["@changesets/cli"] ?? "",
  publint: dep.publint ?? "",
  // biome checks its own version against biome.json $schema, so this one is exact, never a range.
  biome: dep["@biomejs/biome"] ?? (biomeSchema.match(/\/(\d+\.\d+\.\d+)\//) ?? [])[1] ?? "",
}
for (const [key, value] of Object.entries(rows)) {
  if (Array.isArray(value)) continue
  if (typeof value === "string") console.log(key + "=" + value)
}
console.log("repoFiles=" + (s.repoFiles ?? []).join(":"))
' "$root/package.json")

value() {
  local key=$1 line
  line=$(printf '%s\n' "$params" | grep -m1 "^${key}=" || true)
  printf '%s' "${line#"${key}="}"
}

need() {
  local key=$1 v
  v=$(value "$key")
  [[ -n $v ]] || fail "no input for __${key}__: set scaffold.${key} in the root package.json (or the devDependency it mirrors)"
  printf '%s' "$v"
}

scope=${scope:-$(need scope)}
scoped=$scope/$name
# PascalCase identifier for type names, from the one word the caller typed.
ident=$(printf '%s' "$name" | awk -F- '{ for (i = 1; i <= NF; i++) printf toupper(substr($i, 1, 1)) substr($i, 2) }')
[[ $scope == @* ]] || fail "--scope must start with @: $scope"

substitutions=$(
  printf '%s\n' \
    "SCOPED=$scoped" \
    "SCOPE=$scope" \
    "NAME=$name" \
    "Ident=$ident" \
    "DESCRIPTION=${description:-TODO: one line on what $name does}" \
    "LICENSE=$(need license)" \
    "AUTHOR=$(value author)" \
    "REPOSITORY=$(value repository)" \
    "HOMEPAGE=$(value homepage)" \
    "REGISTRY=$(need registry)" \
    "NODE=$(need node)" \
    "NODE_MAJOR=$(need nodeMajor)" \
    "PKG_MANAGER=$(need pkgManager)" \
    "TYPESCRIPT=$(need typescript)" \
    "VITEST=$(need vitest)" \
    "VITE=$(need vite)" \
    "ATTW=$(need attw)" \
    "CHANGESETS=$(need changesets)" \
    "PUBLINT=$(need publint)" \
    "BIOME=$(need biome)"
)

# Substitution runs over every text file the templates produced and fails on a token with no input, so a
# template can never ship a `__TOKEN__` into a real package.
substitute() {
  local dir=$1 json
  json=$(printf '%s\n' "$substitutions" | node -e '
const rows = {}
for (const line of require("node:fs").readFileSync(0, "utf8").split("\n")) {
  const at = line.indexOf("=")
  if (at > 0) rows[line.slice(0, at)] = line.slice(at + 1)
}
process.stdout.write(JSON.stringify(rows))
')
  node -e '
const fs = require("node:fs")
const path = require("node:path")
const [dir, json] = process.argv.slice(1)
const map = JSON.parse(json)
let changed = 0
const walk = d => {
  for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
    const file = path.join(d, entry.name)
    // A copied repository carries templates/ (whose tokens belong to the next scaffold) and scripts/
    // (where the tokens are defined), so neither is a substitution target.
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "templates" || entry.name === "scripts") continue
      walk(file)
      continue
    }
    const before = fs.readFileSync(file, "utf8")
    if (!before.includes("__")) continue
    const after = before.replace(/__([A-Za-z_]+)__/g, (whole, token) => {
      if (map[token] === undefined) throw new Error(`${file}: no input for ${whole}`)
      return map[token]
    })
    if (after !== before) { fs.writeFileSync(file, after); changed++ }
  }
}
walk(dir)
console.log(`scaffold: substituted ${changed} file${changed === 1 ? "" : "s"}`)
' "$dir" "$json"
}

work=$(mktemp -d "${TMPDIR:-/tmp}/scaffold.XXXXXX")
cleanup() { rm -rf "$work"; }
trap cleanup EXIT

write_package() {
  local target=$1 visibility=$2
  local template
  template=$(need template)
  [[ -d $template ]] || fail "no template directory: $template"
  cp -R "$template/." "$target/"
  find "$target" -name ".DS_Store" -delete
  if [[ $visibility == private ]]; then
    # A private package publishes nothing, so it carries no release gate and no publishConfig.
    node -e '
const fs = require("node:fs")
const file = process.argv[1]
const manifest = JSON.parse(fs.readFileSync(file, "utf8"))
manifest.private = true
delete manifest.publishConfig
delete manifest.scripts.prepack
fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + "\n")
' "$target/package.json"
  fi
}

case "$command" in
  package)
    target="$(need dir)/$name"
    [[ ! -e $target ]] || fail "already exists: $target"
    mkdir -p "$work/$name"
    write_package "$work/$name" "$visibility"
    substitute "$work/$name"
    if [[ $dry_run == true ]]; then
      echo "scaffold: would write $target"
      (cd "$work/$name" && find . -type f | sort | sed 's|^\./|  |')
      echo "--- package.json"
      sed 's|^|  |' "$work/$name/package.json"
      exit 0
    fi
    mkdir -p "$(dirname "$target")"
    mv "$work/$name" "$target"
    echo "scaffold: wrote $target"
    printf '\nNext:\n  pnpm install                       # links the new package into the workspace\n  pnpm --filter %s receipts      # typecheck, test, build\n  pnpm changeset                     # a release note, when it ships\n' "$scoped"
    ;;

  repo)
    target=${out:-"$(dirname "$root")/$name"}
    [[ ! -e $target ]] || fail "already exists: $target"
    template_dir=$(need repoTemplate)
    [[ -d $template_dir ]] || fail "no repo template: $template_dir"
    mkdir -p "$work/$name"
    cp -R "$template_dir/." "$work/$name/"
    for file in $(printf '%s' "$(value repoFiles)" | tr ':' ' '); do
      [[ -e $file ]] || fail "scaffold.repoFiles names a missing path: $file"
      mkdir -p "$work/$name/$(dirname "$file")"
      cp -R "$file" "$work/$name/$file"
    done
    substitute "$work/$name"
    if [[ $dry_run == true ]]; then
      echo "scaffold: would write $target"
      (cd "$work/$name" && find . -type f -not -path "./node_modules/*" | sort | sed 's|^\./|  |')
      exit 0
    fi
    mkdir -p "$(dirname "$target")"
    mv "$work/$name" "$target"
    echo "scaffold: wrote $target"
    # The copy carries templates/ and this script, so the new repository scaffolds its own packages.
    (cd "$target" && bash scripts/0_scaffold.sh package "$name" --scope "$scope")
    printf '\nNext:\n  cd %s\n  git init && git add -A && git commit -m "Initial commit"\n  pnpm install\n  pnpm verify\n' "$target"
    ;;

  *) usage; fail "unknown command: $command" ;;
esac
