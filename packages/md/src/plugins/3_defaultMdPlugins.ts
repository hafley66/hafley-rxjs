import type { MdPlugin } from "./0_types.js";
import { codePlugin } from "./2_codePlugin.js";
import { d2Plugin } from "./2_d2Plugin.js";
import { mermaidPlugin } from "./2_mermaidPlugin.js";
import { tablePlugin } from "./2_tablePlugin.js";

/** What md renders when the host gives no array. One module-level value, so renderer identity is stable. */
export const defaultMdPlugins: readonly MdPlugin[] = [mermaidPlugin(), d2Plugin(), tablePlugin(), codePlugin()];
