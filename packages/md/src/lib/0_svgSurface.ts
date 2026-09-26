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

const SVG_HTML_ENTITIES: Record<string, string> = {
  nbsp: "\u00a0",
  ensp: "\u2002",
  emsp: "\u2003",
  thinsp: "\u2009",
  ndash: "\u2013",
  mdash: "\u2014",
  lsquo: "\u2018",
  rsquo: "\u2019",
  ldquo: "\u201c",
  rdquo: "\u201d",
  bull: "\u2022",
  hellip: "\u2026",
  middot: "\u00b7",
  minus: "\u2212",
  times: "\u00d7",
};
const SVG_XML_ENTITIES = new Set(["amp", "apos", "gt", "lt", "quot"]);

export function normalizeSvgEntities(source: string): string {
  return source.replace(/&([a-z][a-z0-9]+);/gi, (entity, name: string) => {
    const normalized = name.toLowerCase();
    if (SVG_XML_ENTITIES.has(normalized)) return entity;
    return SVG_HTML_ENTITIES[normalized] ?? `&amp;${name};`;
  });
}

export function svgSourceBox(source: string): SvgBox | null {
  const root = source.match(/<svg\b[^>]*>/i)?.[0];
  if (!root) return null;
  const values = root.match(/\bviewBox\s*=\s*["']([^"']+)["']/i)?.[1].trim().split(/[ ,\s]+/).map(Number);
  if (values?.length === 4 && values.every(Number.isFinite)) {
    const [x, y, width, height] = values;
    if (width > 0 && height > 0) return { x, y, width, height };
  }
  const dimension = (name: string) => {
    const value = root.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*["']([+\\d.eE-]+)(?:px)?["']`, "i"))?.[1];
    return value ? Number(value) : NaN;
  };
  const width = dimension("width"), height = dimension("height");
  return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0
    ? { x: 0, y: 0, width, height } : null;
}

export function svgMinimumZoom(native: SvgBox, fitted: SvgBox): number {
  return Math.min(0.1, native.width / fitted.width);
}

export function svgNativeBox(original: SvgBox, viewportWidth: number, viewportHeight: number): SvgBox {
  const width = Math.max(1, viewportWidth);
  const height = Math.max(1, viewportHeight);
  return {
    x: original.x + (original.width - width) / 2,
    y: original.y,
    width,
    height,
  };
}

export function svgBoxAtZoom(original: SvgBox, current: SvgBox, nextZoom: number, focusX = 0.5, focusY = 0.5): SvgBox {
  const zoom = Math.min(64, Math.max(Number.EPSILON, nextZoom));
  const width = original.width / zoom;
  const height = original.height / zoom;
  return {
    x: current.x + current.width * focusX - width * focusX,
    y: current.y + current.height * focusY - height * focusY,
    width,
    height,
  };
}

export function panSvgBox(box: SvgBox, deltaX: number, deltaY: number, viewportWidth: number, viewportHeight: number): SvgBox {
  return {
    ...box,
    x: box.x + deltaX * box.width / Math.max(1, viewportWidth),
    y: box.y + deltaY * box.height / Math.max(1, viewportHeight),
  };
}
