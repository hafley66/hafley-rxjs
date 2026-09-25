// The markdown viewer panel body: file explorer (shared FileTree on the
// canonical TreeTable) | rendered sections, split with react-resizable-panels
// (AGENTS "Split panes"). All state lives in the signals module; signal reads
// happen here at the top (SignalReact tracks them) and flow down as props.
import { createContext, lazy, Suspense, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import type { StreamdownProps } from "streamdown";
import { SignalReact } from "@hafley66/signals/react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { getMdviewHost } from "./ports.js";
import { baseName } from "./local/core.js";
import {
  expandChain,
  resolveMdLink,
  sectionDisplayTitle,
  sliceOwn,
  type ListFolds,
  type MdBlock,
  type MdDocument,
  type MdSection,
} from "./model.js";
import { withFenceOrigins } from "./0b_fenceOrigin.js";
import { markdownTableStarts } from "./6_tableAnchors.js";
import {
  blockFoldsFor,
  collapsedFor,
  expandIds,
  initCollapsedForReadyDoc,
  layoutFor,
  loadMdDoc,
  reloadMdDoc,
  mdDocs,
  mdOpenedAt,
  mdUi,
  setAllCollapsed,
  setLayoutFor,
  setMdUi,
  toggleBlockFold,
  toggleCollapsed,
  toggleExplorer,
  type StrSignal,
} from "./signals.js";
import { setPendingFrag, takePendingFrag } from "./open.js";
import { MdExplorer } from "./MdExplorer.js";
import { useFsWatch } from "./0_watch.js";
import { useProseWidth } from "./2_useProseWidth.js";
import { CAT_COMMIT, CAT_PAINT, LOG, mdNow } from "./0_log.js";
import { ProseWidthControl, ProseWidthHandle } from "./3_ProseWidthControl.js";
import { isCodeRef } from "./lib/0_codeRef.js";
import { fenceColumns } from "./lib/4_fenceCommands.js";
import { MdPluginContext, type MdPluginScope } from "./plugins/4_MdPluginContext.js";
import "./mdview.css";
import "./1_reading.css";

const StreamdownBody = lazy(() => import("./0_Streamdown.js"));

// ---- images: local files load via read_image (data URL), like preview.ts ----

function dirOf(p: string): string {
  const i = p.lastIndexOf("/");
  return i > 0 ? p.slice(0, i) : "";
}

function MdImg({ src, alt, base }: { src?: string; alt?: string; base: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const s = src ?? "";
    if (!s) return;
    if (/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(s) || s.startsWith("data:") || s.startsWith("blob:")) {
      setUrl(s);
      return;
    }
    let dead = false;
    const abs = s.startsWith("/") || s.startsWith("~") ? s : `${dirOf(base)}/${s}`;
    getMdviewHost().readImage(abs)
      .then((u) => {
        if (!dead) setUrl(u);
      })
      .catch(() => {
        if (!dead) setUrl(null);
      });
    return () => {
      dead = true;
    };
  }, [src, base]);
  if (!url) return <span className="mdview-img-alt">{alt || "image"}</span>;
  return <img src={url} alt={alt ?? ""} />;
}

// ---- sections ----

// Offsets inside a rendered section slice are relative to the slice start;
// the fold model keys on absolute source offsets, so each section provides
// its ownStart and the list/item renderers re-base. Sections render their
// slices UNTRIMMED (leading newlines are harmless markdown) precisely so
// these offsets stay aligned.
const SliceBaseContext = createContext(0);

function FoldTwisty({
  folded,
  title,
  onToggle,
}: {
  folded: boolean;
  title: string;
  onToggle: () => void;
}) {
  return (
    <span
      className="md-twisty"
      role="button"
      tabIndex={0}
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          onToggle();
        }
      }}
    >
      {folded ? "▸" : "▾"}
    </span>
  );
}

// The fold row is an <li> because <ul>/<ol> admit only <li> children. It is
// `display: block` (mdview.css), so it is no list-item: no marker, and an
// <ol> still numbers its first real item 1.
function FoldableList({
  tag: Tag,
  count,
  folded,
  onFold,
  className,
  children,
  ...rest
}: {
  tag: "ul" | "ol";
  count: number;
  folded: boolean;
  onFold: () => void;
  className?: string;
  children?: React.ReactNode;
} & Omit<React.HTMLAttributes<HTMLElement>, "children" | "className">) {
  return (
    <Tag {...rest} className={[className, "md-foldable-list", folded ? "md-folded-list" : ""].filter(Boolean).join(" ")}>
      <li className="md-list-fold">
        <FoldTwisty folded={folded} title={folded ? "unfold list" : "fold list"} onToggle={onFold} />
      </li>
      {folded ? (
        <li className="md-fold-more" onClick={onFold}>
          … {count} item{count === 1 ? "" : "s"}
        </li>
      ) : (
        children
      )}
    </Tag>
  );
}

const NO_BLOCKS: readonly MdBlock[] = [];

// Section id -> its blocks, in document order. Blocks carry absolute offsets, so
// a section slice can be marked with each fence's origin before rendering.
function blocksBySectionOf(document: MdDocument): ReadonlyMap<string, readonly MdBlock[]> {
  const map = new Map<string, MdBlock[]>();
  for (const block of document.blocks) {
    const list = map.get(block.section);
    if (list) list.push(block);
    else map.set(block.section, [block]);
  }
  return map;
}

interface SectionProps {
  sec: MdSection;
  siblingIndex: number;
  text: string;
  blocksBySection: ReadonlyMap<string, readonly MdBlock[]>;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
  components: StreamdownProps["components"];
  dark: boolean;
}

const NO_TABLE_STARTS: readonly number[] = [];

function MarkdownBody({ children, components, dark, sectionId, sourceStart, tableStarts }: {
  children: string;
  components: SectionProps["components"];
  dark: boolean;
  sectionId?: string;
  sourceStart?: number;
  tableStarts?: readonly number[];
}) {
  return (
    <Suspense fallback={<pre><code>{children}</code></pre>}>
      <StreamdownBody components={components} dark={dark} sectionId={sectionId} sourceStart={sourceStart} tableStarts={tableStarts}>{children}</StreamdownBody>
    </Suspense>
  );
}

function SectionView({ sec, siblingIndex, text, blocksBySection, collapsed, onToggle, components, dark }: SectionProps) {
  const isCollapsed = collapsed.has(sec.id);
  // Untrimmed for rendering (offset alignment, see SliceBaseContext); the trim
  // is only the emptiness check. Fence origins ride on the fence info strings so
  // a rendered diagram can name the bytes it came from.
  const blocks = blocksBySection.get(sec.id) ?? NO_BLOCKS;
  const slice = sliceOwn(text, sec);
  const tableStarts = useMemo(() => markdownTableStarts(slice, sec.ownStart), [slice, sec.ownStart]);
  const ownRaw = isCollapsed ? "" : withFenceOrigins(slice, sec.ownStart, blocks);
  const hasOwn = slice.trim().length > 0;
  return (
    <div className="mdview-sec">
      <div
        className={`mdview-head mdview-h${sec.depth}`}
        id={sec.id}
        data-mdsec={sec.id}
        role="button"
        tabIndex={0}
        onClick={() => onToggle(sec.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle(sec.id);
          }
        }}
      >
        <span className="mdview-twisty">{isCollapsed ? "▸" : "▾"}</span>
        <span className="mdview-title" title={sectionDisplayTitle(sec.title, siblingIndex)}>{sectionDisplayTitle(sec.title, siblingIndex)}</span>
      </div>
      {!isCollapsed && (
        <div className="mdview-body">
          {hasOwn ? (
            <div className="md-body">
              <SliceBaseContext.Provider value={sec.ownStart}>
                <MarkdownBody components={components} dark={dark} sectionId={sec.id} sourceStart={sec.ownStart} tableStarts={tableStarts}>
                  {ownRaw}
                </MarkdownBody>
              </SliceBaseContext.Provider>
            </div>
          ) : null}
          {sec.children.map((c, index) => (
            <SectionView
              key={c.id}
              sec={c}
              siblingIndex={index}
              text={text}
              blocksBySection={blocksBySection}
              collapsed={collapsed}
              onToggle={onToggle}
              components={components}
              dark={dark}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export const MdPanel = SignalReact(function MdPanel({
  pid,
  pathSig,
  onNavigate,
}: {
  pid: string;
  pathSig: StrSignal;
  onNavigate: (path: string) => void;
}) {
  const host = getMdviewHost();
  const appState = host.useAppState();
  const dark = appState.dark;
  const path = pathSig.$();
  host.useRenderProbe("MdPanel", path);
  const state = mdDocs.$()[path];
  const ui = mdUi.$();
  const collapsed = collapsedFor(path).$();
  // Per-tab content zoom (generic panelZoom registry; ⌘+/-/0 when active).
  // Applied to the reading pane only — the explorer is UI chrome, and a CSS
  // zoom on the PanelGroup would skew its sash pointer math.
  const zoom = appState.panelZoom[pid] ?? 1;
  const proseWidth = useProseWidth(pid);
  const columns = fenceColumns(proseWidth.width);
  const pluginScope = useMemo((): MdPluginScope => ({
    plugins: host.mdPlugins,
    runCommand: host.runFenceCommand ? (request) => host.runFenceCommand!(request) : undefined,
    columns,
  }), [host, columns]);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // ⌘ held marks the panel, so file-citing inline code shows as a link only
  // while a ⌘-click would open it.
  useEffect(() => {
    const panel = panelRef.current;
    const view = panel?.ownerDocument.defaultView;
    if (!panel || !view) return;
    const mark = (e: KeyboardEvent | globalThis.MouseEvent) => {
      if (e.metaKey) panel.dataset.mdMeta = "";
      else delete panel.dataset.mdMeta;
    };
    const unmark = () => delete panel.dataset.mdMeta;
    view.addEventListener("keydown", mark);
    view.addEventListener("keyup", mark);
    view.addEventListener("blur", unmark);
    panel.addEventListener("mousemove", mark);
    return () => {
      view.removeEventListener("keydown", mark);
      view.removeEventListener("keyup", mark);
      view.removeEventListener("blur", unmark);
      panel.removeEventListener("mousemove", mark);
    };
  }, []);

  useEffect(() => {
    void loadMdDoc(path);
  }, [path]);
  // One record per parsed document: open → first commit holding it, and → the frame after it
  // (rAF then a task lands after that frame's paint).
  const timedDoc = useRef<unknown>(null);
  useLayoutEffect(() => {
    if (!LOG.on || state?.status !== "ready" || timedDoc.current === state.document) return;
    timedDoc.current = state.document;
    const opened = mdOpenedAt.get(path);
    if (opened === undefined) return;
    const nodes = rootRef.current?.querySelectorAll("*").length ?? 0;
    const sections = rootRef.current?.querySelectorAll(".mdview-sec").length ?? 0;
    LOG.emit(CAT_COMMIT, "commit {path} {durationMs}ms", { path, durationMs: Math.round(mdNow() - opened), nodes, sections, bytes: state.text.length });
    requestAnimationFrame(() => setTimeout(() => {
      LOG.emit(CAT_PAINT, "paint {path} {durationMs}ms", { path, durationMs: Math.round(mdNow() - opened) });
    }, 0));
  }, [path, state]);
  useFsWatch(path, () => void reloadMdDoc(path));
  useEffect(() => {
    if (state?.status === "ready") initCollapsedForReadyDoc(path);
  }, [path, state?.status]);

  const doc = state?.status === "ready" ? state.doc : null;
  const document = state?.status === "ready" ? state.document : null;
  const preambleTableStarts = useMemo(
    () => doc?.preamble
      ? markdownTableStarts(doc.preamble, document?.contentStart ?? 0)
      : NO_TABLE_STARTS,
    [doc?.preamble, document?.contentStart],
  );
  const blocksBySection = useMemo(
    () => (document ? blocksBySectionOf(document) : new Map<string, readonly MdBlock[]>()),
    [document],
  );
  const blockFolds = blockFoldsFor(path).$();
  const folds: ListFolds = useMemo(
    () =>
      doc?.folds ?? { lists: new Map(), firstItemToList: new Map(), items: new Set(), all: [] },
    [doc],
  );

  // Expand the chain to a section, then scroll it into view (the row exists
  // only after the expand re-render, hence the rAF defer).
  const jumpTo = (id: string) => {
    if (!doc) return;
    expandIds(path, expandChain(doc, id));
    requestAnimationFrame(() => {
      rootRef.current
        ?.querySelector(`[data-mdsec="${CSS.escape(id)}"]`)
        ?.scrollIntoView({ block: "start" });
    });
  };

  // Consume a #frag requested with the open/navigation, once the doc is ready.
  // jumpTo is intentionally not a dep: it reads the latest doc via signals.
  useEffect(() => {
    if (state?.status !== "ready") return;
    const frag = takePendingFrag(path);
    if (frag && doc?.byId.has(frag)) jumpTo(frag);
  }, [path, state?.status]);

  const components = useMemo<StreamdownProps["components"]>(
    () => ({
      a({ href, children }) {
        const onClick = (e: MouseEvent) => {
          if (!href) return;
          e.preventDefault();
          if (href.startsWith("#")) {
            jumpTo(decodeURIComponent(href.slice(1)));
            return;
          }
          const md = resolveMdLink(path, href);
          if (md) {
            // In-place navigation (docs-browser style): the explorer follows
            // the new doc's folder; external opens still get their own tabs.
            setPendingFrag(md.path, md.frag);
            onNavigate(md.path);
            return;
          }
          void host.openHref(href, path).catch(console.error);
        };
        return (
          <a href={href} onClick={onClick}>
            {children}
          </a>
        );
      },
      // Streamdown's own inline code markup, plus a ⌘-click that hands a
      // file-citing span to the host with this document's path.
      inlineCode({ node: _node, className, children, ...rest }) {
        const text = typeof children === "string" ? children : "";
        const openCodeRef = host.openCodeRef;
        const ref = openCodeRef !== undefined && isCodeRef(text);
        // Native, on the element: a table's grid delegates from its own root, which
        // a React stopPropagation reaches only after the grid selected the cell.
        const own = (element: HTMLElement | null) => {
          if (element === null || !ref) return;
          const swallow = (e: globalThis.MouseEvent) => {
            if (!e.metaKey) return;
            e.preventDefault();
            e.stopPropagation();
            if (e.type === "click") void openCodeRef.call(host, text, path).catch(console.error);
          };
          const types = ["pointerdown", "mousedown", "pointerup", "mouseup", "click"] as const;
          types.forEach((type) => element.addEventListener(type, swallow));
          return () => types.forEach((type) => element.removeEventListener(type, swallow));
        };
        return (
          <code
            {...rest}
            ref={own}
            className={["rounded bg-muted px-1.5 py-0.5 font-mono text-sm", className].filter(Boolean).join(" ")}
            data-streamdown="inline-code"
            data-md-ref={ref ? "" : undefined}
          >
            {children}
          </code>
        );
      },
      img({ src, alt }) {
        return <MdImg src={typeof src === "string" ? src : undefined} alt={alt ?? undefined} base={path} />;
      },
      // List folding: one twisty per list, on the list's own top edge, folds
      // the whole list to a "… N items" row. A nested list is its own list
      // with its own twisty. Items carry none. Node positions come from
      // react-markdown's hast nodes and are re-based per section
      // (SliceBaseContext) onto the absolute offsets the fold model keys on.
      ul({ node, children, ...rest }) {
        const abs = (node?.position?.start.offset ?? -1) + useContext(SliceBaseContext);
        const count = folds.lists.get(abs);
        if (count == null) return <ul {...rest}>{children}</ul>;
        return (
          <FoldableList tag="ul" count={count} folded={blockFolds.has(abs)} onFold={() => toggleBlockFold(path, abs)} {...rest}>
            {children}
          </FoldableList>
        );
      },
      ol({ node, children, ...rest }) {
        const abs = (node?.position?.start.offset ?? -1) + useContext(SliceBaseContext);
        const count = folds.lists.get(abs);
        if (count == null) return <ol {...rest}>{children}</ol>;
        return (
          <FoldableList tag="ol" count={count} folded={blockFolds.has(abs)} onFold={() => toggleBlockFold(path, abs)} {...rest}>
            {children}
          </FoldableList>
        );
      },
    }),
    // jumpTo is stable enough for the memo's purpose (reads latest via signals).
    [path, onNavigate, folds, blockFolds],
  );

  const layout = layoutFor(pid);
  const latestLayout = useRef(layout);
  const flushLayout = () => setLayoutFor(pid, latestLayout.current);

  let body: React.ReactNode;
  if (!state || state.status === "loading") {
    body = <div className="mdview-empty">loading…</div>;
  } else if (state.status === "error") {
    body = <div className="mdview-empty">{state.error}</div>;
  } else {
    const text = state.text;
    const onToggle = (id: string) => toggleCollapsed(path, id);
    const content = (
      <div className="mdview-content" ref={rootRef} style={{ ...proseWidth.style, zoom }}>
        <div className="mdview-prose-ruler">
          <ProseWidthHandle pid={pid} zoom={zoom} className="mdview-prose-handle" />
        </div>
        {state.doc.preamble ? (
          <div className="md-body">
            <SliceBaseContext.Provider value={0}>
                <MarkdownBody
                  components={components}
                  dark={dark}
                  sectionId="preamble"
                  sourceStart={state.document.contentStart}
                  tableStarts={preambleTableStarts}
                >
                {withFenceOrigins(state.doc.preamble, state.document.contentStart, blocksBySection.get("preamble") ?? NO_BLOCKS)}
              </MarkdownBody>
            </SliceBaseContext.Provider>
          </div>
        ) : null}
        {state.doc.tree.map((s, index) => (
          <SectionView
            key={s.id}
            sec={s}
            siblingIndex={index}
            text={text}
            blocksBySection={blocksBySection}
            collapsed={collapsed}
            onToggle={onToggle}
            components={components}
            dark={dark}
          />
        ))}
        {!state.doc.tree.length && !state.doc.preamble ? (
          <div className="mdview-empty">empty document</div>
        ) : null}
      </div>
    );
    body = ui.explorerHidden ? (
      content
    ) : (
      <PanelGroup
        key="with-explorer"
        direction="horizontal"
        className="mdview-split"
        onLayout={(l) => {
          latestLayout.current = l;
        }}
      >
        <Panel defaultSize={layout[0]} minSize={14} maxSize={60} className="mdview-explorer-panel">
          <MdExplorer docPath={path} onNavigate={onNavigate} />
        </Panel>
        <PanelResizeHandle
          className="meme-sash meme-sash-vertical"
          onDragging={(dragging) => {
            if (!dragging) flushLayout();
          }}
          onBlur={flushLayout}
        />
        <Panel defaultSize={layout[1]}>{content}</Panel>
      </PanelGroup>
    );
  }

  return (
    <div
      ref={panelRef}
      className="v2-panel mdview-root"
      data-md-sticky-headers={appState.mdStickyHeaders ? "" : undefined}
      onKeyDown={(e) => {
        // Plain `b` toggles the explorer when the keystroke isn't headed for
        // an editable target (the tree's filter box, buttons, …).
        if (
          e.key === "b" &&
          !e.metaKey &&
          !e.ctrlKey &&
          !e.altKey &&
          !(e.target instanceof HTMLInputElement) &&
          !(e.target instanceof HTMLTextAreaElement)
        ) {
          toggleExplorer();
        }
      }}
    >
      <div className="act-bar">
        <button
          type="button"
          onClick={toggleExplorer}
          title="toggle file explorer (b)"
        >
          {ui.explorerHidden ? "▸ explorer" : "◂ explorer"}
        </button>
        <span className="spy-title" title={path}>
          {baseName(path)}
        </span>
        <button type="button" onClick={() => setAllCollapsed(path, true)} title="fold every section">
          fold all
        </button>
        <button type="button" onClick={() => setAllCollapsed(path, false)} title="expand every section">
          unfold all
        </button>
        <label className="mdview-opt" title="new documents open fully folded (outline first)">
          <input
            type="checkbox"
            checked={ui.startFolded}
            onChange={(e) => setMdUi({ startFolded: e.target.checked })}
          />
          fold on open
        </label>
        {zoom !== 1 ? (
          <button type="button" onClick={() => host.resetPanelZoom(pid)} title="content zoom — reset (⌘0)">
            {Math.round(zoom * 100)}%
          </button>
        ) : null}
        <span className="spy-spacer" />
        <details className="mdview-reading-options">
          <summary>reading width</summary>
          <ProseWidthControl pid={pid} className="mdview-width-controls" />
        </details>
        <button type="button" onClick={() => void host.openPath(path).catch(console.error)} title="open in the OS default app">
          ↗ external
        </button>
      </div>
      <MdPluginContext.Provider value={pluginScope}>{body}</MdPluginContext.Provider>
    </div>
  );
});
