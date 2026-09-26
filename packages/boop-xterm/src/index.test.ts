/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";

const sources = import.meta.glob(["./*.ts", "!./*.test.ts", "!./index.ts", "!./*.d.ts"]);
const index = import.meta.glob<string>("./index.ts", { query: "?raw", import: "default", eager: true })["./index.ts"];

describe("index", () => {
  it("re-exports every source module", () => {
    const modules = Object.keys(sources).map((path) => path.slice(2, -3));
    expect(modules.filter((name) => !index.includes(`"./${name}.js"`) && !index.includes(`"./${name}"`))).toMatchInlineSnapshot(`[]`);
  });
});
