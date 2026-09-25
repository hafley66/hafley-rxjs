import type { MdPlugin } from "./0_types.js";
import { MdImg } from "./1_MdImg.js";

/** Images: remote, data and blob URLs as written; local paths load through host.readImage. */
export function imagePlugin(): MdPlugin {
  return { name: "image", image: MdImg };
}
