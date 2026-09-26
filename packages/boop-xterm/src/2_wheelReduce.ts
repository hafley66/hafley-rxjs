import type { Terminal } from "@xterm/xterm";

export type TerminalMouseMode = Terminal["modes"]["mouseTrackingMode"];

export type TerminalWheelState = {
  mouseMode: TerminalMouseMode;
  native: boolean;
  wheels: number;
};

export type TerminalWheelEvent =
  | { type: "sync"; mouseMode: TerminalMouseMode }
  | { type: "wheel"; mouseMode: TerminalMouseMode; bypass?: boolean };

export const initialTerminalWheelState: TerminalWheelState = {
  mouseMode: "none",
  native: false,
  wheels: 0,
};

// `native` means the app receives the wheel itself. Shift takes it back: an app
// with mouse tracking on (codex) otherwise swallows every scroll, leaving the
// pane with no way to reach its scrollback.
export function reduceTerminalWheel(
  state: TerminalWheelState,
  event: TerminalWheelEvent,
): TerminalWheelState {
  return {
    mouseMode: event.mouseMode,
    native: event.mouseMode !== "none" && !(event.type === "wheel" && event.bypass),
    wheels: state.wheels + (event.type === "wheel" ? 1 : 0),
  };
}

