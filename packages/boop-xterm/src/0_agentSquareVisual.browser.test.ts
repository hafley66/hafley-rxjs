/// <reference types="vite/client" />
import "./theme.css";
import { expect, it } from "vitest";
import { createSquareVisual, placeSquare, activateSquare, themedSquareVars } from "./0_agentSquareVisual.js";

it("writes one square state and resolves its theme tone", () => {
  const visual = createSquareVisual({ id: "s1:2", kind: "agent", role: "assistant", turn: 2,
    hue: 33, at: "turn 2", preview: "hello" });
  placeSquare(visual, 42, 1.2, .42);
  activateSquare(visual, true);
  const host = document.createElement("div");
  document.body.append(host);
  const style = getComputedStyle(host);
  const vars = themedSquareVars(visual.$(), {
    user: style.getPropertyValue("--boop-xterm-squares-user-tone").trim(),
    agent: style.getPropertyValue("--boop-xterm-squares-agent-tone").trim(),
    tool: style.getPropertyValue("--boop-xterm-squares-tool-tone").trim(),
    other: style.getPropertyValue("--boop-xterm-squares-other-tone").trim(),
  });
  expect({ state: visual.$(), color: vars["--asq-color"], shape: vars["--asq-shape"] }).toMatchInlineSnapshot(`
    {
      "color": "hsl(33 58% 54%)",
      "shape": "var(--boop-xterm-squares-agent-shape)",
      "state": {
        "active": true,
        "at": "turn 2",
        "hue": 33,
        "id": "s1:2",
        "kind": "agent",
        "preview": "hello",
        "role": "assistant",
        "scale": 1.2,
        "strength": 0.42,
        "turn": 2,
        "y": 42,
      },
    }
  `);
  host.remove();
});
it("sizes the popover from its pane width and resolved ratio", () => {
  const host = document.createElement("div");
  host.style.cssText = "--asq-pane-w:800px;--boop-xterm-squares-popover-width-ratio:.5";
  const square = document.createElement("div");
  square.className = "asq";
  const popover = document.createElement("div");
  popover.className = "asq-pop";
  square.appendChild(popover);
  host.appendChild(square);
  document.body.appendChild(host);
  expect(getComputedStyle(popover).width).toBe("400px");
  host.remove();
});
it("uses host size and gutter overrides", () => {
  const host = document.createElement("div");
  host.style.cssText = "position:relative;width:800px;height:400px;--boop-xterm-squares-size:20px;--boop-xterm-squares-gutter:48px";
  const strip = document.createElement("div");
  strip.className = "asq-host";
  const square = document.createElement("div");
  square.className = "asq";
  strip.appendChild(square);
  host.appendChild(strip);
  document.body.appendChild(host);
  expect({ gutter: getComputedStyle(strip).width, size: getComputedStyle(square).width })
    .toEqual({ gutter: "48px", size: "20px" });
  host.remove();
});
