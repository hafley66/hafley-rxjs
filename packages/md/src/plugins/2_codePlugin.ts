import { code as shikiCode } from "@streamdown/code";
import type { MdPlugin } from "./0_types.js";

// dl6 has no bundled Shiki grammar: its tokens go through Prolog's while the
// fence keeps its displayed language. Other languages dispatch unchanged.
const highlight = {
  ...shikiCode,
  supportsLanguage(language: Parameters<typeof shikiCode.supportsLanguage>[0]) {
    return String(language).toLowerCase() === "dl6" || shikiCode.supportsLanguage(language);
  },
  highlight(
    options: Parameters<typeof shikiCode.highlight>[0],
    callback?: Parameters<typeof shikiCode.highlight>[1],
  ) {
    const language = String(options.language).toLowerCase() === "dl6"
      ? "prolog" as typeof options.language
      : options.language;
    return shikiCode.highlight({ ...options, language }, callback);
  },
};

export function codePlugin(): MdPlugin {
  return { name: "code", highlight };
}
