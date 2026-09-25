import { parseMarbles } from "@hafley66/signal-marbles";
import { expect, it } from "vitest";
import { marblesFenceBody } from "./2_marblesPlugin.fixture.js";
import { marblesPlugin } from "./marbles.js";

it("claims the marbles fence and reads its body with signal-marbles' own parser", () => {
  const plugin = marblesPlugin();
  expect({
    name: plugin.name,
    languages: plugin.fence?.languages,
    component: plugin.fence?.component.name,
    parse: parseMarbles(marblesFenceBody),
  }).toMatchInlineSnapshot(`
    {
      "component": "LazyMarblesFence",
      "languages": [
        "marbles",
      ],
      "name": "marbles",
      "parse": {
        "diagnostics": [],
        "doc": {
          "columns": [
            0,
            1,
            2,
            3,
            3,
            3,
            3,
            4,
            5,
            6,
            7,
          ],
          "lanes": [
            {
              "born": null,
              "id": "source",
              "label": "source",
              "notifications": [
                {
                  "id": "source#1",
                  "kind": "next",
                  "tick": 1,
                  "value": "a",
                },
                {
                  "id": "source#2",
                  "kind": "next",
                  "tick": 3,
                  "value": "b",
                },
                {
                  "id": "source#3",
                  "kind": "next",
                  "tick": 3,
                  "value": "c",
                },
                {
                  "id": "source#4",
                  "kind": "next",
                  "tick": 8,
                  "value": "d",
                },
                {
                  "id": "source#5",
                  "kind": "complete",
                  "tick": 10,
                },
              ],
              "parent": null,
            },
            {
              "born": null,
              "id": "map-v-v-10",
              "label": "map(v => v * 10)",
              "notifications": [
                {
                  "id": "map-v-v-10#1",
                  "kind": "subscribe",
                  "tick": 0,
                },
                {
                  "id": "map-v-v-10#2",
                  "kind": "next",
                  "tick": 1,
                  "value": "10",
                },
                {
                  "id": "map-v-v-10#3",
                  "kind": "next",
                  "tick": 3,
                  "value": "20",
                },
                {
                  "id": "map-v-v-10#4",
                  "kind": "next",
                  "tick": 3,
                  "value": "30",
                },
                {
                  "id": "map-v-v-10#5",
                  "kind": "error",
                  "tick": 8,
                },
              ],
              "parent": "source",
            },
          ],
          "title": "map(v => v * 10) throws on d",
          "version": "marbles/2",
        },
      },
    }
  `);
});
