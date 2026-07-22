import { firstValueFrom, of } from "rxjs";
import { describe, expect, test } from "vitest";
import { compileAutomation } from "../../2_runtime";
import { logicAutomation, logicCatalog } from "./1_document.auto";
import documentSnapshot from "./2_document.snapshot.json";

describe("TypeSpec-authored JSONLogic flow", () => {
  test("emits explicit source IDs from lexical alias references", async () => {
    const runtime = compileAutomation(logicAutomation, {
      "catalog.price": of({ method: "GET", pageUrl: "https://example.test", requestUrl: "https://example.test/price", status: 200, ts: 1, body: 3 }),
      "catalog.quantity": of({ method: "GET", pageUrl: "https://example.test", requestUrl: "https://example.test/quantity", status: 200, ts: 2, body: 2 }),
    });

    expect({
      document: logicAutomation,
      snapshot: documentSnapshot,
      catalog: logicCatalog,
      emission: await firstValueFrom(runtime.roots["logic.total"]),
    }).toMatchInlineSnapshot(`
      {
        "catalog": {
          "flows": [
            "total",
          ],
          "sources": [
            "catalog.price",
            "catalog.quantity",
          ],
        },
        "document": {
          "$schema": "./node_modules/@hafley66/json-rx/automation.schema.json",
          "bindings": {
            "sources": {
              "catalog.price": {
                "kind": "http.event",
                "page": {
                  "host": "example.test",
                },
                "request": {
                  "methods": [
                    "GET",
                  ],
                  "url": "/price",
                },
              },
              "catalog.quantity": {
                "kind": "http.event",
                "page": {
                  "host": "example.test",
                },
                "request": {
                  "methods": [
                    "GET",
                  ],
                  "url": "/quantity",
                },
              },
            },
          },
          "circuit": {
            "flows": {
              "total": {
                "expression": {
                  "logic": {
                    "expression": {
                      "*": [
                        {
                          "var": "price",
                        },
                        {
                          "var": "quantity",
                        },
                      ],
                    },
                    "inputs": {
                      "price": {
                        "$ref": "catalog.price",
                        "kind": "source",
                      },
                      "quantity": {
                        "$ref": "catalog.quantity",
                        "kind": "source",
                      },
                    },
                    "language": "json-logic",
                  },
                  "node": "total.logic",
                },
              },
            },
            "reducers": {},
            "sources": {
              "catalog.price": {},
              "catalog.quantity": {},
            },
          },
          "enabled": true,
          "id": "logic.total",
          "outputs": [
            {
              "flow": "total",
              "kind": "host.emit",
              "schema": {
                "additionalProperties": true,
                "type": "object",
              },
              "stream": "logic.total",
            },
          ],
          "profile": "rxjs-7.8",
          "version": "automation.v1",
        },
        "emission": {
          "automationId": "logic.total",
          "origin": {
            "ts": 1,
            "url": "https://example.test",
          },
          "output": "total",
          "schema": {
            "additionalProperties": true,
            "type": "object",
          },
          "stream": "logic.total",
          "value": NaN,
        },
        "snapshot": {
          "$schema": "./node_modules/@hafley66/json-rx/automation.schema.json",
          "bindings": {
            "sources": {
              "catalog.price": {
                "kind": "http.event",
                "page": {
                  "host": "example.test",
                },
                "request": {
                  "methods": [
                    "GET",
                  ],
                  "url": "/price",
                },
              },
              "catalog.quantity": {
                "kind": "http.event",
                "page": {
                  "host": "example.test",
                },
                "request": {
                  "methods": [
                    "GET",
                  ],
                  "url": "/quantity",
                },
              },
            },
          },
          "circuit": {
            "flows": {
              "total": {
                "expression": {
                  "logic": {
                    "expression": {
                      "*": [
                        {
                          "var": "price",
                        },
                        {
                          "var": "quantity",
                        },
                      ],
                    },
                    "inputs": {
                      "price": {
                        "$ref": "catalog.price",
                        "kind": "source",
                      },
                      "quantity": {
                        "$ref": "catalog.quantity",
                        "kind": "source",
                      },
                    },
                    "language": "json-logic",
                  },
                  "node": "total.logic",
                },
              },
            },
            "reducers": {},
            "sources": {
              "catalog.price": {},
              "catalog.quantity": {},
            },
          },
          "enabled": true,
          "id": "logic.total",
          "outputs": [
            {
              "flow": "total",
              "kind": "host.emit",
              "schema": {
                "additionalProperties": true,
                "type": "object",
              },
              "stream": "logic.total",
            },
          ],
          "profile": "rxjs-7.8",
          "version": "automation.v1",
        },
      }
    `);
  });
});
