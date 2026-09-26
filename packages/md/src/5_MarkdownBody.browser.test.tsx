import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { MarkdownBody } from "./5_MarkdownBody.js";

it("renders Mermaid and highlighted code through the default md plugins", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(() => root.render(<MarkdownBody dark source={"```mermaid\nflowchart LR\n A --> B\n```\n\n```ts\nconst answer = 42\n```"} />));
    await vi.waitFor(() => expect(host.querySelector(".mdview-mermaid svg")).not.toBeNull(), { timeout: 10_000 });
    await vi.waitFor(() => expect(host.querySelector('[data-streamdown="code-block"] code')).not.toBeNull());
    expect({
      body: host.querySelector(".mdview-streamdown")?.className,
      diagram: host.querySelector(".mdview-mermaid")?.className,
      svg: host.querySelector(".mdview-mermaid svg")?.tagName.toLowerCase(),
      code: host.querySelector('[data-streamdown="code-block"] code')?.textContent?.trim(),
    }).toMatchInlineSnapshot(`
      {
        "body": "mdview-streamdown",
        "code": "const answer = 42",
        "diagram": "mdview-mermaid",
        "svg": "svg",
      }
    `);
  } finally {
    await act(() => root.unmount());
    host.remove();
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  }
});
