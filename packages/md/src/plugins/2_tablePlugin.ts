import PersistedMarkdownTable from "../5_PersistedMarkdownTable.js";
import type { MdPlugin } from "./0_types.js";

export function tablePlugin(): MdPlugin {
  return { name: "table", table: PersistedMarkdownTable };
}
