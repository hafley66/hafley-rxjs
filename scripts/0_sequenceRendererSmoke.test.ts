import { describe, expect, test } from "vitest"

import {
  SequenceRendererUnavailableError,
  SequenceRendererVersionError,
  sequenceRendererPins,
  smokeSequenceRenderers,
} from "./0_sequenceRendererSmoke.mjs"

describe("sequence renderer toolchain", () => {
  test(
    "pins Mermaid in Playwright and D2 on the CLI",
    async () => {
      expect(await smokeSequenceRenderers()).toMatchInlineSnapshot(`
        {
          "d2": {
            "options": [
              "--watch=false",
              "--theme=0",
              "--layout=dagre",
              "--pad=100",
              "--scale=1",
            ],
            "renderer": "d2",
            "svg": {
              "containsAlice": true,
              "containsBob": true,
              "containsHello": true,
              "hasClosingTag": true,
              "rootTag": "<svg",
              "viewBox": "0 0 452 418",
            },
            "version": "0.7.1",
          },
          "mermaid": {
            "browserVersion": "151.0.7922.34",
            "host": "playwright",
            "hostVersion": "1.62.1",
            "options": {
              "deterministicIDSeed": "hafley-sequence-renderer-smoke",
              "deterministicIds": true,
              "fontFamily": "Arial",
              "securityLevel": "strict",
              "sequence": {
                "useMaxWidth": false,
              },
              "startOnLoad": false,
              "theme": "base",
            },
            "renderer": "mermaid",
            "svg": {
              "containsAlice": true,
              "containsBob": true,
              "containsHello": true,
              "hasClosingTag": true,
              "rootTag": "<svg",
              "viewBox": "-50 -10 450 215",
            },
            "version": "11.16.0",
          },
        }
      `)
    },
    60_000,
  )

  test("reports unavailable and mismatched renderers", () => {
    expect({
      pins: sequenceRendererPins,
      unavailable: new SequenceRendererUnavailableError(
        "d2",
        "d2 0.7.1 on PATH",
        new Error("spawn d2 ENOENT"),
      ).message,
      mismatch: new SequenceRendererVersionError(
        "d2",
        "0.7.1",
        "0.7.0",
      ).message,
    }).toMatchInlineSnapshot(`
      {
        "mismatch": "sequence renderer version mismatch: d2; expected 0.7.1; received 0.7.0",
        "pins": {
          "d2": {
            "command": "d2",
            "options": [
              "--watch=false",
              "--theme=0",
              "--layout=dagre",
              "--pad=100",
              "--scale=1",
            ],
            "version": "0.7.1",
          },
          "mermaid": {
            "hostPackage": "playwright",
            "hostVersion": "1.62.1",
            "options": {
              "deterministicIDSeed": "hafley-sequence-renderer-smoke",
              "deterministicIds": true,
              "fontFamily": "Arial",
              "securityLevel": "strict",
              "sequence": {
                "useMaxWidth": false,
              },
              "startOnLoad": false,
              "theme": "base",
            },
            "package": "mermaid",
            "version": "11.16.0",
          },
        },
        "unavailable": "sequence renderer unavailable: d2; expected d2 0.7.1 on PATH; spawn d2 ENOENT",
      }
    `)
  })
})
