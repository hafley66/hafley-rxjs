import { DockviewReact, themeDark, type DockviewApi, type IDockviewPanelProps, type IDockviewPanel } from "dockview";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { MdPanelActivation } from "./0_panelActivation.js";
import "dockview/dist/styles/dockview.css";

it("activates the panel reached by pointer or keyboard focus while preserving controls", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const container = document.createElement("div");
  container.style.cssText = "width: 1000px; height: 600px";
  document.body.append(container);
  const root = createRoot(container);
  const clicked: string[] = [];
  const external = document.createElement("input");
  external.setAttribute("aria-label", "external focus");
  document.body.append(external);
  let dockApi: DockviewApi | undefined;
  let leftPanel: IDockviewPanel | undefined;
  let rightPanel: IDockviewPanel | undefined;
  const renderPanel = ({ api, params }: IDockviewPanelProps<{ name: string }>) => (
      <MdPanelActivation api={api}>
        <button data-md-activation-control={params.name} type="button" onClick={() => clicked.push(params.name)}>{params.name} control</button>
        <input aria-label={`${params.name} keyboard target`} />
        <div data-md-activation-prose={params.name}>prose</div>
      </MdPanelActivation>
  );

  try {
    await act(() => root.render(
      <DockviewReact
        className="md-activation-test-dock"
        theme={themeDark}
        components={{ md: renderPanel }}
        onReady={({ api }) => {
          dockApi = api;
          leftPanel = api.addPanel({
            id: "md:left",
            component: "md",
            title: "left",
            params: { name: "left" },
          });
          rightPanel = api.addPanel({
            id: "md:right",
            component: "md",
            title: "right",
            params: { name: "right" },
            position: { referencePanel: leftPanel, direction: "right" },
          });
        }}
      />,
    ));

    await vi.waitFor(() => expect(container.querySelectorAll("button")).toHaveLength(2));
    const left = container.querySelector<HTMLButtonElement>('[data-md-activation-control="left"]')!;
    const right = container.querySelector<HTMLButtonElement>('[data-md-activation-control="right"]')!;
    const leftInput = container.querySelector<HTMLInputElement>('input[aria-label="left keyboard target"]')!;
    const rightProse = container.querySelector<HTMLElement>('[data-md-activation-prose="right"]')!;
    const pointerDown = (target: Element) => {
      const event = new PointerEvent("pointerdown", { bubbles: true, cancelable: true, button: 0 });
      target.dispatchEvent(event);
      return event.defaultPrevented;
    };

    await act(() => {
      const defaultPrevented = pointerDown(left);
      left.click();
      expect(defaultPrevented).toBe(false);
    });
    expect({
      activePanel: dockApi?.activePanel?.id,
      clicked,
    }).toEqual({ activePanel: "md:left", clicked: ["left"] });

    await act(() => {
      const defaultPrevented = pointerDown(right);
      right.click();
      expect(defaultPrevented).toBe(false);
    });
    expect({
      activePanel: dockApi?.activePanel?.id,
      clicked,
    }).toEqual({ activePanel: "md:right", clicked: ["left", "right"] });

    external.focus();
    await act(() => {
      const defaultPrevented = pointerDown(rightProse);
      expect(defaultPrevented).toBe(false);
    });
    expect({
      activePanel: dockApi?.activePanel?.id,
      externalFocusPreserved: document.activeElement === external,
    }).toEqual({ activePanel: "md:right", externalFocusPreserved: true });

    await act(() => leftInput.focus());
    expect({
      activePanel: dockApi?.activePanel?.id,
      focused: document.activeElement === leftInput,
      latestIntent: leftPanel?.api.isActive && !rightPanel?.api.isActive,
    }).toEqual({ activePanel: "md:left", focused: true, latestIntent: true });
  } finally {
    await act(() => root.unmount());
    external.remove();
    container.remove();
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  }
});
