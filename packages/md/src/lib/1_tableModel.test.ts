import { createElement, type ReactNode } from "react";
import { expect, it } from "vitest";
import { markdownTableModel, markdownTableText } from "./1_tableModel.js";

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
