import type { Terminal } from "@xterm/xterm";
import type { VisibleTurn } from "./0_types.js";
import { isTerminalContentRow } from "./0_tmuxStatus.js";
import { bufferRowAtClientY, readRowGeometry } from "./1_rowGeometry.js";
import { turnAtBufferRow } from "./6_turnVisibility.js";

/** Hit-test the same buffer spans the overlays paint, using current DOM bounds. */
export function turnAtClientPoint(
  visible: VisibleTurn[], term: Terminal, host: HTMLElement, x: number, y: number,
): VisibleTurn | null {
  const geometry = readRowGeometry(term, host);
  if (!geometry || x < geometry.screen.left || x >= geometry.screen.right) return null;
  const row = bufferRowAtClientY(geometry, y);
  if (row === null || !isTerminalContentRow(term, row)) return null;
  return turnAtBufferRow(visible, row);
}
