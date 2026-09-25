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

/** The document an inline renderer sits in. MdPanel provides it; without it no inline slot renders. */
export interface MdInlineDoc {
  /** Absolute path of the rendered document. */
  path: string;
  /** Expand the section chain to a heading id and scroll it into view. */
  jumpTo: (id: string) => void;
  /** Replace the panel's document in place. */
  onNavigate: (path: string) => void;
}

/** Streamdown's per-element props plus the document. `node` is the hast element. */
export type MdInlineCodeProps = ComponentProps<"code"> & { readonly node?: unknown; readonly doc: MdInlineDoc };
export type MdLinkProps = ComponentProps<"a"> & { readonly node?: unknown; readonly doc: MdInlineDoc };
export type MdImageProps = ComponentProps<"img"> & { readonly node?: unknown; readonly doc: MdInlineDoc };

export interface MdPlugin {
  name: string;
  fence?: { languages: readonly string[]; component: ComponentType<MdFenceProps> };
  table?: ComponentType<MdTableProps>;
  highlight?: CodeHighlighterPlugin;
  command?: MdFenceCommand;
  inlineCode?: ComponentType<MdInlineCodeProps>;
  link?: ComponentType<MdLinkProps>;
  image?: ComponentType<MdImageProps>;
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
