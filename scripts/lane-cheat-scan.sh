#!/usr/bin/env bash
# lane-cheat-scan <worktree> [base]: flag shortcut patterns in lines a lane added (commits past base + dirty tree).
set -uo pipefail
wt=$1; base=${2:-$(git -C "$wt" merge-base HEAD main)}
diff=$( { git -C "$wt" diff "$base"..HEAD; git -C "$wt" diff HEAD; git -C "$wt" ls-files --others --exclude-standard -z | (cd "$wt" && xargs -0 -I{} sh -c 'echo "+++ b/{}"; sed "s/^/+/" "{}"' 2>/dev/null); } )
file=""
echo "$diff" | while IFS= read -r line; do
  case $line in "+++ b/"*) file=${line#+++ b/}; continue;; esac
  [[ $line == +* && $line != "+++"* ]] || continue
  l=${line:1}
  test_file=0; [[ $file =~ (\.test\.|\.spec\.|/test/|/tests/|__tests__) ]] && test_file=1
  [[ $file =~ \.(ts|tsx|js|mjs|json|rs)$ ]] || continue
  hit=""
  [[ $l =~ (^|[^A-Za-z_])as\ (unknown\ as|never|any)([^A-Za-z_]|$)|:\ any([^A-Za-z_]|$)|@ts-ignore|@ts-expect-error|@ts-nocheck ]] && hit="type escape"
  [[ $l =~ \.(skip|only|todo)\(|\bxit\(|\bxdescribe\( ]] && hit="skipped test"
  [[ $l =~ toBeDefined|expect\(true\)|toBeTruthy\(\)$|expect\.anything\(\) ]] && hit="hollow assertion"
  [[ $l =~ eslint-disable|biome-ignore|#\[allow\(|#!\[allow\( ]] && hit="lint suppress"
  [[ $l =~ passWithNoTests|--passWithNoTests|\|\|\ true|exit\ 0 ]] && hit="gate bypass"
  [[ $l =~ vi\.mock\(|jest\.mock\(|mockImplementation|vi\.fn\(\)\ as ]] && hit="mock of code"
  if (( ! test_file )); then
    [[ $l =~ \.subscribe\(|firstValueFrom|lastValueFrom|new\ (Behavior|Replay)?Subject ]] && hit="rxjs law"
    [[ $l =~ \bTODO\b|\bFIXME\b|\bunimplemented!|\btodo!\(|throw\ new\ Error\([\"\']not\ implemented ]] && hit="stub"
  fi
  [[ -n $hit ]] && printf '%s\t%s\t%s\n' "$hit" "$file" "$(echo "$l" | cut -c1-140)"
done
# deleted test cases per test file stem (a.test.ts -> a.browser.test.ts counts as the same stem)
git -C "$wt" diff "$base" --name-only -- '*.test.*' '*.spec.*' 2>/dev/null | sed -E 's/\.(browser\.|dom\.|render\.)?(test|spec)\.[a-z]+$//' | sort -u | while read -r stem; do
  before=0; for f in $(git -C "$wt" ls-tree -r --name-only "$base" -- "$(dirname "$stem")" | grep -E "^${stem}\.([a-z]+\.)?(test|spec)\.[a-z]+$"); do before=$((before + $(git -C "$wt" show "$base:$f" | grep -cE '^\s*(it|test)\('))); done
  after=0; for f in "$wt/$stem".*test.* "$wt/$stem".*spec.*; do [ -f "$f" ] && after=$((after + $(grep -cE '^\s*(it|test)\(' "$f"))); done
  (( before > after )) && printf 'test cases dropped\t%s\t%s -> %s\n' "$stem" "$before" "$after"
done
exit 0
