import { createElement, useEffect, useMemo, type ReactNode } from "react";
import { useSignal } from "@hafley66/signals/react";
import { Signal } from "@hafley66/signals";
import type { GridState } from "@hafley66/signal-grid";
import MarkdownTable, { type MarkdownTableProps } from "./2_MarkdownTable.js";
import { markdownTableModel } from "./lib/1_tableModel.js";
import {
  createMdTablePreferenceStore,
  markdownTableIdentity,
  markdownTableStorageKey,
  tablePreferencesFromState,
  tableStateFromPreferences,
  type MarkdownTableViewState,
} from "./3_tablePersistence.js";
import { useOptionalMdDocumentIdentity, type MdDocumentIdentity } from "./4_documentIdentity.js";

interface MarkdownTableNode {
  readonly position?: {
    readonly start?: { readonly offset?: number };
  };
}

export interface PersistedMarkdownTableProps extends MarkdownTableProps {
  readonly node?: MarkdownTableNode;
  readonly tableSectionId?: string;
  readonly tableOrdinal?: number;
}

/**
 * Supplies MarkdownTable's caller-owned state signal from the md plugin store.
 * The table itself remains responsible for rendering and grid gestures.
 */
export default function PersistedMarkdownTable({ children, model, node, tableSectionId, tableOrdinal }: PersistedMarkdownTableProps): ReactNode {
  const document = useOptionalMdDocumentIdentity();
  if (!document) return createElement(MarkdownTable, { children, model });
  return createElement(PersistedTable, { children, model, node, document, tableSectionId, tableOrdinal });
}

function PersistedTable({ children, model: suppliedModel, node, document, tableSectionId, tableOrdinal }: PersistedMarkdownTableProps & { readonly document: MdDocumentIdentity }): ReactNode {
  const model = useMemo(() => suppliedModel ?? markdownTableModel(children), [children, suppliedModel]);
  const columnIds = useMemo(() => model.headers.map((_, index) => `column-${index}`), [model.headers.length]);
  const sourceStart = node?.position?.start?.offset;
  const headerSignature = model.headerValues.join("\u001f");
  const identity = useMemo(
    () => markdownTableIdentity(document, {
      sectionId: tableSectionId,
      ordinal: tableOrdinal,
      sourceStart,
      headerValues: model.headerValues,
    }),
    [document.filePath, document.gitRoot, headerSignature, sourceStart, tableSectionId, tableOrdinal],
  );
  const store = useMemo(() => createMdTablePreferenceStore(), []);
  const storageKey = markdownTableStorageKey(identity);
  const columnSignature = columnIds.join("\u001f");
  const tableState = useMemo(
    () => document.gitRootPending
      ? Signal<Partial<GridState>>({})
      : Signal<Partial<GridState>>(tableStateFromPreferences(store.get(identity, columnIds))),
    [document.gitRootPending, storageKey, columnSignature, store],
  );
  const colWidth = useSignal(tableState.colWidth.$) ?? {};
  const colOrder = useSignal(tableState.colOrder.$) ?? [];
  const colHidden = useSignal(tableState.colHidden.$) ?? {};
  const liveState: MarkdownTableViewState = { colWidth, colOrder, colHidden };

  useEffect(() => {
    if (document.gitRootPending) return;
    store.set(identity, tablePreferencesFromState(liveState));
  }, [document.gitRootPending, identity, colWidth, colOrder, colHidden, store]);

  const renderKey = `${storageKey}:${document.gitRootPending ? "pending" : "ready"}`;
  return createElement(MarkdownTable, { key: renderKey, children, model, tableState });
}
