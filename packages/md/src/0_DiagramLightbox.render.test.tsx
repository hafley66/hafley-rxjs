import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { DiagramLightbox } from "./0_DiagramLightbox.js";

const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
function visibleBox(stage: HTMLElement) {
  const svg = stage.querySelector("svg")!;
  const [x, y, width, height] = svg.getAttribute("viewBox")!.split(" ").map(Number);
  const transform = new DOMMatrix(svg.style.transform);
  const w = width / (3 * transform.a), h = height / (3 * transform.d);
  return [x - transform.e * w / stage.clientWidth, y - transform.f * h / stage.clientHeight, w, h].map((n) => Math.round(n * 1000) / 1000);
}

it("retains pan and zoom across parent renders and replacement SVGs until Fit", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const source = (revision: number) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 500"><text>${revision}</text></svg>`;
  const render = async (svg: string) => act(() => root.render(
    <DiagramLightbox svg={svg} label="refresh regression" language="d2" dark onClose={() => {}} />,
  ));
  const stage = () => document.querySelector<HTMLDivElement>(".diagram-vector-stage")!;
  const viewport = () => stage().querySelector("svg")!;
  const box = () => visibleBox(stage());
  const captured: Record<string, number[]> = {};
  try {
    await render(source(1));
    await frame();
    const initial = box();
    await act(() => stage().dispatchEvent(new WheelEvent("wheel", { ctrlKey: true, deltaY: -Math.log(2) / 0.002, cancelable: true })));
    await act(() => stage().dispatchEvent(new WheelEvent("wheel", { deltaX: 80, deltaY: 40, cancelable: true })));
    await frame();
    captured.reading = box();
    const held = viewport();
    await render(source(1));
    await frame();
    captured.parentRender = box();
    expect(viewport()).toBe(held);
    await render(source(2));
    await frame();
    captured.newSvg = box();
    expect(viewport().textContent).toBe("2");
    await act(() => document.querySelector<HTMLButtonElement>('button[title="fit the complete SVG"]')!.click());
    await frame();
    captured.fit = box();
    expect(captured.parentRender).toEqual(captured.reading);
    expect(captured.newSvg).toEqual(captured.reading);
    expect(captured.fit).toEqual(initial);
    expect(captured.reading[2]).toBeCloseTo(initial[2] / 2, 2);
  } finally {
    await act(() => root.unmount());
    container.remove();
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  }
});

it("keeps SVG descendants interactive and pans from the SVG background", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <g id="node"><title>node detail</title><rect x="0" y="0" width="20" height="20"/></g>
    <a id="link" href="#target"><text x="30" y="20">open</text></a>
    <foreignObject id="foreign" x="0" y="30" width="30" height="20"><button xmlns="http://www.w3.org/1999/xhtml">inspect</button></foreignObject>
  </svg>`;
  try {
    await act(() => root.render(
      <DiagramLightbox svg={svg} label="pointer ownership" language="d2" dark onClose={() => {}} />,
    ));
    const stage = document.querySelector<HTMLDivElement>(".diagram-vector-stage")!;
    await frame();
    const captures: number[] = [];
    const releases: number[] = [];
    let captured: number | null = null;
    stage.setPointerCapture = (pointerId) => { captured = pointerId; captures.push(pointerId); };
    stage.hasPointerCapture = (pointerId) => captured === pointerId;
    stage.releasePointerCapture = (pointerId) => { captured = null; releases.push(pointerId); };
    const pointer = (target: Element, type: string, pointerId: number, clientX = 0) => {
      target.dispatchEvent(new PointerEvent(type, { bubbles: true, button: 0, pointerId, clientX }));
    };

    pointer(stage.querySelector("#node rect")!, "pointerdown", 1);
    pointer(stage.querySelector("#link text")!, "pointerdown", 2);
    pointer(stage.querySelector("#foreign button")!, "pointerdown", 3);
    expect(captures).toEqual([]);
    expect(stage.hasAttribute("data-panning")).toBe(false);
    expect(getComputedStyle(stage.querySelector("#node rect")!).cursor).toBe("default");
    expect(getComputedStyle(stage.querySelector("#link")!).cursor).toBe("pointer");
    expect(stage.querySelector("#node title")?.textContent).toBe("node detail");

    const viewport = stage.querySelector("svg")!;
    const before = viewport.style.transform;
    pointer(viewport, "pointerdown", 4, 10);
    expect(stage.hasAttribute("data-panning")).toBe(true);
    pointer(viewport, "pointermove", 4, 30);
    pointer(viewport, "pointerup", 4, 30);
    await frame();
    expect({
      captures,
      releases,
      panning: stage.hasAttribute("data-panning"),
      moved: viewport.style.transform !== before,
    }).toEqual({ captures: [4], releases: [4], panning: false, moved: true });
  } finally {
    await act(() => root.unmount());
    container.remove();
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  }
});

it("preserves nested SVG dimensions when the painted root surface rebases", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 500">
    <svg id="nested" x="100" y="100" width="200" height="100" viewBox="0 0 20 10">
      <rect width="20" height="10"/>
    </svg>
  </svg>`;
  try {
    await act(() => root.render(
      <DiagramLightbox svg={svg} label="nested SVG" language="d2" dark onClose={() => {}} />,
    ));
    const stage = document.querySelector<HTMLDivElement>(".diagram-vector-stage")!;
    await frame();
    const nested = stage.querySelector<SVGSVGElement>("#nested")!;
    const before = { width: getComputedStyle(nested).width, height: getComputedStyle(nested).height };
    for (let index = 0; index < 8; index++) {
      await act(() => stage.dispatchEvent(new WheelEvent("wheel", {
        ctrlKey: true, deltaY: -Math.log(1.5) / 0.002, cancelable: true,
      })));
      await frame();
    }
    expect({
      before,
      after: { width: getComputedStyle(nested).width, height: getComputedStyle(nested).height },
      attributes: [nested.getAttribute("width"), nested.getAttribute("height")],
      visible: visibleBox(stage),
    }).toMatchInlineSnapshot(`
      {
        "after": {
          "height": "auto",
          "width": "auto",
        },
        "attributes": [
          "200",
          "100",
        ],
        "before": {
          "height": "auto",
          "width": "auto",
        },
        "visible": [
          480.491,
          237.807,
          39.018,
          24.387,
        ],
      }
    `);
  } finally {
    await act(() => root.unmount());
    container.remove();
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  }
});
