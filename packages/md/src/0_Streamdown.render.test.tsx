import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import StreamdownBody from "./0_Streamdown.js";
import "./mdview.css";

const rust = 'fn main() {\n    let message = "Readable Rust";\n    println!("{}", message);\n    // ' + "long source line ".repeat(12) + '\n}';
const markdown = `Inline \`let x = 1\` remains inline.\n\n\`\`\`rust\n${rust}\n\`\`\`\n\n\`\`\`unknown-language\nunknown source\n\`\`\`\n\n\`\`\`\nunlabelled source\n\`\`\``;

it("renders static highlighted previews under hostile XP styling and copies source", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const hostile = document.createElement("style");
  hostile.textContent = `body.xp-pixel * { font-family: "Pixelated MS Sans Serif" !important; -webkit-font-smoothing: none !important; }
    body.xp-pixel pre, body.xp-pixel code, body.xp-pixel code * { font-family: "Perfect DOS VGA 437 Win" !important; }
    ::-webkit-scrollbar { width: 17px; height: 17px; }
    ::-webkit-scrollbar-button:horizontal:start:decrement, ::-webkit-scrollbar-button:horizontal:end:increment { display: block; width: 17px; height: 17px; background: red; }
    ::-webkit-scrollbar-thumb { background: red; box-shadow: inset 1px 1px white; }`;
  document.head.append(hostile);
  document.body.classList.add("xp-pixel");
  const host = document.createElement("div");
  host.style.cssText = "width: 680px; padding: 16px";
  document.body.append(host);
  const root = createRoot(host);
  const writeText = vi.fn().mockResolvedValue(undefined);
  const clipboard = vi.spyOn(navigator.clipboard, "writeText").mockImplementation(writeText);
  try {
    for (const dark of [false, true]) {
      await act(() => root.render(<StreamdownBody components={{}} dark={dark}>{markdown}</StreamdownBody>));
      await vi.waitFor(() => expect(host.querySelectorAll('code span[style*="--sdm-c"]')).not.toHaveLength(0));
      await vi.waitFor(async () => {
        await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)); });
        const tokens = [...host.querySelectorAll<HTMLElement>('[data-streamdown="code-block-body"] code span[style]')];
        expect(new Set(tokens.map((node) => getComputedStyle(node).color)).size).toBeGreaterThan(2);
      });
      const blocks = [...host.querySelectorAll<HTMLElement>('[data-streamdown="code-block"]')];
      expect(blocks).toHaveLength(3);
      const body = blocks[0]!.querySelector<HTMLElement>('[data-streamdown="code-block-body"]')!;
      const pre = body.querySelector("pre")!;
      const token = body.querySelector<HTMLElement>("code span[style]")!;
      const inline = host.querySelector("p code")!;
      expect({
        modernFont: [pre, token, inline].every((node) => getComputedStyle(node).fontFamily.startsWith('"SF Mono"')),
        smoothing: getComputedStyle(token).getPropertyValue("-webkit-font-smoothing"),
        size: getComputedStyle(token).fontSize,
        overflow: [getComputedStyle(body).overflowX, getComputedStyle(body).overflowY, getComputedStyle(pre).overflowX],
        fullHeight: body.scrollHeight === body.clientHeight,
        longLineScrolls: body.scrollWidth > body.clientWidth,
        inlineDisplay: getComputedStyle(inline).display,
        arrows: getComputedStyle(body, "::-webkit-scrollbar-button").display,
        toolbar: getComputedStyle(blocks[0]!).display,
      }).toMatchInlineSnapshot(`
        {
          "arrows": "none",
          "fullHeight": true,
          "inlineDisplay": "inline",
          "longLineScrolls": true,
          "modernFont": true,
          "overflow": [
            "auto",
            "hidden",
            "visible",
          ],
          "size": "13px",
          "smoothing": "antialiased",
          "toolbar": "grid",
        }
      `);
      const colors = [...body.querySelectorAll<HTMLElement>("code span[style]")].map((node) => getComputedStyle(node).color);
      expect(new Set(colors).size).toBeGreaterThan(2);
      expect(getComputedStyle(pre).backgroundColor).toBe(dark ? "rgb(36, 41, 46)" : "rgb(255, 255, 255)");
      expect(blocks.slice(1).map((block) => block.querySelector("code")!.textContent)).toEqual(["unknown source", "unlabelled source"]);
      await act(async () => {
        await page.screenshot({ path: `./out/md-snippet-${dark ? "dark" : "light"}.png` });
      });
    }
    const button = host.querySelector<HTMLButtonElement>('[data-streamdown="code-block-actions"] button')!;
    await act(async () => { button.click(); await Promise.resolve(); });
    expect(writeText).toHaveBeenCalledWith(`${rust}\n`);
  } finally {
    clipboard.mockRestore();
    await act(() => root.unmount());
    host.remove();
    hostile.remove();
    document.body.classList.remove("xp-pixel");
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  }
});
