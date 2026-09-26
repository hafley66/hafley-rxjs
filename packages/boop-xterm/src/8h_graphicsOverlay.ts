import { Observable, animationFrameScheduler, auditTime, filter, map, merge, share, switchMap, tap } from "rxjs";

export type GraphicsFrame = {
  id: string;
  action: string;
  img_id: number;
  format: number;
  width: number;
  height: number;
  x: number;
  y: number;
  no_scroll: boolean;
  delete: boolean;
  rgba_b64: string;
};
export type GraphicsOverlayModel = { effects: Observable<void> };

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** One canvas and one pending frame per connected overlay. */
export function graphicsOverlayStream(host: HTMLElement, id: string, frames: Observable<GraphicsFrame>): GraphicsOverlayModel {
  const canvas$ = new Observable<{ canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D }>((observer) => {
    const canvas = document.createElement("canvas");
    canvas.className = "term-graphics";
    const priorPosition = host.style.position;
    const changedPosition = getComputedStyle(host).position === "static";
    if (changedPosition) host.style.position = "relative";
    host.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      observer.error(new Error("Canvas 2D context unavailable"));
    } else {
      observer.next({ canvas, ctx });
    }
    return function unsubscribe() {
      canvas.remove();
      if (changedPosition) host.style.position = priorPosition;
    };
  });
  const effects = canvas$.pipe(switchMap(({ canvas, ctx }) => {
    const mine$ = frames.pipe(filter((frame) => frame.id === id), share());
    const clear$ = mine$.pipe(filter((frame) => frame.delete), tap(() => ctx.clearRect(0, 0, canvas.width, canvas.height)));
    const draw$ = mine$.pipe(filter((frame) => !frame.delete), auditTime(0, animationFrameScheduler), tap((frame) => {
      if (frame.width <= 0 || frame.height <= 0) return;
      const bytes = b64ToBytes(frame.rgba_b64);
      const need = frame.width * frame.height * 4;
      if (bytes.length < need) return;
      if (canvas.width !== frame.width || canvas.height !== frame.height) {
        canvas.width = frame.width;
        canvas.height = frame.height;
      }
      const pixels = new Uint8ClampedArray(need);
      pixels.set(bytes.subarray(0, need));
      ctx.putImageData(new ImageData(pixels, frame.width, frame.height), frame.x, frame.y);
    }));
    return merge(clear$, draw$).pipe(map(() => void 0));
  }));
  return { effects };
}
