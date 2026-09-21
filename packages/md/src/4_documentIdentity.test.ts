import { describe, expect, it, vi } from "vitest";
import { resolveMdGitRoot } from "./4_documentIdentity.js";

describe("markdown document identity", () => {
  it("shares a Git-root request for a remounted panel", async () => {
    const resolver = vi.fn(async (path: string) => `/repo/${path.split("/").at(-2)}`);
    const first = resolveMdGitRoot("/repo/docs/guide.md", resolver);
    const second = resolveMdGitRoot("/repo/docs/guide.md", resolver);

    expect(await Promise.all([first, second])).toEqual(["/repo/docs", "/repo/docs"]);
    expect(resolver).toHaveBeenCalledTimes(1);
  });

  it("keeps file switches independent and turns host failures into fallback metadata", async () => {
    const resolver = vi.fn(async (path: string) => {
      if (path.endsWith("missing.md")) throw new Error("gone");
      return "/repo";
    });

    expect(await resolveMdGitRoot("/repo/docs/one.md", resolver)).toBe("/repo");
    expect(await resolveMdGitRoot("/outside/missing.md", resolver)).toBeUndefined();
    expect(resolver).toHaveBeenCalledTimes(2);
  });

  it("uses path persistence when a host has no resolver", async () => {
    expect(await resolveMdGitRoot("/outside/guide.md", undefined)).toBeUndefined();
  });

  it("does not cache a rejected lookup or share a path across host resolvers", async () => {
    let fail = true;
    const firstResolver = vi.fn(async () => {
      if (fail) throw new Error("temporary host failure");
      return "/first";
    });
    const secondResolver = vi.fn(async () => "/second");

    expect(await resolveMdGitRoot("/same/guide.md", firstResolver)).toBeUndefined();
    fail = false;
    expect(await resolveMdGitRoot("/same/guide.md", firstResolver)).toBe("/first");
    expect(await resolveMdGitRoot("/same/guide.md", secondResolver)).toBe("/second");
    expect(firstResolver).toHaveBeenCalledTimes(2);
    expect(secondResolver).toHaveBeenCalledTimes(1);
  });
});
