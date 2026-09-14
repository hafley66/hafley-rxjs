import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import StreamdownBody from "./0_Streamdown.js";
import { installMdviewHost, type MdviewHost } from "./ports.js";
import "./mdview.css";

const fence = "```";
const body = [
  "# Diagrams",
  "",
  `${fence}mermaid`,
  "sequenceDiagram",
  "  participant Alice",
  "  participant Bob",
  "  Alice->>Bob: hello",
  "  Bob->>Alice: hi back",
  fence,
  "",
  `${fence}mermaid`,
  "flowchart TD",
  "  A[Start] --> B[End]",
  fence,
  "",
  `${fence}d2`,
  "shape: sequence_diagram",
  "alice: Alice",
  "bob: Bob",
  "alice -> bob: hello",
  fence,
  "",
  `${fence}d2`,
  "start -> finish: plain",
  fence,
  "",
].join("\n");

installMdviewHost({
  useRenderProbe: () => undefined,
  useLifecycleProbe: () => undefined,
  recordOperation: () => undefined,
} as unknown as MdviewHost);

async function settle(predicate: () => boolean, timeoutMs = 100_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
    if (predicate()) return;
  }
  throw new Error(`timed out waiting for the diagram fences to settle: ${document.body.innerHTML.slice(0, 4000)}`);
}

it("routes sequence fences through grapht and leaves every other fence on the SVG path", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const container = document.createElement("div");
  container.style.width = "1200px";
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(() => root.render(<StreamdownBody components={{}} dark={false}>{body}</StreamdownBody>));
    const hosts = () => [...container.querySelectorAll<HTMLElement>("[data-grapht-host]")];
    const pure = (selector: string) =>
      [...container.querySelectorAll<HTMLElement>(selector)].filter((element) => element.querySelector("svg") !== null);
    await settle(() =>
      hosts().every((element) => element.dataset.graphtItems !== undefined) &&
      hosts().length === 2 &&
      pure(".mdview-mermaid").length === 1 &&
      pure(".mdview-d2").length === 1,
    );
    expect(container.querySelectorAll(".mdview-sequence-error")).toHaveLength(0);
    expect({
      graphtLanguages: hosts().map((element) => element.dataset.graphtHost).sort(),
      graphtCanvases: hosts().every((element) => element.querySelector("canvas") !== null),
      graphtNativeItems: Object.fromEntries(hosts().map((element) => [element.dataset.graphtHost, Number(element.dataset.graphtItems) > 1])),
      pureMermaid: pure(".mdview-mermaid").length,
      pureD2: pure(".mdview-d2").length,
      pureMermaidIsFlowchart: pure(".mdview-mermaid")[0]?.textContent?.includes("Start") ?? false,
    }).toMatchInlineSnapshot(`
      {
        "graphtCanvases": true,
        "graphtLanguages": [
          "d2",
          "mermaid",
        ],
        "graphtNativeItems": {
          "d2": true,
          "mermaid": true,
        },
        "pureD2": 1,
        "pureMermaid": 1,
        "pureMermaidIsFlowchart": true,
      }
    `);
  } finally {
    await act(() => root.unmount());
    container.remove();
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  }
});
