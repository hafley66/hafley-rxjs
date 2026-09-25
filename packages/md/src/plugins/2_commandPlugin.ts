import type { MdFenceCommand, MdPlugin } from "./0_types.js";

/** A fence pre-pass. The host's runFenceCommand runs it; without one the fence renders as written. */
export function commandPlugin(command: MdFenceCommand): MdPlugin {
  return { name: `command ${command.match}`, command };
}
