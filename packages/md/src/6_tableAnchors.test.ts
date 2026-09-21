import { expect, it } from "vitest";
import { markdownTableStarts } from "./6_tableAnchors.js";

it("uses GFM AST positions for tables and skips longer fenced or indented code", () => {
  const text = [
    "````md",
    "| fake | table |",
    "| --- | --- |",
    "```",
    "````",
    "",
    "    | fake | code |",
    "    | --- | --- |",
    "",
    "> | Nested | table |",
    "> | --- | --- |",
    "> | quoted | row |",
    "",
    "- Nested list table",
    "",
    "  | List | Value |",
    "  | --- | --- |",
    "  | item | one |",
    "",
    "| Name | Value |",
    "| :--- | ---: |",
    "| alpha | one |",
    "",
    "| Name | Value |",
    "| --- | --- |",
    "| beta | two |",
  ].join("\n");
  expect(markdownTableStarts(text, 40)).toEqual([129, 207, 258, 308]);
});
