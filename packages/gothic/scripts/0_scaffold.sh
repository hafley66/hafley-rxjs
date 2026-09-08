#!/usr/bin/env bash
set -euo pipefail
shopt -s nullglob

cd "$(dirname "${BASH_SOURCE[0]}")/.."
templates=scripts/templates
registry=src/app/0_pages.ts

usage() {
  cat <<'HELP'
Usage: bash scripts/0_scaffold.sh COMMAND [ARGS] [--dry-run]

  page ID                         New page + circle Algo + route registration
  section PAGE ID                  New circle Algo appended to a page
  use PAGE ID MODULE:EXPORT        Append an existing Algo as section ID
  copy SOURCE ID                   Copy a scaffolded Algo into a new numbered file
  input ALGO KEY KIND              Add a fixed field template to a scaffolded Algo
  input --print KEY KIND           Print the same field for any handwritten spec

MODULE is a filename stem in src/algos, e.g. 2_fma:fma2 or 1_fractal:apollonian.
Scaffolded Algos export ALGO. KIND: range | number | seed | select | bool | text.
IDs/keys: lowercase letters, digits, underscores; start with a letter.
"page" and "pin" are reserved IDs/keys. Files are never overwritten by creation.
Input defaults are literal templates. Edit bounds/options/hints in the generated spec.
Commands stage all edits before writing. --dry-run prints the complete diff.
HELP
}
fail() { printf 'scaffold: %s\n' "$*" >&2; exit 1; }
identifier() {
  [[ $1 =~ ^[a-z][a-z0-9_]*$ ]] || fail "invalid ID/key: $1"
  case "$1" in page|pin|constructor|prototype|__proto__) fail "reserved ID/key: $1" ;; esac
}

[[ $# -gt 0 ]] || { usage; exit 0; }
case "$1" in help|-h|--help) usage; exit 0 ;; esac
dry_run=false
args=()
for arg in "$@"; do
  if [[ $arg == --dry-run ]]; then dry_run=true; else args+=("$arg"); fi
done
set -- "${args[@]}"
[[ $# -gt 0 ]] || fail "missing command"

work=$(mktemp -d "${TMPDIR:-/tmp}/gothic-scaffold.XXXXXX")
unsubscribe() { rm -rf "$work"; }
trap unsubscribe EXIT
targets=()

# Only this script's staged files are changed until every argument and marker has passed.
stage() {
  staged="$work/$1"
  if [[ ! -f $staged ]]; then
    mkdir -p "$(dirname "$staged")"
    [[ ! -f $1 ]] || cp "$1" "$staged"
    targets+=("$1")
  fi
}
insert() {
  local file=$1 marker=$2 count
  stage "$file"
  [[ -f $staged ]] || fail "missing file: $file"
  count=$(awk -v marker="$marker" '$0 == marker { n++ } END { print n+0 }' "$staged")
  [[ $count == 1 ]] || fail "$file needs exactly one '$marker' marker"
  cat > "$work/snippet"
  awk -v marker="$marker" -v snippet="$work/snippet" '
    $0 == marker { while ((getline line < snippet) > 0) print line; close(snippet) }
    { print }
  ' "$staged" > "$work/edit"
  mv "$work/edit" "$staged"
}
lookup_algo() {
  local file
  resolved=
  for file in src/algos/[0-9]*_"$1".ts "$work"/src/algos/[0-9]*_"$1".ts; do
    file=${file#"$work/"}
    [[ -z $resolved || $resolved == "$file" ]] || fail "ambiguous Algo ID: $1"
    resolved=$file
  done
}
lookup_page() {
  local source=$registry
  [[ ! -f $work/$registry ]] || source="$work/$registry"
  page_file=$(sed -nE "s|^import \{ PAGE as [a-zA-Z0-9_]+ \} from \"\.\./pages/([0-9]+[a-z]?_$1)\.js\"$|src/pages/\1.tsx|p" "$source")
  [[ $page_file != *$'\n'* ]] || fail "ambiguous page ID: $1"
}
next_file() {
  local dir=$1 id=$2 ext=$3 file base n max=2
  # Dependencies of new modules are included when picking the next numeric prefix.
  for file in "src/$dir"/[0-9]*_* "$work/src/$dir"/[0-9]*_* src/algos/[0-9]*_*.ts "$work"/src/algos/[0-9]*_*.ts; do
    base=${file##*/}
    [[ $base =~ ^([0-9]+) ]] || continue
    n=$((10#${BASH_REMATCH[1]}))
    if (( n > max )); then max=$n; fi
  done
  if [[ $dir == pages && $max -lt 4 ]]; then max=4; fi
  next="src/$dir/$((max + 1))_$id.$ext"
}
new_algo() {
  local id=$1
  lookup_algo "$id"
  [[ -z $resolved ]] || fail "Algo already exists: $resolved"
  next_file algos "$id" ts
  algo_file=$next
  stage "$algo_file"
  sed "s/@@ID@@/$id/g" "$templates/0_algo.ts.tpl" > "$staged"
}
new_page() {
  local id=$1 stem
  lookup_page "$id"
  [[ -z $page_file ]] || fail "page already exists: $id"
  local existing=(src/pages/[0-9]*_"$id".tsx)
  [[ ${#existing[@]} == 0 ]] || fail "unregistered page already exists: $id"
  next_file pages "$id" tsx
  page_file=$next
  stage "$page_file"
  sed "s/@@ID@@/$id/g" "$templates/1_page.tsx.tpl" > "$staged"
  stem=${page_file##*/}; stem=${stem%.tsx}
  insert "$registry" '// scaffold:imports' <<EOF
import { PAGE as scaffold_$id } from "../pages/$stem.js"
EOF
  insert "$registry" '  // scaffold:pages' <<EOF
  scaffold_$id,
EOF
}
extend_page() {
  local id=$1 source base stem
  lookup_page "$id"
  [[ -n $page_file ]] || fail "unknown page: $id"
  source=$page_file
  [[ ! -f $work/$source ]] || source="$work/$source"
  if awk '$0 == "// scaffold:bindings" { found=1 } END { exit !found }' "$source"; then return; fi
  # A handwritten notebook becomes the base of a new module; its source stays intact.
  base=${page_file##*/}; base=${base%.tsx}
  next_file pages "$id" tsx
  page_file=$next
  stage "$page_file"
  sed "s/@@BASE@@/$base/g" "$templates/2_extension.tsx.tpl" > "$staged"
  stem=${page_file##*/}; stem=${stem%.tsx}
  stage "$registry"
  sed "s|\"../pages/$base.js\"|\"../pages/$stem.js\"|" "$staged" > "$work/edit"
  mv "$work/edit" "$staged"
}
append_section() {
  local page=$1 id=$2 module=$3 symbol=$4 marker='    // scaffold:specs'
  extend_page "$page"
  stage "$page_file"
  if awk -v key="$id" '$0 ~ "^[[:space:]]*" key ":[[:space:]]" { found=1 } END { exit !found }' "$staged"; then
    fail "section already exists: $page.$id"
  fi
  insert "$page_file" '// scaffold:imports' <<EOF
import { $symbol as source_$id } from "../algos/$module.js"
EOF
  insert "$page_file" '// scaffold:bindings' <<EOF
const section_$id = { ...source_$id, name: "$id" }
EOF
  insert "$page_file" '      {/* scaffold:sections */}' <<EOF
      <AlgoSection page="$page" algo={section_$id} sizes={SIZES} />
EOF
  stage "$page_file"
  if awk '$0 == "  // scaffold:specs" { found=1 } END { exit !found }' "$staged"; then marker='  // scaffold:specs'; fi
  insert "$page_file" "$marker" <<EOF
${marker%%//*}$id: section_$id.spec,
EOF
}

case "$1" in
  page)
    [[ $# == 2 ]] || fail "usage: page ID"
    identifier "$2"
    new_algo "$2"
    new_page "$2"
    module=${algo_file##*/}; module=${module%.ts}
    append_section "$2" "$2" "$module" ALGO
    ;;
  section)
    [[ $# == 3 ]] || fail "usage: section PAGE ID"
    identifier "$2"; identifier "$3"
    new_algo "$3"
    module=${algo_file##*/}; module=${module%.ts}
    append_section "$2" "$3" "$module" ALGO
    ;;
  use)
    [[ $# == 4 ]] || fail "usage: use PAGE ID MODULE:EXPORT"
    identifier "$2"; identifier "$3"
    [[ $4 =~ ^([0-9]+[a-z]?_[a-zA-Z0-9_]+):([a-zA-Z_][a-zA-Z0-9_]*)$ ]] || fail "expected MODULE:EXPORT in src/algos"
    module=${BASH_REMATCH[1]}; symbol=${BASH_REMATCH[2]}
    [[ -f src/algos/$module.ts ]] || fail "missing module: src/algos/$module.ts"
    if ! awk -v symbol="$symbol" '$0 ~ "^export const " symbol ":[[:space:]]*Algo<" { found=1 } END { exit !found }' "src/algos/$module.ts"; then
      fail "expected a direct export const $symbol: Algo<...> in $module"
    fi
    append_section "$2" "$3" "$module" "$symbol"
    ;;
  copy)
    [[ $# == 3 ]] || fail "usage: copy SOURCE ID"
    identifier "$2"; identifier "$3"
    lookup_algo "$2"
    [[ -n $resolved ]] || fail "unknown Algo: $2"
    source=$resolved
    if ! awk '$0 == "  // scaffold:inputs" { found=1 } END { exit !found }' "$source"; then
      fail "copy expects a scaffolded Algo; use PAGE ID MODULE:EXPORT mounts existing Algos"
    fi
    new_algo "$3"
    stage "$algo_file"
    sed "s/^  name: \"$2\",$/  name: \"$3\",/" "$source" > "$staged"
    ;;
  input)
    [[ $# == 4 ]] || fail "usage: input ALGO KEY KIND | input --print KEY KIND"
    identifier "$3"
    fields=("$templates"/inputs/[0-9]_"$4".txt)
    [[ ${#fields[@]} == 1 ]] || fail "unknown field kind: $4"
    sed "s/@@KEY@@/$3/g" "${fields[0]}" > "$work/field"
    if [[ $2 == --print ]]; then cat "$work/field"; exit 0; fi
    identifier "$2"
    lookup_algo "$2"
    [[ -n $resolved ]] || fail "unknown Algo: $2"
    if awk -v key="$3" '
      /^export const SPEC = \{/ { spec=1 }
      spec && $0 ~ "^[[:space:]]*" key ":[[:space:]]" { found=1 }
      /^\} as const/ { spec=0 }
      END { exit !found }
    ' "$resolved"; then fail "input already exists: $2.$3"; fi
    insert "$resolved" '  // scaffold:inputs' < "$work/field"
    ;;
  *) fail "unknown command: $1 (use --help)" ;;
esac

for file in "${targets[@]}"; do
  if $dry_run; then
    before=$file
    [[ -f $before ]] || before=/dev/null
    diff -u --label "$file (before)" --label "$file (after)" "$before" "$work/$file" || [[ $? == 1 ]]
  else
    mkdir -p "$(dirname "$file")"
    cp "$work/$file" "$file"
    printf '%s\n' "$file"
  fi
done
