/// <reference types="vite/client" />
import "./theme.css";
import { Subject } from "rxjs";
import { describe, expect, it } from "vitest";
import { graphicsOverlayStream, type GraphicsFrame } from "./8h_graphicsOverlay.js";
import { nextFrame, openRealTerminal } from "./test/1_realTerminal.js";

const frame = (id: string, color: [number, number, number, number], x = 0): GraphicsFrame => ({
  id, action: "f", img_id: 1, format: 32, width: 2, height: 1, x, y: 0,
  no_scroll: true, delete: false, rgba_b64: btoa(String.fromCharCode(...color, ...color)),
});

describe("graphics overlay on real canvas", () => {
  it("draws the newest frame, clears deletes, and releases the canvas", async () => {
    const { host } = openRealTerminal();
    const frames = new Subject<GraphicsFrame>();
    const subscription = graphicsOverlayStream(host, "p1", frames).effects.subscribe();
    const canvas = host.querySelector<HTMLCanvasElement>(".term-graphics");
    if (!canvas) throw new Error("graphics canvas was not mounted");
    frames.next(frame("other", [255, 0, 0, 255]));
    frames.next(frame("p1", [255, 0, 0, 255]));
    frames.next(frame("p1", [0, 255, 0, 255]));
    await nextFrame();
    await nextFrame();
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas 2D context unavailable");
    expect([...ctx.getImageData(0, 0, 1, 1).data]).toEqual([0, 255, 0, 255]);
    expect(getComputedStyle(canvas).zIndex).toBe("5");
    frames.next({ ...frame("p1", [0, 0, 0, 0]), delete: true });
    expect([...ctx.getImageData(0, 0, 1, 1).data]).toEqual([0, 0, 0, 0]);
    subscription.unsubscribe();
    expect(host.querySelector(".term-graphics")).toBeNull();
  });
  it("preserves partial-frame x placement", async () => {
    const { host } = openRealTerminal();
    const frames = new Subject<GraphicsFrame>();
    const subscription = graphicsOverlayStream(host, "p1", frames).effects.subscribe();
    frames.next(frame("p1", [12, 34, 56, 255], 1));
    await nextFrame();
    await nextFrame();
    const canvas = host.querySelector<HTMLCanvasElement>(".term-graphics");
    const ctx = canvas?.getContext("2d");
    if (!ctx) throw new Error("canvas 2D context unavailable");
    expect([...ctx.getImageData(0, 0, 2, 1).data]).toEqual([0, 0, 0, 0, 12, 34, 56, 255]);
    subscription.unsubscribe();
  });
});
it("uses host graphics z token", () => {
  const { host } = openRealTerminal();
  host.style.setProperty("--boop-xterm-graphics-z", "13");
  const frames = new Subject<GraphicsFrame>();
  const subscription = graphicsOverlayStream(host, "p1", frames).effects.subscribe();
  expect(getComputedStyle(host.querySelector<HTMLCanvasElement>(".term-graphics")!).zIndex).toBe("13");
  subscription.unsubscribe();
});
it("keeps a pending frame after an immediate delete", async () => {
  const { host } = openRealTerminal();
  const frames = new Subject<GraphicsFrame>();
  const subscription = graphicsOverlayStream(host, "p1", frames).effects.subscribe();
  frames.next(frame("p1", [1, 2, 3, 255]));
  frames.next({ ...frame("p1", [0, 0, 0, 0]), delete: true });
  await nextFrame();
  await nextFrame();
  const ctx = host.querySelector<HTMLCanvasElement>(".term-graphics")?.getContext("2d");
  if (!ctx) throw new Error("canvas 2D context unavailable");
  expect([...ctx.getImageData(0, 0, 1, 1).data]).toEqual([1, 2, 3, 255]);
  subscription.unsubscribe();
});
