import { expect, it } from "vitest";
import "./theme.css";

// A host stylesheet in XP.css shape hides every native checkbox; the gutter checks must still paint in place.
it("gutter checkboxes stay absolute and visible under a host input[type=checkbox] reset", () => {
  const reset = document.createElement("style");
  reset.textContent = "input[type=checkbox]{appearance:none;margin:0;background:0;position:fixed;opacity:0;border:none}";
  document.head.append(reset);
  const root = document.createElement("div");
  root.className = "term-context-root";
  const structured = document.createElement("input");
  structured.type = "checkbox";
  structured.className = "term-context-structured-check";
  const hover = document.createElement("input");
  hover.type = "checkbox";
  hover.className = "term-context-hover-check";
  root.append(structured, hover);
  document.body.append(root);
  try {
    const read = (el: HTMLElement) => ({ position: getComputedStyle(el).position, opacity: getComputedStyle(el).opacity });
    expect({ structured: read(structured), hover: read(hover) }).toMatchInlineSnapshot(`
      {
        "hover": {
          "opacity": "0.55",
          "position": "absolute",
        },
        "structured": {
          "opacity": "1",
          "position": "absolute",
        },
      }
    `);
  } finally {
    root.remove();
    reset.remove();
  }
});
