#!/usr/bin/env bash
# build the vello wasm bridge into src/wasm (committed artifact; vite inlines it in single builds)
set -euo pipefail
cd "$(dirname "$0")/../wasm/vello_demo"
cargo build --release --target wasm32-unknown-unknown
wasm-bindgen --target web --typescript --out-dir ../../src/wasm target/wasm32-unknown-unknown/release/gothic_vello.wasm
ls -l ../../src/wasm/gothic_vello_bg.wasm
