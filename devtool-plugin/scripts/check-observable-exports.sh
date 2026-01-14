#!/bin/bash
# Check export patterns in rxjs observable files

DIR="node_modules/rxjs/dist/esm5/internal/observable"

for f in $(ls "$DIR"/*.js | head -25); do
  basename "$f"
  grep "export function" "$f" | sed 's/^/  /'
  echo
done
