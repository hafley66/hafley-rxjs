#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
package_dir="$PWD"
repository="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
remote="$(git remote get-url origin)"
revision="$(git rev-parse HEAD)"
publish_dir="$(mktemp -d "${TMPDIR:-/tmp}/gothic-pages.XXXXXX")"
unsubscribe() { rm -rf -- "$publish_dir"; }
trap unsubscribe EXIT

# Refuse to redirect an existing site from another publishing source.
create_pages=false
if source="$(gh api "repos/$repository/pages" --jq '[.source.branch, .source.path, .build_type] | @tsv' 2>"$publish_dir/pages-error")"; then
  if [[ "$source" != $'gh-pages\t/\tlegacy' ]]; then
    echo "Pages already uses another source: $source" >&2
    exit 1
  fi
else
  case "$(cat "$publish_dir/pages-error")" in
    *"HTTP 404"*) create_pages=true ;;
    *) cat "$publish_dir/pages-error" >&2; exit 1 ;;
  esac
fi

pnpm build:single
test -s "$package_dir/dist/index.html"
git init --quiet --initial-branch=gh-pages "$publish_dir/site"
git -C "$publish_dir/site" remote add origin "$remote"
git -C "$publish_dir/site" config user.name "$(git config user.name)"
git -C "$publish_dir/site" config user.email "$(git config user.email)"
if git ls-remote --exit-code origin refs/heads/gh-pages >"$publish_dir/ref"; then
  git -C "$publish_dir/site" fetch --quiet --depth=1 origin gh-pages
  git -C "$publish_dir/site" checkout --quiet -B gh-pages FETCH_HEAD
else
  status=$?
  [[ "$status" == 2 ]] || exit "$status"
fi

cp "$package_dir/dist/index.html" "$publish_dir/site/index.html"
touch "$publish_dir/site/.nojekyll"
git -C "$publish_dir/site" add -- index.html .nojekyll
if ! git -C "$publish_dir/site" diff --cached --quiet; then
  cat >"$publish_dir/message" <<EOF
gothic: publish single HTML from $revision

Publish the inlined notebook and disable Jekyll processing.

Directed by: Chris Hafley requested GitHub Pages publication of the single HTML.
Implemented by: Codex authored the build and publication script.

Co-Authored-By: Codex <noreply@openai.com>
EOF
  git -C "$publish_dir/site" commit --quiet -F "$publish_dir/message"
  git -C "$publish_dir/site" push origin HEAD:refs/heads/gh-pages
fi
if [[ "$create_pages" == true ]]; then
  gh api --method POST "repos/$repository/pages" -f build_type=legacy -f 'source[branch]=gh-pages' -f 'source[path]=/' --jq .html_url
else
  gh api "repos/$repository/pages" --jq .html_url
fi
