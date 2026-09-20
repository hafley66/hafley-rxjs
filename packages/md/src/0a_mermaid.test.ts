import { expect, it, vi } from "vitest";

const mermaid = vi.hoisted(() => ({ initialize: vi.fn(), render: vi.fn() }));
vi.mock("mermaid", () => ({ default: mermaid }));

import { renderMermaidSvg } from "./0a_mermaid.js";

it("raises Mermaid's default edge cap for large local diagrams", async () => {
  mermaid.render.mockResolvedValueOnce({ svg: "<svg/>" });
  await renderMermaidSvg("flowchart LR\n  a --> b", true);
  expect(mermaid.initialize.mock.calls[0][0]).toMatchObject({
    maxEdges: 2_000,
    securityLevel: "strict",
    suppressErrorRendering: true,
  });
});
