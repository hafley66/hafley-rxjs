import { act, createElement, StrictMode, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Signal } from "@hafley66/signals";
import { expect, it, vi } from "vitest";
import { installMdviewHost, type MdviewHost } from "./ports.js";
import { MdDocumentIdentityProvider, useMdDocumentIdentity } from "./4_documentIdentity.js";
import StreamdownBody from "./0_Streamdown.js";
import { withFenceOrigins } from "./0b_fenceOrigin.js";
import { markdownTableStarts } from "./6_tableAnchors.js";
import { mdDocument } from "./model.js";
import PersistedMarkdownTable from "./5_PersistedMarkdownTable.js";

it("hydrates table state after Git identity resolves and restores it on remount", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const host = document.createElement("div");
  document.body.append(host);
  let saved: Record<string, unknown> = {};
  const pathSignal = Signal("/repo/docs/guide.md");
  const children = [
    createElement("thead", null, createElement("tr", null,
      createElement("th", null, "Name"), createElement("th", null, "Value"))),
    createElement("tbody", null, createElement("tr", null,
      createElement("td", null, "alpha"), createElement("td", null, "one"))),
  ];
  installMdviewHost({
    readPluginState: () => saved,
    savePluginState: (_pluginId: string, patch: Record<string, unknown>) => { saved = { ...saved, ...patch }; },
    repoRootFor: async () => "/repo",
  } as unknown as MdviewHost);

  let root: Root | undefined = createRoot(host);
  const render = async (): Promise<void> => {
    await act(() => root!.render(
      createElement(MdDocumentIdentityProvider, { pathSignal },
        createElement(PersistedMarkdownTable, { children })),
    ));
  };
  try {
    await render();
    await vi.waitFor(() => expect(Object.keys((saved.tablePreferences ?? {}) as object)).toHaveLength(1));
    const key = Object.keys(saved.tablePreferences as Record<string, unknown>)[0]!;
    saved = {
      tablePreferences: {
        [key]: {
          widths: { "column-0": 240 },
          order: ["column-0", "column-1"],
          hidden: { "column-1": true },
        },
      },
    };

    await act(() => root!.unmount());
    root = createRoot(host);
    await render();
    await vi.waitFor(() => expect(host.querySelectorAll(".sg-head-cell")).toHaveLength(1));
    expect(host.querySelector(".sg-head-cell")?.textContent).toContain("Name");
  } finally {
    await act(() => root?.unmount());
    host.remove();
  }
});

it("keeps a delayed file switch on the current path and separates equal tables by section", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const host = document.createElement("div");
  document.body.append(host);
  let saved: Record<string, unknown> = {};
  const pathSignal = Signal("/switch/a.md");
  let resolveA!: (root: string | null) => void;
  let resolveB!: (root: string | null) => void;
  const rootA = new Promise<string | null>((resolve) => { resolveA = resolve; });
  const rootB = new Promise<string | null>((resolve) => { resolveB = resolve; });
  const roots = new Map([["/switch/a.md", rootA], ["/switch/b.md", rootB]]);
  installMdviewHost({
    readPluginState: () => saved,
    savePluginState: (_pluginId: string, patch: Record<string, unknown>) => { saved = { ...saved, ...patch }; },
    repoRootFor: async (path: string) => roots.get(path) ?? null,
  } as unknown as MdviewHost);
  function IdentityProbe(): ReactNode {
    const identity = useMdDocumentIdentity();
    return createElement("output", null, `${identity.filePath}|${identity.gitRoot ?? "pending"}|${identity.gitRootPending}`);
  }
  const children = [
    createElement("thead", null, createElement("tr", null, createElement("th", null, "Name"))),
    createElement("tbody", null, createElement("tr", null, createElement("td", null, "alpha"))),
  ];
  const root = createRoot(host);
  try {
    await act(() => root.render(createElement(MdDocumentIdentityProvider, { pathSignal }, createElement(IdentityProbe))));
    await act(() => pathSignal.$("/switch/b.md"));
    await vi.waitFor(() => expect(host.querySelector("output")?.textContent).toBe("/switch/b.md|pending|true"));
    await act(async () => { resolveA("/repo-a"); await Promise.resolve(); });
    expect(host.querySelector("output")?.textContent).toBe("/switch/b.md|pending|true");
    await act(async () => { resolveB("/repo-b"); await Promise.resolve(); });
    await vi.waitFor(() => expect(host.querySelector("output")?.textContent).toBe("/switch/b.md|/repo-b|false"));

    await act(() => root.render(createElement(MdDocumentIdentityProvider, { pathSignal },
      createElement("div", null,
        createElement(PersistedMarkdownTable, { children, tableSectionId: "one", tableOrdinal: 0 }),
        createElement(PersistedMarkdownTable, { children, tableSectionId: "two", tableOrdinal: 0 }),
      ),
    )));
    await vi.waitFor(() => expect(Object.keys((saved.tablePreferences ?? {}) as object)).toHaveLength(2));
  } finally {
    await act(() => root.unmount());
    host.remove();
  }
});

it("keeps table identities stable through StrictMode rerenders and edits before tables", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const host = document.createElement("div");
  document.body.append(host);
  let saved: Record<string, unknown> = {};
  const pathSignal = Signal("/repo/docs/guide.md");
  installMdviewHost({
    readPluginState: () => saved,
    savePluginState: (_pluginId: string, patch: Record<string, unknown>) => { saved = { ...saved, ...patch }; },
    repoRootFor: async () => "/repo",
  } as unknown as MdviewHost);
  const source = [
    "```js",
    "const table = true",
    "```",
    "",
    "| Name | Value |",
    "| --- | --- |",
    "| alpha | one |",
    "",
    "| Name | Value |",
    "| --- | --- |",
    "| beta | two |",
  ].join("\n");
  const edited = ["A paragraph inserted before the tables.", "", source].join("\n");
  const marked = (value: string): { children: string; tableStarts: readonly number[] } => ({
    children: withFenceOrigins(value, 0, mdDocument("/repo/docs/guide.md", value).blocks),
    tableStarts: markdownTableStarts(value),
  });
  const renderBody = (value: string) => {
    const input = marked(value);
    return createElement(
      StrictMode,
      null,
      createElement(
        MdDocumentIdentityProvider,
        { pathSignal },
        createElement(StreamdownBody, {
          components: {},
          dark: false,
          sectionId: "preamble",
          sourceStart: 0,
          tableStarts: input.tableStarts,
          children: input.children,
        }),
      ),
    );
  };
  const root = createRoot(host);
  try {
    await act(() => root.render(renderBody(source)));
    await vi.waitFor(() => expect(Object.keys((saved.tablePreferences ?? {}) as object)).toHaveLength(2));
    const keys = Object.keys(saved.tablePreferences as Record<string, unknown>).sort();
    await act(() => root.render(renderBody(source)));
    await vi.waitFor(() => expect(Object.keys((saved.tablePreferences ?? {}) as object).sort()).toEqual(keys));
    await act(() => root.render(renderBody(edited)));
    await vi.waitFor(() => expect(Object.keys((saved.tablePreferences ?? {}) as object).sort()).toEqual(keys));
  } finally {
    await act(() => root.unmount());
    host.remove();
  }
});

it("does not rewrite table preferences for unrelated grid sorting", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const host = document.createElement("div");
  document.body.append(host);
  let writes = 0;
  const pathSignal = Signal("/repo/docs/guide.md");
  const children = [
    createElement("thead", null, createElement("tr", null,
      createElement("th", null, "Name"), createElement("th", null, "Value"))),
    createElement("tbody", null, createElement("tr", null,
      createElement("td", null, "beta"), createElement("td", null, "2"))),
  ];
  installMdviewHost({
    readPluginState: (_pluginId: string, fallback: unknown): unknown => fallback,
    savePluginState: () => { writes += 1; },
    repoRootFor: async () => "/repo",
  } as unknown as MdviewHost);
  function Shell({ tick }: { readonly tick: number }): ReactNode {
    return createElement("div", { "data-tick": tick }, createElement(PersistedMarkdownTable, { children }));
  }
  const root = createRoot(host);
  try {
    await act(() => root.render(
      createElement(MdDocumentIdentityProvider, { pathSignal },
        createElement(Shell, { tick: 0 })),
    ));
    await vi.waitFor(() => expect(host.querySelectorAll(".sg-head-cell")).toHaveLength(2));
    await vi.waitFor(() => expect(writes).toBeGreaterThan(1));
    await new Promise((resolve) => setTimeout(resolve, 100));
    const initialWrites = writes;
    await act(() => root.render(
      createElement(MdDocumentIdentityProvider, { pathSignal }, createElement(Shell, { tick: 1 })),
    ));
    expect(writes).toBe(initialWrites);
    await act(() => host.querySelector<HTMLElement>('[data-col-id="column-0"]')!.click());
    await act(async () => { await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined))); });
    expect(writes).toBe(initialWrites);
  } finally {
    await act(() => root.unmount());
    host.remove();
  }
});
