import { expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ factoryCalls: 0 }));
vi.mock("mermaid", () => {
  state.factoryCalls += 1;
  return {
    default: {
      initialize: vi.fn(),
      render: vi.fn().mockResolvedValue({ svg: "<svg/>" }),
    },
  };
});

it("defers mermaid until a render is requested", async () => {
  const { renderMermaidSvg } = await import("./0a_mermaid.js");
  expect(state.factoryCalls).toBe(0);
  await renderMermaidSvg("flowchart LR\n  a --> b", true);
  expect(state.factoryCalls).toBe(1);
});
