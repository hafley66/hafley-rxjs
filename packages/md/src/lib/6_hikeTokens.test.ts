import { lastValueFrom } from "rxjs";
import { expect, it } from "vitest";
import type { CodeHighlighterPlugin } from "streamdown";
import { highlight$, toHighlightedCode } from "./6_hikeTokens.js";

const result = {
  fg: "#24292e",
  bg: "#fff",
  tokens: [
    [{ content: "const", color: "#d73a49", htmlStyle: { "--shiki-dark": "#f97583" } }, { content: " a = ", color: "#24292e" }],
    [{ content: "  b", color: "#005cc5" }],
  ],
};

it("turns shiki lines into Code Hike tokens: words keep a colour, whitespace becomes bare strings", () => {
  expect({
    light: toHighlightedCode(result, "const a = \n  b", "ts", false),
    dark: toHighlightedCode(result, "const a = \n  b", "ts", true).tokens,
  }).toMatchInlineSnapshot(`
    {
      "dark": [
        [
          "const",
          "#f97583",
        ],
        " ",
        [
          "a",
          "#24292e",
        ],
        " ",
        [
          "=",
          "#24292e",
        ],
        " ",
        "
    ",
        "  ",
        [
          "b",
          "#005cc5",
        ],
      ],
      "light": {
        "annotations": [],
        "code": "const a = 
      b",
        "lang": "ts",
        "meta": "",
        "style": {},
        "themeName": "light",
        "tokens": [
          [
            "const",
            "#d73a49",
          ],
          " ",
          [
            "a",
            "#24292e",
          ],
          " ",
          [
            "=",
            "#24292e",
          ],
          " ",
          "
    ",
          "  ",
          [
            "b",
            "#005cc5",
          ],
        ],
        "value": "const a = 
      b",
      },
    }
  `);
});

it("highlight$ answers sync results, async callbacks, and no highlighter with plain tokens", async () => {
  const base = { supportsLanguage: (lang: string) => lang === "ts", getThemes: () => ["github-light", "github-dark"] };
  const sync = { ...base, highlight: () => result } as unknown as CodeHighlighterPlugin;
  const later = {
    ...base,
    highlight: (_options: unknown, callback?: (value: typeof result) => void) => {
      queueMicrotask(() => callback?.(result));
      return null;
    },
  } as unknown as CodeHighlighterPlugin;
  expect({
    sync: (await lastValueFrom(highlight$(sync, "const a = \n  b", "ts", false))).tokens.length,
    later: (await lastValueFrom(highlight$(later, "const a = \n  b", "ts", false))).tokens.length,
    none: (await lastValueFrom(highlight$(undefined, "x y", "ts", false))).tokens,
    unsupported: (await lastValueFrom(highlight$(sync, "x", "cobol", false))).tokens,
  }).toMatchInlineSnapshot(`
    {
      "later": 9,
      "none": [
        [
          "x",
        ],
        " ",
        [
          "y",
        ],
      ],
      "sync": 9,
      "unsupported": [
        [
          "x",
        ],
      ],
    }
  `);
});
