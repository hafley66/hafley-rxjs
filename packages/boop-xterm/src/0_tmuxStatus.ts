/** Reported by tmux for the attached session, independent of status text. */
export type TmuxStatus = { position: "top" | "bottom"; rows: number };
export type StatusTerminal = { rows: number; buffer: { active: { baseY: number } } };
const statuses = new WeakMap<object, TmuxStatus>();

export function setTerminalStatus(term: object, status: TmuxStatus | null): void {
  if (status) statuses.set(term, status);
  else statuses.delete(term);
}

export function terminalStatusRange(term: StatusTerminal): { start: number; end: number } | null {
  const status = statuses.get(term);
  if (!status?.rows) return null;
  const rows = Math.min(term.rows, Math.max(0, status.rows));
  const start = term.buffer.active.baseY + (status.position === "top" ? 0 : term.rows - rows);
  return { start, end: start + rows - 1 };
}

export function isTerminalContentRow(term: StatusTerminal, row: number): boolean {
  const range = terminalStatusRange(term);
  return !range || row < range.start || row > range.end;
}
