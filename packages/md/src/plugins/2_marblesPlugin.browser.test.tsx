import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import StreamdownBody from "../0_Streamdown.js";
import { installMdviewHost, type MdviewHost } from "../ports.js";
import { MdPluginContext } from "./4_MdPluginContext.js";
import { marblesFenceBody } from "./2_marblesPlugin.fixture.js";
import { marblesPlugin } from "./marbles.js";
import "../mdview.css";

installMdviewHost({
  useRenderProbe: () => undefined,
  useLifecycleProbe: () => undefined,
  recordOperation: () => undefined,
} as unknown as MdviewHost);

const fence = "```";
const plugins = [marblesPlugin()];

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement("div");
  host.style.width = "900px";
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
});

async function render(body: string, dark: boolean): Promise<void> {
  const markdown = [`${fence}marbles`, body, fence, ""].join("\n");
  await act(() => root.render(
    <MdPluginContext.Provider value={{ plugins, columns: 80 }}>
      <StreamdownBody components={{}} dark={dark}>{markdown}</StreamdownBody>
    </MdPluginContext.Provider>,
  ));
}

/** Per lane: the label drawn in the gutter, and every marble's kind and value in column order. */
function lanes() {
  return [...host.querySelectorAll<HTMLElement>(".mdview-marbles .mb-lane")].map((lane) => ({
    lane: lane.dataset.lane,
    label: lane.querySelector(".mb-label")?.textContent,
    marbles: [...lane.querySelectorAll<HTMLElement>(".mb-marble")].map(
      (marble) => `${marble.dataset.tick} ${marble.dataset.kind}${marble.querySelector(".mb-value") ? ` ${marble.querySelector(".mb-value")?.textContent}` : ""}`,
    ),
  }));
}

function theme() {
  const fenceNode = host.querySelector<HTMLElement>(".mdview-marbles");
  const diagram = host.querySelector<HTMLElement>(".mb-root");
  const style = diagram ? getComputedStyle(diagram) : null;
  return {
    theme: fenceNode?.dataset.diagramTheme,
    surface: style?.getPropertyValue("--mb-surface").trim(),
    ink: style?.getPropertyValue("--mb-ink").trim(),
    background: style?.backgroundColor,
  };
}

it("renders a marbles fence as a signal-marbles diagram, one strip per stream, themed by md's dark prop", async () => {
  await render(marblesFenceBody, true);
  await vi.waitFor(() => expect(host.querySelectorAll(".mdview-marbles .mb-marble")).toHaveLength(10), { timeout: 20_000 });
  const dark = { title: host.querySelector(".mb-title")?.textContent, lanes: lanes(), ...theme() };
  await render(marblesFenceBody, false);
  await vi.waitFor(() => expect(host.querySelector<HTMLElement>(".mdview-marbles")?.dataset.diagramTheme).toBe("light"));
  expect({ dark, light: theme(), diagnostics: host.querySelectorAll(".mdview-marbles-error").length }).toMatchInlineSnapshot(`
    {
      "dark": {
        "background": "rgb(15, 23, 42)",
        "ink": "#f8fafc",
        "lanes": [
          {
            "label": "source",
            "lane": "source",
            "marbles": [
              "1 next a",
              "3 next b",
              "3 next c",
              "8 next d",
              "10 complete",
            ],
          },
          {
            "label": "map(v => v * 10)",
            "lane": "map-v-v-10",
            "marbles": [
              "0 subscribe",
              "1 next 10",
              "3 next 20",
              "3 next 30",
              "8 error",
            ],
          },
        ],
        "surface": "#0f172a",
        "theme": "dark",
        "title": "map(v => v * 10) throws on d",
      },
      "diagnostics": 0,
      "light": {
        "background": "rgb(248, 250, 252)",
        "ink": "#111827",
        "surface": "#f8fafc",
        "theme": "light",
      },
    }
  `);
});

it("shows the parser's diagnostics above what it could still draw", async () => {
  await render("lane : -a-(b", true);
  await vi.waitFor(() => expect(host.querySelectorAll(".mdview-marbles .mb-marble")).toHaveLength(2), { timeout: 20_000 });
  expect({
    diagnostics: host.querySelector(".mdview-marbles-error")?.textContent,
    lanes: lanes(),
  }).toMatchInlineSnapshot(`
    {
      "diagnostics": "line 1: \`(\` was never closed",
      "lanes": [
        {
          "label": "lane",
          "lane": "lane",
          "marbles": [
            "1 next a",
            "3 next b",
          ],
        },
      ],
    }
  `);
});
