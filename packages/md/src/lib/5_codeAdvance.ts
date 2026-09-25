// Formatter columns derive from the code font's real advance, not a constant:
// a hidden <pre><code> probe is attached inside the fence container so the
// stylesheet's own code-font rule lands on it — the probe carries no font of
// its own and cannot drift from mdview.css. CODE_ADVANCE_PX is only the
// fallback for environments with no layout (no DOM, jsdom, hidden panels).
import { CODE_ADVANCE_PX } from "./4_fenceCommands.js";

const GLYPHS = 100;

/**
 * Advance width of one character of the code font, measured with a hidden
 * probe inside `container` (a `.mdview-streamdown` element). Falls back to
 * `CODE_ADVANCE_PX` when measurement is impossible: no DOM, a zero-width
 * probe, or a throwing layout.
 */
export function codeAdvancePx(container?: Element | null): number {
  const owner = container?.ownerDocument;
  if (!owner) return CODE_ADVANCE_PX;
  try {
    const pre = owner.createElement("pre");
    const code = owner.createElement("code");
    code.textContent = "0".repeat(GLYPHS);
    code.style.cssText = "position:absolute;top:-9999px;left:0;visibility:hidden;white-space:pre;pointer-events:none;";
    pre.appendChild(code);
    container?.appendChild(pre);
    const width = code.getBoundingClientRect().width / GLYPHS;
    pre.remove();
    return width > 0 ? width : CODE_ADVANCE_PX;
  } catch {
    return CODE_ADVANCE_PX;
  }
}
