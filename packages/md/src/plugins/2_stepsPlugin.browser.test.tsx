import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import StreamdownBody from "../0_Streamdown.js";
import { installMdviewHost, type MdviewHost } from "../ports.js";
import "../mdview.css";
import { codePlugin } from "./index.js";
import { stepsPlugin } from "./steps.js";
import { MdPluginContext, type MdPluginScope } from "./4_MdPluginContext.js";

installMdviewHost({
  useRenderProbe: () => undefined,
  useLifecycleProbe: () => undefined,
  recordOperation: () => undefined,
} as unknown as MdviewHost);

const fence = "```";
const markdown = [
  `${fence}steps ts`,
  "--- step start",
  "const total = items.length",
  "--- step count done items",
  "@@ -1 +1,3 @@",
  "-const total = items.length",
  "+const total = items",
  "+  .filter((item) => item.done)",
  "+  .length",
  fence,
  "",
].join("\n");

const scope: MdPluginScope = { plugins: [stepsPlugin(), codePlugin()], columns: 80 };
let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement("div");
  host.style.width = "700px";
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
});

function shape() {
  const figure = host.querySelector<HTMLElement>(".md-steps");
  return {
    step: figure?.dataset.step,
    steps: figure?.dataset.steps,
    count: figure?.querySelector(".md-steps-count")?.textContent,
    title: figure?.querySelector(".md-steps-title")?.textContent,
    code: figure?.querySelector(".md-steps-pre")?.textContent,
    coloured: figure ? [...figure.querySelectorAll<HTMLElement>(".md-steps-token")].some((token) => token.style.color !== "") : false,
  };
}

it("a steps fence renders step 0, then next animates to the patched step 1", async () => {
  await act(() => root.render(
    <MdPluginContext.Provider value={scope}>
      <StreamdownBody components={{}} dark>{markdown}</StreamdownBody>
    </MdPluginContext.Provider>,
  ));
  await vi.waitFor(() => expect(shape().coloured).toBe(true), { timeout: 30_000 });
  const first = shape();
  const next = host.querySelector<HTMLButtonElement>(".md-steps-next");
  if (!next) throw new Error("no next button");
  await userEvent.click(next);
  await vi.waitFor(() => expect(shape().step).toBe("1"));
  const animating = host.querySelector(".md-steps-pre")?.getAnimations({ subtree: true }).length ?? 0;
  await page.screenshot({ path: "../../out/lab/screens/steps-plugin-step1.png", element: host });
  expect({ first, second: shape(), animating: animating > 0 }).toMatchInlineSnapshot(`
    {
      "animating": true,
      "first": {
        "code": "const total = items.length",
        "coloured": true,
        "count": "1 / 2",
        "step": "0",
        "steps": "2",
        "title": "start",
      },
      "second": {
        "code": "const total = items
      .filter((item) => item.done)
      .length",
        "coloured": true,
        "count": "2 / 2",
        "step": "1",
        "steps": "2",
        "title": "count done items",
      },
    }
  `);
});
