import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import StreamdownBody from "./0_Streamdown.js";
import "./mdview.css";
import "./1_reading.css";

it("keeps prose centered at its selected measure while blocks use the available pane", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const markdown = "A readable paragraph with **emphasis** and enough text to wrap when the pane narrows.\n\n- First item\n- Second item\n\n```text\nwide block\n```";
  try {
    await act(() => root.render(
      <div className="mdview-content" style={{ width: 1100, height: 650 }}>
        <div className="mdview-head">Reading width</div>
        <div className="mdview-body"><div className="md-body">
          <StreamdownBody components={{}} dark>{markdown}</StreamdownBody>
        </div></div>
      </div>,
    ));
    const pane = host.querySelector<HTMLElement>(".mdview-content")!;
    const paragraph = host.querySelector("p")!;
    const heading = host.querySelector(".mdview-head")!;
    const list = host.querySelector("ul")!;
    const code = host.querySelector('[data-streamdown="code-block"]')!;
    const receipts = [];
    for (const [paneWidth, proseWidth, zoom] of [[1100, 560, 1], [1100, 720, 1], [360, 720, 1], [1100, 560, 1.4]]) {
      pane.style.width = `${paneWidth}px`;
      pane.style.zoom = String(zoom);
      pane.style.setProperty("--md-prose-width", `${proseWidth}px`);
      const p = paragraph.getBoundingClientRect();
      const h = heading.getBoundingClientRect();
      const l = list.getBoundingClientRect();
      const b = code.getBoundingClientRect();
      const available = pane.clientWidth - parseFloat(getComputedStyle(pane).paddingLeft) - parseFloat(getComputedStyle(pane).paddingRight);
      receipts.push({
        proseFits: Math.abs(p.width / zoom - Math.min(proseWidth, available)) < 1,
        aligned: Math.abs(h.left - p.left) < 1 && Math.abs(l.left - p.left) < 1,
        centered: Math.abs((p.left + p.right) / 2 - (b.left + b.right) / 2) < 1,
        blockFits: Math.abs(b.width / zoom - available) < 1,
        noOuterOverflow: pane.scrollWidth <= pane.clientWidth,
      });
    }
    expect(receipts).toEqual(Array.from({ length: 4 }, () => ({
      proseFits: true, aligned: true, centered: true, blockFits: true, noOuterOverflow: true,
    })));
    expect(getComputedStyle(paragraph).lineHeight).toBe("25.5px");
  } finally {
    await act(() => root.unmount());
    host.remove();
  }
});

it("lets a wrapped table extend beyond prose margins in the reading theme", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const host = document.createElement("div");
  host.style.cssText = "width: 1180px; background: #242424; color: #ddd; font-family: system-ui; --panel-bg: #242424; --panel-fg: #ddd; --md-prose-width: 700px";
  document.body.append(host);
  const root = createRoot(host);
  const markdown = [
    "A reading column keeps explanations within a comfortable measure. Tables can use the surrounding space for longer descriptions and controls.",
    "",
    "| Pass | Change | Evidence |",
    "| :--- | :--- | :--- |",
    "| 1 | **Statement program**: connect prepared SQL once for each view, then execute the stored statements during drain. | Counts remain identical across fixtures. |",
    "| 2 | Route focused Markdown zoom through the active panel while preserving input focus. | Two visible panels exercise pointer and keyboard activation. |",
    "| 3 | Render tables with `signal-grid`, including sorting, column visibility and resizing. | Wrapped rows retain their full content as columns change width. |",
    "",
    "Prose resumes at the selected reading width below the table.",
  ].join("\n");
  try {
    await act(() => root.render(
      <div className="mdview-content" style={{ height: 740, "--md-prose-width": "700px" } as React.CSSProperties}>
        <div className="mdview-head mdview-h1">Reading and review</div>
        <div className="md-body"><StreamdownBody components={{}} dark>{markdown}</StreamdownBody></div>
      </div>,
    ));
    await vi.waitFor(() => expect(host.querySelectorAll(".sg-row")).toHaveLength(3));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 100)); });
    const paragraph = host.querySelector("p")!.getBoundingClientRect();
    const table = host.querySelector(".mdview-table")!.getBoundingClientRect();
    expect(table.width).toBeGreaterThan(paragraph.width + 200);
    expect(table.left).toBeLessThan(paragraph.left);
    const scroll = host.querySelector<HTMLElement>(".sg-scroll")!;
    expect(scroll.scrollWidth).toBeLessThanOrEqual(scroll.clientWidth + 1);
    expect(scroll.scrollHeight).toBeLessThanOrEqual(scroll.clientHeight + 1);
    const rows = [...host.querySelectorAll(".sg-row")].map((row) => row.getBoundingClientRect());
    expect(rows.every((row, index) => index === 0 || row.top >= rows[index - 1]!.bottom - 1)).toBe(true);
    await page.screenshot({ path: "../out/md-reading.png" });
  } finally {
    await act(() => root.unmount());
    host.remove();
  }
});
