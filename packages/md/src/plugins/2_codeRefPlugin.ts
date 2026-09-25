import type { MdPlugin } from "./0_types.js";
import { CodeRef } from "./1_CodeRef.js";

/** Inline code; a span citing a file opens through host.openCodeRef on ⌘-click. */
export function codeRefPlugin(): MdPlugin {
  return { name: "code-ref", inlineCode: CodeRef };
}
