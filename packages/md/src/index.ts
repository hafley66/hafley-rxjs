// The mdview plugin: markdown viewer dock panels (`md:<path>`) plus the
// Config-panel toggle for the fold default. Routing callers (preview.ts,
// clickrules.ts) use openMarkdownPanel from ./open — re-exported here for
// convenience.
import { createElement, useCallback, useEffect } from "react";
import type { IDockviewPanelProps } from "dockview";
import { getMdviewHost } from "./ports.js";
import { baseName, MD_EXTS } from "./local/core.js";
import { MdPanel } from "./MdPanel.js";
import { MdPanelActivation } from "./lib/0_panelActivation.js";
import { loadPersistedMdUi, mdUi, pathSignalFor, setMdUi } from "./signals.js";
import { registerMdNav, openMarkdownPanel } from "./open.js";
import { MdDocumentIdentityProvider } from "./4_documentIdentity.js";

export { openMarkdownPanel } from "./open.js";
export { installMdviewHost, getMdviewHost } from "./ports.js";
export { setMdLogEmit, type LogEmit as MdLogEmit } from "./0_log.js";
export type { MdviewHost } from "./ports.js";
export type {
  MdFenceCommand,
  MdFenceCommandRequest,
  MdFenceCommandResult,
  MdFenceCommandRunner,
  MdFenceProps,
  MdPlugin,
  MdTableProps,
} from "./plugins/0_types.js";
export { DiagramLightbox, diagramSvgMarkup } from "./0_DiagramLightbox.js";
export type { DiagramLightboxEntry } from "./0_DiagramLightbox.js";
export { d2ThemeId, diagramPalette, mermaidTheme } from "./0_diagramTheme.js";
export { SequenceDiagram } from "./0b_SequenceDiagram.js";
export { isSequenceSource, type DiagramLanguage } from "./0b_isSequenceSource.js";
export { sequenceFrame, sequenceFrameWithSource, sequenceRenderReceipt } from "./0b_sequenceFrame.js";
export type { SequenceFrameBuild, SequenceSourceIndex } from "./0b_sequenceFrame.js";
export { absoluteSpan, fenceOriginOf, renderedOffsetsForSourceStarts, withFenceOrigins } from "./0b_fenceOrigin.js";
export type { FenceOrigin } from "./0b_fenceOrigin.js";
export { releaseSequenceSource, sequenceSourceIndex, sourceSpanOfElement } from "./0b_sequenceSource.js";
export { renderMermaidSvg } from "./0a_mermaid.js";
export { preloadD2, renderD2 } from "./d2.js";
export { ProseWidthControl, ProseWidthHandle } from "./3_ProseWidthControl.js";
export { useProseWidth } from "./2_useProseWidth.js";
export {
  createMdTablePreferenceStore,
  createTablePreferenceStore,
  markdownTableId,
  markdownTableIdentity,
  markdownTableStorageKey,
  tablePreferencesFromState,
  tableStateFromPreferences,
} from "./3_tablePersistence.js";
export type {
  MarkdownTableAnchor,
  MarkdownTableIdentity,
  MarkdownDocumentIdentity,
  MarkdownTablePluginState,
  MarkdownTablePreferenceAdapter,
  MarkdownTablePreferences,
  MarkdownTablePreferenceStore,
  MarkdownTableViewState,
} from "./3_tablePersistence.js";
export { MdDocumentIdentityProvider, resolveMdGitRoot, useMdDocumentIdentity, useOptionalMdDocumentIdentity } from "./4_documentIdentity.js";
export type { MdDocumentIdentity } from "./4_documentIdentity.js";
export { default as PersistedMarkdownTable } from "./5_PersistedMarkdownTable.js";
export {
  clampProseWidth,
  normalizeProseWidthBounds,
  DEFAULT_PROSE_WIDTH,
  DEFAULT_PROSE_WIDTH_BOUNDS,
} from "./lib/1_proseWidth.js";
export { blockAt, mdDocument, parseMdSections } from "./model.js";
export { isMarkdownPath, markdownHeadingRows, type MarkdownHeadingRow } from "./lib/0_markdownTree.js";
export { DiagramRenderCache } from "./lib/0_diagramRenderCache.js";
export { markdownTableStarts } from "./6_tableAnchors.js";
export type { MdBlock, MdBlockKind, MdDocument, SourceSpan } from "./model.js";

function MdInstance(props: IDockviewPanelProps) {
  const pid = String(props.params.panelId ?? "");
  const initial = String(props.params.path ?? "");
  const sig = pathSignalFor(pid, initial);
  // The one navigate path for explorer clicks, in-doc links, and external
  // re-opens: swap the document signal and retitle the tab.
  const navigate = useCallback(
    (p: string) => {
      sig.$(p);
      props.api.setTitle(baseName(p));
      // Keep params in step with the signal so a reload restores the doc the
      // user navigated to, not the one the tab was opened with.
      props.api.updateParameters({ panelId: pid, path: p });
    },
    [pid, props.api, sig],
  );
  useEffect(() => registerMdNav(pid, navigate), [pid, navigate]);
  return createElement(
    MdPanelActivation,
    { api: props.api },
    createElement(
      MdDocumentIdentityProvider,
      { pathSignal: sig },
      createElement(MdPanel, { pid, pathSig: sig, onNavigate: navigate }),
    ),
  );
}

export function registerMdview() {
  const host = getMdviewHost();
  loadPersistedMdUi(); // seed mdUi from persisted state now that a host exists
  host.registerPlugin({
    id: "md",
    panels: [], // no rail button: panels are per-file, opened via routing
    options: [
      {
        id: "mdStartFolded",
        label: "Markdown: open folded (outline first)",
        hint: "docs open with every section collapsed to its headings; unfold per section or with 'unfold all'",
        get: () => mdUi.$().startFolded,
        set: (on) => setMdUi({ startFolded: on }),
      },
    ],
    instances: [{
      id: "md",
      prefix: "md:",
      componentName: "mdview-instance",
      component: MdInstance,
      // params.path is the whole state: the panel re-reads the doc on mount, so
      // an open markdown tab comes back after a reload. A path that has since
      // moved renders the load error in the tab (no wedged restore).
      restorable: true,
      // A hidden tab keeps its DOM: re-rendering a long document on every tab
      // switch reset its scroll to the top.
      keepAlive: true,
    }],
    routes: [
      {
        id: "markdown",
        open: (path) => {
          const ext = path.split(".").pop()?.toLowerCase() ?? "";
          if (!MD_EXTS.has(ext)) return false;
          openMarkdownPanel(path);
          return true;
        },
      },
    ],
  });
  // Per-tab content zoom (⌘+/-/0 while the panel is active). Declarative:
  // MdPanel reads the factor from store.panelZoom and styles the content.
  host.registerZoomKind({ prefix: "md:", min: 0.5, max: 2.5, step: 0.1 });
}

export {
  normalizeSvgEntities,
  panSvgBox,
  svgBoxAtZoom,
  svgCssTransform,
  svgFitBox,
  svgMinimumZoom,
  svgNativeBox,
  svgNeedsRepaint,
  svgPaintBox,
  svgSourceBox,
  type SvgBox,
} from "./lib/0_svgSurface.js";
