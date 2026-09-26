import { describe, expect, it } from "vitest";
import { turnHue } from "./0_turnHue";

describe("turnHue", () => {
  it("is stable per id, in [0, 360), and separates neighbouring turns", () => {
    expect(["session-a:564", "session-a:564", "session-a:565", ""].map(turnHue)).toMatchInlineSnapshot(`
      [
        122,
        122,
        165,
        77,
      ]
    `);
  });
});
