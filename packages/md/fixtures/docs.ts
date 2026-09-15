// One fixture document, shared by the fixture page and the e2e assertions, so an
// offset a test asserts is the same offset the page rendered.
const fence = "```";

export const FIXTURE_PATH = "/fixture.md";

export const FIXTURE_DOC = [
  "# Overview",
  "",
  "Intro paragraph with a [link to diagrams](#diagrams).",
  "",
  "- one",
  "- two",
  "",
  "# Diagrams",
  "",
  `${fence}mermaid`,
  "sequenceDiagram",
  "  participant Alice",
  "  participant Bob",
  "  Alice->>Bob: hello",
  fence,
  "",
  `${fence}d2`,
  "shape: sequence_diagram",
  "alice: Alice",
  "bob: Bob",
  "alice -> bob: hello",
  fence,
  "",
  "## Plain",
  "",
  `${fence}mermaid`,
  "flowchart LR",
  "  A[Start] --> B[End]",
  fence,
  "",
  `${fence}d2`,
  "a -> b",
  fence,
  "",
].join("\n");

export const DOCS: Record<string, string> = { [FIXTURE_PATH]: FIXTURE_DOC };
