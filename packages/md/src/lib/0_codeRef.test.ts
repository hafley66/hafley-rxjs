import { expect, it } from "vitest"
import { isCodeRef } from "./0_codeRef.js"

it("names inline code that cites a file, a folder, or a line in one", () => {
  const texts = [
    "src/lang/rust/2_call.rs:790-801",
    "2_call.rs:183-198",
    "rust_modules.rs:1105-1136",
    "2_call.rs:561,583",
    "2_call.rs:561, 583",
    "hafley_scm/src/lang/rust/10_module_resolution_rows.rs:123-145",
    "crates/boop-harness",
    "./plans/notes.md",
    "~/projects/AGENTS.md",
    "main.ts:214",
    "Cargo.toml",
    "useState",
    "console.log",
    "mdUi.$()",
    "let x = 1",
    "https://example.com/a.ts",
    "--frozen-lockfile",
    "a.rs:7-",
    "",
  ]
  expect(texts.filter(isCodeRef)).toEqual([
    "src/lang/rust/2_call.rs:790-801",
    "2_call.rs:183-198",
    "rust_modules.rs:1105-1136",
    "2_call.rs:561,583",
    "2_call.rs:561, 583",
    "hafley_scm/src/lang/rust/10_module_resolution_rows.rs:123-145",
    "crates/boop-harness",
    "./plans/notes.md",
    "~/projects/AGENTS.md",
    "main.ts:214",
    "Cargo.toml",
  ])
})
