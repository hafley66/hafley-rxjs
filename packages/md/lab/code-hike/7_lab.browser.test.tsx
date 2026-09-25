import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { installMdviewHost, type MdviewHost } from "../../src/ports.js";
import "../../src/mdview.css";
import { CodeHikeLab } from "./6_Lab.js";

installMdviewHost({
  useRenderProbe: () => undefined,
  useLifecycleProbe: () => undefined,
  recordOperation: () => undefined,
} as unknown as MdviewHost);

const SHOTS = "../../out/lab/screens";
let host: HTMLDivElement;
let root: Root;

beforeAll(async () => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  await act(() => root.render(<CodeHikeLab />));
  Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
});

afterAll(async () => {
  await act(() => root.unmount());
  host.remove();
});

const demo = (name: string) => {
  const node = host.querySelector<HTMLElement>(`[data-demo="${name}"]`);
  if (!node) throw new Error(`no demo ${name}`);
  return node;
};
const preText = (name: string) => demo(name).querySelector("pre")?.textContent ?? "";
const button = (name: string, label: string) =>
  [...demo(name).querySelectorAll("button")].find((node) => node.textContent === label) ?? null;

it("annotated demo: mark, focus and callout come from comments with no MDX", async () => {
  await vi.waitFor(() => expect(demo("annotated").querySelector(".ch-callout")).not.toBeNull(), { timeout: 30_000 });
  const annotated = demo("annotated");
  annotated.scrollIntoView();
  expect({
    marked: [...annotated.querySelectorAll("[data-mark]")].map((line) => line.textContent),
    focused: annotated.querySelectorAll("[data-focus]").length,
    dimmed: annotated.querySelectorAll(".ch-focus-dim:not([data-focus])").length,
    callout: annotated.querySelector(".ch-callout")?.textContent,
    annotationCommentsLeft: preText("annotated").includes("// !"),
  }).toMatchInlineSnapshot(`
    {
      "annotationCommentsLeft": false,
      "callout": "completes after three values",
      "dimmed": 4,
      "focused": 5,
      "marked": [
        "  map((n) => n * 2),
    ",
      ],
    }
  `);
  await page.screenshot({ path: `${SHOTS}/1-annotated.png`, element: annotated });
});

it("token transitions demo: next swaps the code and animates tokens", async () => {
  await vi.waitFor(() => expect(preText("transitions")).toContain("items.length"), { timeout: 30_000 });
  const before = preText("transitions");
  const next = button("transitions", "next");
  if (!next) throw new Error("no next button");
  await userEvent.click(next);
  await vi.waitFor(() => expect(preText("transitions")).not.toBe(before));
  const animating = document.getAnimations().length > 0;
  demo("transitions").scrollIntoView();
  await page.screenshot({ path: `${SHOTS}/2-transitions-mid.png`, element: demo("transitions") });
  expect({ before, after: preText("transitions"), animating }).toMatchInlineSnapshot(`
    {
      "after": "const total = items
      .filter((item) => item.done)
      .length",
      "animating": true,
      "before": "const total = items.length",
    }
  `);
});

it("scrollycoding demo: MDX steps parse into title, prose and code, the sticky panel follows selection", async () => {
  await vi.waitFor(() => expect(demo("scrolly").querySelectorAll(".ch-scrolly-step")).toHaveLength(3), { timeout: 30_000 });
  await vi.waitFor(() => expect(preText("scrolly")).toContain("interval"), { timeout: 30_000 });
  const steps = [...demo("scrolly").querySelectorAll<HTMLElement>(".ch-scrolly-step")];
  const first = preText("scrolly");
  await userEvent.click(steps[2]);
  await vi.waitFor(() => expect(preText("scrolly")).toContain("take(3)"));
  expect({
    titles: steps.map((step) => step.querySelector("h3")?.textContent),
    prose: steps.map((step) => step.querySelector("p")?.textContent),
    first,
    third: preText("scrolly"),
    selected: steps.map((step) => step.dataset.selected),
  }).toMatchInlineSnapshot(`
    {
      "first": "const ticks$ = interval(1000)",
      "prose": [
        "An interval emits forever.",
        "map turns each tick into a label.",
        "take(3) completes the stream.",
      ],
      "selected": [
        "false",
        "false",
        "true",
      ],
      "third": "const ticks$ = interval(1000).pipe(
      map((n) => \`tick \${n}\`),
      take(3),
    )",
      "titles": [
        "Start with a source",
        "Shape the values",
        "Bound it",
      ],
    }
  `);
  steps[1].scrollIntoView({ block: "start" });
  await page.screenshot({ path: `${SHOTS}/3-scrolly.png` });
});

it("fence demo: a ```hike fence inside Streamdown renders through Code Hike", async () => {
  await vi.waitFor(() => expect(demo("fence").querySelector(".ch-pre .ch-callout")).not.toBeNull(), { timeout: 30_000 });
  demo("fence").scrollIntoView();
  expect({
    marked: [...demo("fence").querySelectorAll("[data-mark]")].map((line) => line.textContent),
    callout: demo("fence").querySelector(".ch-callout")?.textContent,
    code: demo("fence").querySelector(".ch-pre")?.textContent,
  }).toMatchInlineSnapshot(`
    {
      "callout": "a macro, hence the bang",
      "code": "fn main() {
        let total: u32 = (1..=10).sum();
        println!("{total}");
    a macro, hence the bang}
    ",
      "marked": [
        "    let total: u32 = (1..=10).sum();
    ",
      ],
    }
  `);
  await page.screenshot({ path: `${SHOTS}/4-fence.png`, element: demo("fence") });
});

it("magic-move demo: same steps through @shikijs/magic-move", async () => {
  await vi.waitFor(() => expect(demo("magic-move").querySelector(".shiki-magic-move-container")?.textContent).toContain("items.length"), { timeout: 30_000 });
  const next = button("magic-move", "next");
  if (!next) throw new Error("no next button");
  await userEvent.click(next);
  await vi.waitFor(() => expect(demo("magic-move").textContent).toContain("filter"));
  demo("magic-move").scrollIntoView();
  await page.screenshot({ path: `${SHOTS}/5-magic-move-mid.png`, element: demo("magic-move") });
  await vi.waitFor(() => expect(demo("magic-move").querySelectorAll(".shiki-magic-move-leave-active, .shiki-magic-move-enter-active")).toHaveLength(0), { timeout: 5_000 });
  expect(demo("magic-move").querySelector(".shiki-magic-move-container")?.textContent).toMatchInlineSnapshot(`"const total = items  .filter((item) => item.done)  .length"`);
});
