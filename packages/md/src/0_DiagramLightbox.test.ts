import { describe, expect, it } from "vitest";
import { diagramWheelZoom, fitSvgBox, highestDiagramGroup, transformSvgBox } from "./0_DiagramLightbox.js";

type MockElement = {
  id: string;
  localName: string;
  parentElement: MockElement | null;
  classList: { contains(name: string): boolean };
  querySelector(selector: string): MockElement | null;
};

function element(id: string, localName: string, parentElement: MockElement | null, classes: string[] = [], scene = false): MockElement {
  return {
    id,
    localName,
    parentElement,
    classList: { contains: (name) => classes.includes(name) },
    querySelector: () => scene ? ({} as MockElement) : null,
  };
}

describe("diagram lightbox viewport", () => {
  it("selects the highest content group below Mermaid wrappers and the outer D2 object group", () => {
    const svg = element("svg", "svg", null);
    const mermaidWrapper = element("wrapper", "g", svg, [], true);
    const root = element("root", "g", mermaidWrapper, ["root"]);
    const nodes = element("nodes", "g", root, ["nodes"]);
    const node = element("node", "g", nodes, ["node"]);
    const label = element("label", "g", node, ["label"]);
    const text = element("text", "text", label);
    const d2Object = element("d2-object", "g", svg, ["base64-id"]);
    const shape = element("shape", "g", d2Object, ["shape"]);
    const rect = element("rect", "rect", shape);

    expect({
      mermaid: (highestDiagramGroup(text as unknown as Element, svg as unknown as SVGSVGElement) as unknown as MockElement).id,
      d2: (highestDiagramGroup(rect as unknown as Element, svg as unknown as SVGSVGElement) as unknown as MockElement).id,
    }).toMatchInlineSnapshot(`
      {
        "d2": "d2-object",
        "mermaid": "node",
      }
    `);
  });

  it("fits transformed content geometry with padding and applies the lower wheel rate", () => {
    expect({
      landscape: fitSvgBox(
        { x: 0, y: 0, width: 1000, height: 500 },
        { x: 200, y: 100, width: 100, height: 50 },
      ),
      portrait: fitSvgBox(
        { x: 0, y: 0, width: 1000, height: 500 },
        { x: 200, y: 100, width: 20, height: 100 },
      ),
      transformed: transformSvgBox(
        { x: 0, y: 0, width: 100, height: 50 },
        { a: 0, b: 1, c: -1, d: 0, e: 300, f: 200 },
      ),
      wheel: {
        inward: diagramWheelZoom(1, -100),
        outward: diagramWheelZoom(1, 100),
        minimum: diagramWheelZoom(0.1, 1000),
        maximum: diagramWheelZoom(64, -1000),
      },
    }).toMatchInlineSnapshot(`
      {
        "landscape": {
          "height": 62,
          "width": 124,
          "x": 188,
          "y": 94,
        },
        "portrait": {
          "height": 124,
          "width": 248,
          "x": 86,
          "y": 88,
        },
        "transformed": {
          "height": 100,
          "width": 50,
          "x": 250,
          "y": 200,
        },
        "wheel": {
          "inward": 1.2214027581601699,
          "maximum": 64,
          "minimum": 0.1,
          "outward": 0.8187307530779818,
        },
      }
    `);
  });
});
