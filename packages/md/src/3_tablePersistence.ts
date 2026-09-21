// Persisted table view state. The renderer owns the live signal-grid state;
// this module only gives it a repository/file/table address and a small
// read/write adapter for the md plugin slice.

import { getMdviewHost, type MdviewHost } from "./ports.js";

export interface MarkdownTableIdentity {
  readonly gitRoot?: string;
  readonly filePath: string;
  readonly tableId: string;
}

export interface MarkdownDocumentIdentity {
  readonly gitRoot?: string;
  readonly filePath: string;
}

export interface MarkdownTableAnchor {
  readonly sectionId?: string;
  readonly ordinal?: number;
  readonly sourceStart?: number;
  readonly headerValues?: readonly string[];
}

export interface MarkdownTablePreferences {
  readonly widths: Readonly<Record<string, number>>;
  readonly order: readonly string[];
  readonly hidden: Readonly<Record<string, boolean>>;
}

/** The three signal-grid fields owned by a markdown table's view preferences. */
export interface MarkdownTableViewState {
  readonly colWidth: Readonly<Record<string, number>>;
  readonly colOrder: readonly string[];
  readonly colHidden: Readonly<Record<string, boolean>>;
}

export interface MarkdownTablePluginState {
  readonly tablePreferences?: Readonly<Record<string, MarkdownTablePreferences>>;
}

export interface MarkdownTablePreferenceAdapter {
  read: () => Readonly<Record<string, MarkdownTablePreferences>>;
  write: (tables: Readonly<Record<string, MarkdownTablePreferences>>) => void;
}

export interface MarkdownTablePreferenceStore {
  get: (
    identity: MarkdownTableIdentity,
    columnIds?: readonly string[],
  ) => MarkdownTablePreferences;
  set: (
    identity: MarkdownTableIdentity,
    patch: Partial<MarkdownTablePreferences>,
  ) => MarkdownTablePreferences;
  clear: (identity: MarkdownTableIdentity) => void;
}

const PLUGIN_ID = "md";

function pathParts(path: string): string[] {
  const absolute = path.startsWith("/");
  const parts: string[] = [];
  for (const part of path.replaceAll("\\", "/").split("/")) {
    if (!part || part === ".") continue;
    if (part === ".." && parts.length > 0 && parts.at(-1) !== "..") parts.pop();
    else if (part !== "..") parts.push(part);
  }
  return absolute ? ["", ...parts] : parts;
}

function normalizedPath(path: string): string {
  const parts = pathParts(path);
  const value = parts.join("/");
  return value || (path.startsWith("/") ? "/" : ".");
}

function recordValue(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function relativePath(root: string, filePath: string): string {
  const rootPath = normalizedPath(root).replace(/\/$/, "");
  const file = normalizedPath(filePath);
  return file === rootPath ? "" : file.startsWith(`${rootPath}/`) ? file.slice(rootPath.length + 1) : file;
}

/** A stable identity for repeated tables in one section, including duplicate headers. */
export function markdownTableId(anchor: MarkdownTableAnchor): string {
  const header = (anchor.headerValues ?? []).join("\u001f");
  let hash = 2166136261;
  for (const character of header) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  const signature = (hash >>> 0).toString(16).padStart(8, "0");
  if (anchor.ordinal !== undefined) {
    return `${anchor.sectionId ?? "document"}:${anchor.ordinal}:${signature}`;
  }
  if (anchor.sectionId !== undefined && anchor.sourceStart !== undefined) {
    return `${anchor.sectionId}:offset:${anchor.sourceStart}:${signature}`;
  }
  if (anchor.sectionId !== undefined) {
    return `${anchor.sectionId}:document:${signature}`;
  }
  if (anchor.sourceStart !== undefined) return `offset:${anchor.sourceStart}:${signature}`;
  return `document:0:${signature}`;
}

export function markdownTableIdentity(
  document: MarkdownDocumentIdentity,
  anchor: MarkdownTableAnchor,
): MarkdownTableIdentity {
  return {
    gitRoot: document.gitRoot,
    filePath: document.filePath,
    tableId: markdownTableId(anchor),
  };
}

/**
 * Repository-aware storage key. Missing Git metadata falls back to the
 * normalized absolute file path, which keeps same-named files separate.
 */
export function markdownTableStorageKey(identity: MarkdownTableIdentity): string {
  const filePath = normalizedPath(identity.filePath);
  const root = identity.gitRoot
    ? `git:${normalizedPath(identity.gitRoot)}:${relativePath(identity.gitRoot, filePath)}`
    : `path:${filePath}`;
  return `${root}:table:${identity.tableId}`;
}

function normalizedPreferences(value: Partial<MarkdownTablePreferences> | undefined): MarkdownTablePreferences {
  const input = recordValue(value);
  const rawWidths = recordValue(input.widths);
  const widths: Record<string, number> = {};
  for (const [id, width] of Object.entries(rawWidths)) {
    if (typeof width === "number" && Number.isFinite(width) && width > 0) widths[id] = width;
  }
  const rawOrder = Array.isArray(input.order) ? input.order : [];
  const order = [...new Set(rawOrder.filter((id): id is string => typeof id === "string" && id.length > 0))];
  const rawHidden = recordValue(input.hidden);
  const hidden: Record<string, boolean> = {};
  for (const [id, isHidden] of Object.entries(rawHidden)) {
    if (typeof isHidden === "boolean") hidden[id] = isHidden;
  }
  return { widths, order, hidden };
}

function withColumns(preferences: MarkdownTablePreferences, columnIds: readonly string[]): MarkdownTablePreferences {
  const known = new Set(columnIds);
  const order = [
    ...preferences.order.filter((id) => known.has(id)),
    ...columnIds.filter((id) => !preferences.order.includes(id)),
  ];
  const widths = Object.fromEntries(Object.entries(preferences.widths).filter(([id]) => known.has(id)));
  const hidden = Object.fromEntries(Object.entries(preferences.hidden).filter(([id]) => known.has(id)));
  return { widths, order, hidden };
}

export function tablePreferencesFromState(state: MarkdownTableViewState): MarkdownTablePreferences {
  return normalizedPreferences({ widths: state.colWidth, order: state.colOrder, hidden: state.colHidden });
}

export function tableStateFromPreferences(preferences: MarkdownTablePreferences): MarkdownTableViewState {
  return {
    colWidth: preferences.widths,
    colOrder: preferences.order,
    colHidden: preferences.hidden,
  };
}

export function createTablePreferenceStore(adapter: MarkdownTablePreferenceAdapter): MarkdownTablePreferenceStore {
  const getAll = (): Record<string, MarkdownTablePreferences> => ({ ...recordValue(adapter.read()) as Record<string, MarkdownTablePreferences> });

  function get(identity: MarkdownTableIdentity, columnIds?: readonly string[]): MarkdownTablePreferences {
    const stored = normalizedPreferences(getAll()[markdownTableStorageKey(identity)]);
    return columnIds === undefined ? stored : withColumns(stored, columnIds);
  }

  function set(identity: MarkdownTableIdentity, patch: Partial<MarkdownTablePreferences>): MarkdownTablePreferences {
    const key = markdownTableStorageKey(identity);
    const all = getAll();
    const next = normalizedPreferences({ ...all[key], ...patch });
    adapter.write({ ...all, [key]: next });
    return next;
  }

  function clear(identity: MarkdownTableIdentity): void {
    const key = markdownTableStorageKey(identity);
    const all = getAll();
    delete all[key];
    adapter.write(all);
  }

  return { get, set, clear };
}

export function createMdTablePreferenceStore(host: MdviewHost = getMdviewHost()): MarkdownTablePreferenceStore {
  return createTablePreferenceStore({
    read: () => {
      const state = recordValue(host.readPluginState<MarkdownTablePluginState>(PLUGIN_ID, {}));
      return recordValue(state.tablePreferences) as Record<string, MarkdownTablePreferences>;
    },
    write: (tablePreferences) => host.savePluginState<MarkdownTablePluginState>(PLUGIN_ID, { tablePreferences }),
  });
}
