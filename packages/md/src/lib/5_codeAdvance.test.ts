import { expect, it } from "vitest";
import { CODE_ADVANCE_PX, fenceColumns } from "./4_fenceCommands.js";
import { codeAdvancePx } from "./5_codeAdvance.js";

it("falls back to the constant advance when there is no DOM to measure", () => {
  expect(codeAdvancePx(undefined)).toBe(CODE_ADVANCE_PX);
  expect(codeAdvancePx(null)).toBe(CODE_ADVANCE_PX);
});

it("converts a measured advance into columns", () => {
  expect(fenceColumns(900, CODE_ADVANCE_PX)).toBe(115);
  expect(fenceColumns(900, 6.5)).toBe(138);
});
