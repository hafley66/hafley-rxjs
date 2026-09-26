import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("index", () => {
  it("re-exports every source module", () => {
    const dir = new URL(".", import.meta.url);
    const index = readFileSync(new URL("index.ts", dir), "utf8");
    const modules = readdirSync(dir)
      .filter((name) => name.endsWith(".ts") && !name.includes(".test.") && name !== "index.ts" && !name.endsWith(".d.ts"))
      .map((name) => name.slice(0, -3));
    expect(modules.filter((name) => !index.includes(`"./${name}.js"`) && !index.includes(`"./${name}"`))).toMatchInlineSnapshot(`[]`);
  });
});
