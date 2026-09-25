import type { MdPlugin } from "./0_types.js";
import { MdLink } from "./1_MdLink.js";

/** Links: `#id` jumps, markdown files navigate the panel, the rest go to host.openHref. */
export function linkPlugin(): MdPlugin {
  return { name: "link", link: MdLink };
}
