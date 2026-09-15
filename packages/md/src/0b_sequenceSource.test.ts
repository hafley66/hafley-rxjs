// @vitest-environment jsdom
import { expect, it } from "vitest";
import { recordSequenceSource, releaseSequenceSource, sourceSpanOfElement } from "./0b_sequenceSource.js";

const span = { start: 10, end: 20, lineStart: 3, lineEnd: 3 };

function mountedDiagram() {
  const host = document.createElement("div");
  host.dataset.graphtHost = "mermaid";
  host.innerHTML =
    '<svg><g id="binding-message"><text><tspan>hi</tspan></text></g><g id="unbound"><text>x</text></g></svg>';
  document.body.append(host);
  recordSequenceSource(host, {
    origin: { start: 40, lineStart: 7 },
    spanByGraphId: { message: span },
    graphIdByElementId: { "binding-message": "message" },
  });
  return host;
}

it("resolves the nearest bound ancestor of the element the pointer hit", () => {
  const host = mountedDiagram();
  const bound = host.querySelector("g")!;
  const label = host.querySelector("tspan")!;

  expect(sourceSpanOfElement(bound)).toEqual(span);
  // A tspan inside a bound message label resolves through its ancestor.
  expect(sourceSpanOfElement(label)).toEqual(span);
  expect(sourceSpanOfElement(host.querySelector("#unbound")!)).toBeUndefined();
  expect(sourceSpanOfElement(document.body)).toBeUndefined();

  releaseSequenceSource(host);
  expect(sourceSpanOfElement(label)).toBeUndefined();
});
