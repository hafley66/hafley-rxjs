import type { PanelApi } from "dockview";
import { createElement, type ReactNode } from "react";

type PanelActivationApi = Pick<PanelApi, "setActive">;

export function MdPanelActivation({
  api,
  children,
}: {
  api: PanelActivationApi;
  children?: ReactNode;
}) {
  const activate = ({ currentTarget, target }: { currentTarget: EventTarget | null; target: EventTarget | null }) => {
    const before = document.activeElement;
    const root = currentTarget instanceof HTMLElement ? currentTarget : null;
    let interaction: HTMLElement | null = null;
    if (root && target instanceof HTMLElement && root.contains(target)) {
      for (let node: HTMLElement | null = target; node && node !== root; node = node.parentElement) {
        if (node === before || node.tabIndex >= 0) {
          interaction = node;
          break;
        }
      }
    }
    api.setActive();
    const focusTarget = interaction ?? (
      root?.contains(before) && before instanceof HTMLElement && before.tabIndex >= 0 ? before : null
    );
    if (focusTarget && focusTarget !== document.activeElement) {
      focusTarget.focus({ preventScroll: true });
    }
  };
  return createElement(
    "div",
    {
      className: "mdview-panel-activation",
      onPointerDownCapture: activate,
      onFocusCapture: activate,
    },
    children,
  );
}
