// Every call site reads `LOG.on` first and does no other work when false.
import { emitter, setEmit } from "@hafley66/trace";
import type { Emitter, LogEmit, LogFields } from "@hafley66/trace";

export type { LogEmit, LogFields };

export const LOG: Emitter = emitter("md");

export const CAT_READ = ["md", "read"] as const;
export const CAT_PARSE = ["md", "parse"] as const;
// Open to the first React commit that holds the parsed document, then to the frame after it.
export const CAT_COMMIT = ["md", "commit"] as const;
export const CAT_PAINT = ["md", "paint"] as const;
export const CAT_DIAGRAM = ["md", "diagram"] as const;

export const mdNow = (): number => (typeof performance === "undefined" ? Date.now() : performance.now());

/** Raw sink; `null` turns md logging off. */
export function setMdLogEmit(emit: LogEmit | null): void {
  setEmit(LOG, emit);
}
