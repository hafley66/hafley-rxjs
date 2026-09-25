import { expect, it } from "vitest";
import { fenceColumns } from "./4_fenceCommands.js";
import { codeAdvancePx } from "./5_codeAdvance.js";

it("measures the code font the stylesheet applies to fences", () => {
  // The probe is a <pre><code> inside the container, so whatever CSS says the
  // code font is wins. A scoped rule overrides md's 13px stack with a wide one.
  const container = document.createElement("div");
  container.className = "mdview-streamdown mdview-streamdown probe-code-font";
  document.body.appendChild(container);
  const style = document.createElement("style");
  style.textContent = "body .mdview-streamdown.mdview-streamdown.probe-code-font code { font: 20px monospace !important; }";
  document.head.appendChild(style);
  try {
    const advance = codeAdvancePx(container);
    expect(advance).toBeGreaterThan(10);
    expect(advance).toBeLessThan(14);
    expect(fenceColumns(2400, advance)).toMatchInlineSnapshot(`199`);
  } finally {
    style.remove();
    container.remove();
  }
});
