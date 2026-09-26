import { describe, expect, it } from "vitest";
import { firstValueFrom } from "rxjs";
import { loadMermaid$, renderDiagram$, type DiagramPalette, type RenderableDiagram } from "./2_terminalDiagramRender.js";

const palette: DiagramPalette = {
  background: "#0f172a", surface: "#1e293b", surfaceAlt: "#172554", surfaceMuted: "#3f1d2e",
  text: "#f8fafc", border: "#94a3b8", line: "#cbd5e1",
};
const fence = (code: string, inferred = false, stripped = false): RenderableDiagram => ({ language: "mermaid", code, inferred, stripped });
const missingBundleUrl = new URL("./__missing_mermaid_bundle__.js", import.meta.url).href;
const emptyBundleUrl = new URL("./3_emptyMermaid.js", import.meta.url).href;
function pendingScript(): HTMLScriptElement {
  const scripts = [...document.head.querySelectorAll<HTMLScriptElement>("script")];
  const script = scripts.at(-1);
  if (!script) throw new Error("Mermaid loader did not append a script");
  return script;
}
function svgSummary(svg: string) {
  const root = new DOMParser().parseFromString(svg, "image/svg+xml").documentElement;
  return {
    tag: root.localName,
    viewBox: root.hasAttribute("viewBox"),
    labels: [...root.querySelectorAll("text, p, span")].map((label) => label.textContent?.trim()).filter((label) => label === "A" || label === "B" || label === "C"),
    colors: Object.values(palette).filter((color) => svg.toLowerCase().includes(color)).sort(),
  };
}
describe("mermaid bundle loader", () => {
  it("reports the network reason a script element hides", async () => {
    await expect(firstValueFrom(loadMermaid$("http://127.0.0.1:1/__missing_mermaid_bundle__.js")))
      .rejects.toThrow(/did not load: TypeError:/);
  });
  it("reports the served status when the bundle is reachable but never executes", async () => {
    await expect(firstValueFrom(loadMermaid$(missingBundleUrl))).rejects.toThrow(/did not load: HTTP 404/);
  });
  it("names the missing global when the bundle runs without publishing its API", async () => {
    await expect(firstValueFrom(loadMermaid$(emptyBundleUrl)))
      .rejects.toThrow(/ran without defining globalThis\.mermaid/);
  });
  it("removes the script when its observer leaves before load", () => {
    const subscription = loadMermaid$().subscribe();
    const script = pendingScript();
    subscription.unsubscribe();
    expect(script.isConnected).toBe(false);
  });
  it("retries after a failed load instead of holding the rejected attempt", async () => {
    const first = firstValueFrom(loadMermaid$(missingBundleUrl));
    const firstScript = pendingScript();
    await expect(first).rejects.toThrow(/HTTP 404/);
    const second = firstValueFrom(loadMermaid$(missingBundleUrl));
    const secondScript = pendingScript();
    expect(secondScript).not.toBe(firstScript);
    await expect(second).rejects.toThrow(/HTTP 404/);
  });
  it("shares one in-flight script and removes it after the final observer", async () => {
    const first = firstValueFrom(loadMermaid$());
    const script = pendingScript();
    const second = firstValueFrom(loadMermaid$());
    expect(pendingScript()).toBe(script);
    const [firstApi, secondApi] = await Promise.all([first, second]);
    expect(firstApi).toBe(secondApi);
    expect(typeof firstApi.render).toBe("function");
    expect(script.isConnected).toBe(false);
  });
});

describe("Mermaid rendering", () => {
  it("keeps the full source when Mermaid accepts it", async () => {
    const code = "flowchart LR\n  A --> B\n  B --> C";
    const result = await firstValueFrom(renderDiagram$(fence(code, false, true), palette, true));
    expect({ code: result.code, lineCount: result.lineCount, svg: svgSummary(result.svg) }).toMatchInlineSnapshot(`
      {
        "code": "flowchart LR
        A --> B
        B --> C",
        "lineCount": 3,
        "svg": {
          "colors": [
            "#0f172a",
            "#1e293b",
            "#3f1d2e",
            "#94a3b8",
            "#cbd5e1",
            "#f8fafc",
          ],
          "labels": [
            "A",
            "B",
            "C",
          ],
          "tag": "svg",
          "viewBox": true,
        },
      }
    `);
  });
  it("never accepts a diagram declaration without a body", async () => {
    const code = "flowchart LR\n  A --> B\n  B -->";
    const result = await firstValueFrom(renderDiagram$(fence(code, false, true), palette, true));
    expect({ code: result.code, lineCount: result.lineCount, svg: svgSummary(result.svg) }).toMatchInlineSnapshot(`
      {
        "code": "flowchart LR
        A --> B",
        "lineCount": 2,
        "svg": {
          "colors": [
            "#0f172a",
            "#1e293b",
            "#3f1d2e",
            "#94a3b8",
            "#cbd5e1",
            "#f8fafc",
          ],
          "labels": [
            "A",
            "B",
          ],
          "tag": "svg",
          "viewBox": true,
        },
      }
    `);
  });
  it("bounds tail recovery for large malformed inferred sources", async () => {
    const code = ["flowchart LR", ...Array.from({ length: 18 }, () => "  A -->")].join("\n");
    await expect(firstValueFrom(renderDiagram$(fence(code, true), palette, true))).rejects.toThrow(/Parse error|Syntax error/);
  });
  it("attempts a one-line explicit Mermaid source once", async () => {
    await expect(firstValueFrom(renderDiagram$(fence("flowchart LR A -->"), palette, true))).rejects.toThrow(/Parse error|Syntax error/);
  });
});

it("normalizes both built-in D2 palettes", async () => {
  const variants = await Promise.all([false, true].map(async (dark) => {
    const rendered = await firstValueFrom(renderDiagram$({ language: "d2", code: "a -> b", inferred: false }, palette, dark));
    const doc = new DOMParser().parseFromString(rendered.svg, "image/svg+xml");
    return { dark,
      colors: [...new Set((rendered.svg.match(/#[0-9a-fA-F]{6}/g) ?? []).map((color) => color.toLowerCase()))].sort(),
      attrs: [...doc.querySelectorAll("[fill], [stroke]")].slice(0, 8).map((element) => ({ tag: element.tagName, fill: element.getAttribute("fill"), stroke: element.getAttribute("stroke") })),
    };
  }));
  expect(variants).toMatchInlineSnapshot(`
    [
      {
        "attrs": [
          {
            "fill": "#0f172a",
            "stroke": null,
            "tag": "rect",
          },
          {
            "fill": "#1e293b",
            "stroke": "#94a3b8",
            "tag": "rect",
          },
          {
            "fill": "#f8fafc",
            "stroke": null,
            "tag": "text",
          },
          {
            "fill": "#1e293b",
            "stroke": "#94a3b8",
            "tag": "rect",
          },
          {
            "fill": "#f8fafc",
            "stroke": null,
            "tag": "text",
          },
          {
            "fill": "#cbd5e1",
            "stroke": null,
            "tag": "polygon",
          },
          {
            "fill": "none",
            "stroke": "#cbd5e1",
            "tag": "path",
          },
          {
            "fill": "#0f172a",
            "stroke": null,
            "tag": "rect",
          },
        ],
        "colors": [
          "#0f172a",
          "#172554",
          "#1e293b",
          "#3f1d2e",
          "#94a3b8",
          "#cbd5e1",
          "#f8fafc",
        ],
        "dark": false,
      },
      {
        "attrs": [
          {
            "fill": "#0f172a",
            "stroke": null,
            "tag": "rect",
          },
          {
            "fill": "#1e293b",
            "stroke": "#94a3b8",
            "tag": "rect",
          },
          {
            "fill": "#f8fafc",
            "stroke": null,
            "tag": "text",
          },
          {
            "fill": "#1e293b",
            "stroke": "#94a3b8",
            "tag": "rect",
          },
          {
            "fill": "#f8fafc",
            "stroke": null,
            "tag": "text",
          },
          {
            "fill": "#cbd5e1",
            "stroke": null,
            "tag": "polygon",
          },
          {
            "fill": "none",
            "stroke": "#cbd5e1",
            "tag": "path",
          },
          {
            "fill": "#0f172a",
            "stroke": null,
            "tag": "rect",
          },
        ],
        "colors": [
          "#0f172a",
          "#1e293b",
          "#3f1d2e",
          "#94a3b8",
          "#cbd5e1",
          "#f8fafc",
        ],
        "dark": true,
      },
    ]
  `);
});
