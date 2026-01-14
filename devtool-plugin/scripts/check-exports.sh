#!/bin/bash
# Check export patterns in rxjs operator files

DIR="node_modules/rxjs/dist/esm5/internal/operators"

for f in $(ls "$DIR"/*.js | head -20); do
  basename "$f"
  grep "export function" "$f" | sed 's/^/  /'
  echo
done
