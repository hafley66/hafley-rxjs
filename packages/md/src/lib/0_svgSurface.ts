export type SvgBox = { x: number; y: number; width: number; height: number };

// Paint three viewports, then translate that bounded surface during a gesture.
// Rebase only when the visible box leaves it or the scale changes by 2x.
export function svgPaintBox(current: SvgBox): SvgBox {
  return { x: current.x - current.width, y: current.y - current.height, width: current.width * 3, height: current.height * 3 };
}

export function svgNeedsRepaint(painted: SvgBox, current: SvgBox): boolean {
  const scale = painted.width / (3 * current.width);
  return scale < 0.5 || scale > 2 || current.x < painted.x || current.y < painted.y
    || current.x + current.width > painted.x + painted.width
    || current.y + current.height > painted.y + painted.height;
}

export function svgCssTransform(painted: SvgBox, current: SvgBox, width: number, height: number): string {
  const scale = painted.width / (3 * current.width);
  const x = (painted.x - current.x) * width / current.width;
  const y = (painted.y - current.y) * height / current.height;
  return `matrix(${scale}, 0, 0, ${scale}, ${x}, ${y})`;
}

export function svgFitBox(original: SvgBox, width: number, height: number): SvgBox {
  const scale = Math.min(Math.max(1, width) / original.width, Math.max(1, height) / original.height);
  const fittedWidth = Math.max(1, width) / scale, fittedHeight = Math.max(1, height) / scale;
  return { x: original.x - (fittedWidth - original.width) / 2, y: original.y - (fittedHeight - original.height) / 2, width: fittedWidth, height: fittedHeight };
}

