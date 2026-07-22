import { catchError, EMPTY, firstValueFrom, map, Observable, of, throwError } from "rxjs";
import * as z from "zod";
import { describe, expect, it } from "vitest";
import { compileAutomationV2, type HostRegistry } from "./9_v2_runtime";

const valueSchema = z.object({ value: z.number() });
const outputSchema = z.object({ doubled: z.number() });

function automation(operator = true) {
  const expression = operator
    ? {
        node: "double",
        host: {
          ref: "host.double",
          input: { node: "values", source: { ref: "host.values" } },
        },
      }
    : { node: "values", source: { ref: "host.values" } };
  return {
    version: "automation.v2",
    profile: "rxjs-7.8",
    id: "jsonrx://test/host-ports",
    bindings: {
      sources: {},
      hosts: {
        "host.values": {
          kind: "source",
          outputSchema: "schema://value",
          delivery: { subscription: "shared", replay: "last" },
          capabilities: ["values.read"],
        },
        "host.double": {
          kind: "operator",
          inputSchema: "schema://value",
          outputSchema: "schema://output",
          delivery: { subscription: "per-subscriber", replay: "none" },
        },
      },
    },
    circuit: {
      sources: { "host.values": { host: { ref: "host.values" } } },
      reducers: {},
      flows: { "host.flow": { expression } },
    },
    outputs: [{ kind: "instant.dashboard.emit", flow: "host.flow", stream: "host.values", schema: {} }],
  };
}

function registry(): HostRegistry {
  return {
    schemas: { "schema://value": valueSchema, "schema://output": outputSchema },
    grantedCapabilities: new Set(["values.read"]),
    ports: {
      "host.values": {
        kind: "source",
        create: () => EMPTY,
      },
      "host.double": {
        kind: "operator",
        apply: (input$) => input$,
      },
    },
  };
}

describe("host ports", () => {
  it("validates capability and contract references before subscription", () => {
    const hosts = registry();
    hosts.grantedCapabilities = new Set();
    expect(() => compileAutomationV2(automation(), {}, { hosts })).toThrow("Denied host capability: values.read");
  });

  it("passes origin through a source and operator port", async () => {
    const hosts = registry();
    hosts.ports["host.values"] = {
      kind: "source",
      create: () => of({ value: { value: 21 }, origin: { url: "host://values", ts: 7 } }),
    };
    hosts.ports["host.double"] = {
      kind: "operator",
      apply: (input$) => input$.pipe(
        map(({ value, origin }) => ({ value: { doubled: (value as { value: number }).value * 2 }, origin })),
      ),
    };
    const runtime = compileAutomationV2(automation(), {}, { hosts });
    await expect(firstValueFrom(runtime.roots["host.values"])).resolves.toMatchInlineSnapshot(`
      {
        "matches": [
          {
            "doubled": 42,
          },
        ],
        "ruleId": "jsonrx://test/host-ports",
        "schema": {},
        "stream": "host.values",
        "ts": 7,
        "url": "host://values",
      }
    `);
  });

  it("routes host errors through downstream catchError", async () => {
    const hosts = registry();
    hosts.ports["host.values"] = { kind: "source", create: () => of({ value: { value: 1 } }) };
    hosts.ports["host.double"] = { kind: "operator", apply: () => throwError(() => new Error("host failed")) };
    const runtime = compileAutomationV2(automation(), {}, { hosts });

    await expect(firstValueFrom(runtime.roots["host.values"].pipe(
      catchError((error) => of({ message: error.message })),
    ))).resolves.toEqual({ message: "host failed" });
  });

  it("aborts a host source when the final subscriber unsubscribes", () => {
    const hosts = registry();
    let aborts = 0;
    hosts.ports["host.values"] = {
      kind: "source",
      create: ({ signal }) => new Observable(() => {
        signal.addEventListener("abort", () => { aborts += 1 }, { once: true });
      }),
    };
    const runtime = compileAutomationV2(automation(false), {}, { hosts });
    const subscription = runtime.roots["host.values"].subscribe();
    subscription.unsubscribe();

    expect(aborts).toBe(1);
  });
});
