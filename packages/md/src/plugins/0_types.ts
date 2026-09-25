// One registry format for every special renderer: a plugin is a value, the host
// passes an array, and array order is precedence. `name` is diagnostics only.
import type { ComponentProps, ComponentType } from "react";
import type { CodeHighlighterPlugin } from "streamdown";
import type { Observable } from "rxjs";

export interface MdFenceProps {
  code: string;
  language: string;
  meta?: string;
  isIncomplete: boolean;
  dark: boolean;
}

export interface MdTableNode {
  readonly position?: {
    readonly start?: { readonly offset?: number };
  };
}

export type MdTableProps = ComponentProps<"table"> & {
  readonly node?: MdTableNode;
  readonly tableSectionId?: string;
  readonly tableOrdinal?: number;
};

/** JSON-serializable, so a settings file can hold a list of these. */
export interface MdFenceCommand {
  /** RegExp source tested against the fence language. */
  match: string;
  /** Opaque to md: the host expands `$WIDTH`, `$LANG`, `$1` and runs it. */
  command: string;
  /** `replace`: stdout becomes the fence body. `annotate`: stdout renders as a `text` fence under it. */
  as: "replace" | "annotate";
}

export interface MdPlugin {
  name: string;
  fence?: { languages: readonly string[]; component: ComponentType<MdFenceProps> };
  table?: ComponentType<MdTableProps>;
  highlight?: CodeHighlighterPlugin;
  command?: MdFenceCommand;
}

export interface MdFenceCommandRequest {
  command: string;
  language: string;
  text: string;
  columns: number;
}

export interface MdFenceCommandResult {
  stdout: string;
  stderr: string;
  code: number;
}

/** Cold. Unsubscribing tells the host to stop the process. */
export type MdFenceCommandRunner = (request: MdFenceCommandRequest) => Observable<MdFenceCommandResult>;
