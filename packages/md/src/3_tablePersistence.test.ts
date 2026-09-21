import { describe, expect, it } from "vitest";
import {
  createTablePreferenceStore,
  markdownTableId,
  markdownTableIdentity,
  markdownTableStorageKey,
  tablePreferencesFromState,
  tableStateFromPreferences,
  type MarkdownTableIdentity,
  type MarkdownTablePreferences,
} from "./3_tablePersistence.js";

const identity = (over: Partial<MarkdownTableIdentity> = {}): MarkdownTableIdentity => ({
  gitRoot: "/work/project",
  filePath: "/work/project/docs/guide.md",
  tableId: "intro:0:abcd",
  ...over,
});

describe("markdown table persistence", () => {
  it("names tables by Git root, relative file path, and stable table identity", () => {
    expect(markdownTableStorageKey(identity())).toBe("git:/work/project:docs/guide.md:table:intro:0:abcd");
    expect(markdownTableStorageKey(identity({ gitRoot: "/work/other" }))).not.toBe(markdownTableStorageKey(identity()));
    expect(markdownTableStorageKey(identity({ filePath: "/work/project/README.md" }))).not.toBe(markdownTableStorageKey(identity()));
    expect(markdownTableStorageKey(identity({ tableId: "intro:1:abcd" }))).not.toBe(markdownTableStorageKey(identity()));
  });

  it("falls back to the normalized absolute path when Git metadata is absent", () => {
    expect(markdownTableStorageKey(identity({ gitRoot: undefined, filePath: "/work/project/./docs/../README.md" })))
      .toBe("path:/work/project/README.md:table:intro:0:abcd");
  });

  it("derives duplicate-safe table ids from section, ordinal, and headers", () => {
    expect([
      markdownTableId({ sectionId: "intro", ordinal: 0, headerValues: ["Name", "Value"] }),
      markdownTableId({ sectionId: "intro", ordinal: 1, headerValues: ["Name", "Value"] }),
      markdownTableId({ sectionId: "details", ordinal: 0, headerValues: ["Name", "Value"] }),
    ]).toMatchInlineSnapshot(`
      [
        "intro:0:347a0858",
        "intro:1:347a0858",
        "details:0:347a0858",
      ]
    `);
    expect(markdownTableId({ sectionId: "intro", ordinal: 0, sourceStart: 800, headerValues: ["Name", "Value"] }))
      .toBe(markdownTableId({ sectionId: "intro", ordinal: 0, sourceStart: 1200, headerValues: ["Name", "Value"] }));
    expect(markdownTableId({ sectionId: "intro", sourceStart: 800, headerValues: ["Name", "Value"] }))
      .not.toBe(markdownTableId({ sectionId: "intro", sourceStart: 1200, headerValues: ["Name", "Value"] }));
    expect(markdownTableId({ sourceStart: 800, headerValues: ["Name", "Value"] })).toBe("offset:800:347a0858");
  });

  it("combines document identity and the table anchor", () => {
    expect(markdownTableIdentity(
      { filePath: "/work/project/docs/guide.md", gitRoot: "/work/project" },
      { sectionId: "intro", ordinal: 2, sourceStart: 800, headerValues: ["Name"] },
    )).toEqual({
      filePath: "/work/project/docs/guide.md",
      gitRoot: "/work/project",
      tableId: "intro:2:0fe07306",
    });
  });

  it("round-trips widths, order, and visibility and restores only current columns", () => {
    let persisted: Record<string, MarkdownTablePreferences> = {};
    const adapter = { read: () => persisted, write: (next: Readonly<Record<string, MarkdownTablePreferences>>) => { persisted = { ...next }; } };
    const first = createTablePreferenceStore(adapter);
    first.set(identity(), {
      widths: { name: 220, old: 500 },
      order: ["value", "name", "name"],
      hidden: { value: true, old: true },
    });

    const second = createTablePreferenceStore(adapter);
    expect(second.get(identity(), ["name", "value", "new"])).toEqual({
      widths: { name: 220 },
      order: ["value", "name", "new"],
      hidden: { value: true },
    });
  });

  it("keeps separate table records in the same file and can clear one", () => {
    let persisted: Record<string, MarkdownTablePreferences> = {};
    const store = createTablePreferenceStore({
      read: () => persisted,
      write: (next) => { persisted = { ...next }; },
    });
    store.set(identity({ tableId: "a" }), { widths: { name: 180 } });
    store.set(identity({ tableId: "b" }), { widths: { name: 320 } });
    expect(store.get(identity({ tableId: "a" })).widths.name).toBe(180);
    expect(store.get(identity({ tableId: "b" })).widths.name).toBe(320);
    store.clear(identity({ tableId: "a" }));
    expect(store.get(identity({ tableId: "a" }))).toEqual({ widths: {}, order: [], hidden: {} });
    expect(store.get(identity({ tableId: "b" })).widths.name).toBe(320);
  });

  it("adapts only grid column state into the persisted table shape", () => {
    const preferences = tablePreferencesFromState({
      colWidth: { name: 220 },
      colOrder: ["name", "value"],
      colHidden: { value: true },
    });
    expect(tableStateFromPreferences(preferences)).toEqual({
      colWidth: { name: 220 },
      colOrder: ["name", "value"],
      colHidden: { value: true },
    });
  });

  it("recovers from malformed persisted table entries", () => {
    let persisted: unknown = {
      [markdownTableStorageKey(identity())]: { widths: 42, order: "name", hidden: null },
    };
    const store = createTablePreferenceStore({
      read: () => persisted as Record<string, MarkdownTablePreferences>,
      write: (next) => { persisted = next; },
    });
    expect(store.get(identity(), ["name"])).toEqual({ widths: {}, order: ["name"], hidden: {} });
    expect(store.set(identity(), { widths: { name: 240 } })).toEqual({
      widths: { name: 240 },
      order: [],
      hidden: {},
    });
  });
});
