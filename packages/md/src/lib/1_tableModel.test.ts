import { createElement, type ReactNode } from "react";
import { expect, it } from "vitest";
import { longestCodeTokens, markdownTableModel, markdownTableText } from "./1_tableModel.js";

const cell = (name: string, children: ReactNode) => createElement(name, null, children);
const row = (...cells: ReactNode[]) => createElement("tr", null, cells);

it("adapts Streamdown table children into stable columns and rows", () => {
  const children = [
    createElement("thead", null, createElement("tr", null,
      createElement("th", { align: "left" }, createElement("strong", null, "Name")),
      createElement("th", { style: { textAlign: "right" } }, "Details"),
    )),
    createElement("tbody", null,
      row(cell("td", createElement("code", null, "alpha")), cell("td", createElement("a", { href: "/a" }, "one"))),
      row(cell("td", "beta"), cell("td", "two")),
    ),
  ];

  expect(markdownTableModel(children)).toMatchInlineSnapshot(`
    {
      "alignments": [
        "left",
        "right",
      ],
      "headerValues": [
        "Name",
        "Details",
      ],
      "headers": [
        <strong>
          Name
        </strong>,
        "Details",
      ],
      "rows": [
        {
          "cells": [
            <code>
              alpha
            </code>,
            <a
              href="/a"
            >
              one
            </a>,
          ],
          "id": "row-0",
          "values": [
            "alpha",
            "one",
          ],
        },
        {
          "cells": [
            "beta",
            "two",
          ],
          "id": "row-1",
          "values": [
            "beta",
            "two",
          ],
        },
      ],
    }
  `);
});

it("pads ragged rows and uses the first row as the header without sections", () => {
  const model = markdownTableModel([
    row(cell("td", "A"), cell("td", "B")),
    row(cell("td", "1")),
  ]);
  expect({
    headers: model.headerValues,
    row: model.rows[0]?.values,
    text: markdownTableText(createElement("em", null, "inline")),
  }).toMatchInlineSnapshot(`
    {
      "headers": [
        "A",
        "B",
      ],
      "row": [
        "1",
        "",
      ],
      "text": "inline",
    }
  `);
});

it("finds each column's longest whitespace-free code run, skipping prose and the header", () => {
  const code = (text: string) => createElement("code", { className: "inline" }, text);
  const model = markdownTableModel([
    createElement("thead", null, row(cell("th", code("headerOnlyTokenIsIgnored")), cell("th", "B"), cell("th", "C"))),
    createElement("tbody", null,
      row(cell("td", code("referencesModel")), cell("td", ["see ", code("a b.rs:12 c"), " and a long prose word"]), cell("td", "plain")),
      row(cell("td", code("l")), cell("td", createElement("em", null, code("nested/path.ts"))), cell("td", "x")),
    ),
  ]);
  expect(longestCodeTokens(model)).toEqual([
    { text: "referencesModel", className: "inline" },
    { text: "nested/path.ts", className: "inline" },
    undefined,
  ]);
});
