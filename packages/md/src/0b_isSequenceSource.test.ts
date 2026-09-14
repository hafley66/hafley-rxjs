import { expect, it } from "vitest";
import { isSequenceSource } from "./0b_isSequenceSource.js";

it("routes mermaid fences by the first keyword line", () => {
  const cases = {
    plain: isSequenceSource("mermaid", "sequenceDiagram\n  A->>B: hi\n"),
    leadingBlank: isSequenceSource("mermaid", "\n\n  sequenceDiagram\n  A->>B: hi\n"),
    frontmatter: isSequenceSource("mermaid", "---\ntitle: Order\n---\nsequenceDiagram\n  A->>B: hi\n"),
    directive: isSequenceSource("mermaid", "%%{init: {'theme':'base'}}%%\nsequenceDiagram\n"),
    multilineDirective: isSequenceSource("mermaid", "%%{init: {\n  'theme':'base'\n}}%%\nsequenceDiagram\n"),
    comment: isSequenceSource("mermaid", "%% a note\nsequenceDiagram\n"),
    flowchart: isSequenceSource("mermaid", "flowchart TD\n  A-->B\n"),
    flowchartAfterFrontmatter: isSequenceSource("mermaid", "---\ntitle: x\n---\nflowchart TD\n  A-->B\n"),
    sequenceMentionedLater: isSequenceSource("mermaid", "flowchart TD\n  A[sequenceDiagram]\n"),
    prefixOnly: isSequenceSource("mermaid", "sequenceDiagramX\n"),
    empty: isSequenceSource("mermaid", ""),
  };
  expect(cases).toMatchInlineSnapshot(`
    {
      "comment": true,
      "directive": true,
      "empty": false,
      "flowchart": false,
      "flowchartAfterFrontmatter": false,
      "frontmatter": true,
      "leadingBlank": true,
      "multilineDirective": true,
      "plain": true,
      "prefixOnly": false,
      "sequenceMentionedLater": false,
    }
  `);
});

it("routes d2 fences by the sequence_diagram shape keyword", () => {
  const cases = {
    top: isSequenceSource("d2", "shape: sequence_diagram\na -> b: hi\n"),
    spaced: isSequenceSource("d2", "shape:   sequence_diagram\n"),
    nested: isSequenceSource("d2", "flow: {\n  shape: sequence_diagram\n  a -> b\n}\n"),
    inline: isSequenceSource("d2", "flow: { shape: sequence_diagram; a -> b }\n"),
    plain: isSequenceSource("d2", "a -> b: hi\n"),
    otherShape: isSequenceSource("d2", "a.shape: sequence_diagram_like\n"),
  };
  expect(cases).toMatchInlineSnapshot(`
    {
      "inline": true,
      "nested": true,
      "otherShape": false,
      "plain": false,
      "spaced": true,
      "top": true,
    }
  `);
});
