import { createContext } from "react";
import type { MdFenceCommandRunner, MdInlineDoc, MdPlugin } from "./0_types.js";

export interface MdPluginScope {
  /** Absent: defaultMdPlugins, resolved inside the lazily loaded body. */
  plugins?: readonly MdPlugin[];
  runCommand?: MdFenceCommandRunner;
  /** Formatter width for command plugins, in code-font columns. */
  columns: number;
}

export const MdPluginContext = createContext<MdPluginScope>({ columns: 80 });

/** The document inline slots render in. Absent (no MdPanel above): Streamdown's own inline markup. */
export const MdInlineDocContext = createContext<MdInlineDoc | undefined>(undefined);
