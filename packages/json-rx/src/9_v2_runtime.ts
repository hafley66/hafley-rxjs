import jsonata from "jsonata";
import { concatMap, defer, from, map, merge, Observable, scan, shareReplay } from "rxjs";
import type { JsonObject, JsonValue, RuntimeSource } from "./0_types";
import { AutomationV2Schema, type AutomationV2, type ObservableExpression } from "./8_v2_schema";

export type NetworkResponse = {
  method: string;
  pageUrl: string;
  requestUrl: string;
  status: number;
  ts: number;
  body: JsonValue;
};

export type RuntimeValue = {
  value: JsonValue;
  origin?: { url: string; ts: number };
};

export type HostContext = {
  automationId: string;
  flowRef: string;
  node: string;
  parameters: unknown;
  signal: AbortSignal;
  capabilities: ReadonlySet<string>;
  trace: (entry: AutomationV2Trace) => void;
};

export type HostBinding =
  | { kind: "source"; create: (context: HostContext) => Observable<RuntimeValue> }
  | { kind: "operator"; apply: (input$: Observable<RuntimeValue>, context: HostContext) => Observable<RuntimeValue> };

export type HostRegistry = {
  ports: Record<string, HostBinding>;
  schemas: Record<string, { parse: (value: unknown) => unknown }>;
  grantedCapabilities?: ReadonlySet<string>;
};

export type DashboardEmission = {
  ruleId: string;
  url: string;
  ts: number;
  matches: JsonObject[];
  stream: string;
  schema: Record<string, unknown>;
};

export type AutomationV2Runtime = {
  automation: AutomationV2;
  roots: Record<string, Observable<DashboardEmission>>;
  canonicalIr: string;
};

export type AutomationV2Trace = {
  node: string;
  phase: "map";
  path: string;
  language: "jsonata";
  expression: string;
  outcome: "passed" | "missing" | "error";
  result?: unknown;
  reason?: string;
};

export type AutomationV2RuntimeOptions = {
  trace?: (entry: AutomationV2Trace) => void;
  hosts?: HostRegistry;
};

type LocatedValue = RuntimeValue;

function sourceOrigin(value: RuntimeSource): LocatedValue["origin"] {
  return { url: "pageUrl" in value ? value.pageUrl : value.url, ts: value.ts };
}

function get(value: JsonValue, pointer: string): JsonValue {
  let current = value;
  for (const segment of pointer.slice(2).split(".")) {
    if (typeof current !== "object" || current === null || Array.isArray(current)) {
      throw new Error(`Path did not resolve: ${pointer}`);
    }
    current = current[segment];
  }
  if (current === undefined) throw new Error(`Path did not resolve: ${pointer}`);
  return current;
}

function getOptional(value: JsonValue, pointer: string): JsonValue | undefined {
  try {
    return get(value, pointer);
  } catch {
    return undefined;
  }
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonical(entry)]),
  );
}

function flowKey(ref: string, parameters: unknown): string {
  return `${ref}?${JSON.stringify(canonical(parameters ?? {}))}`;
}

export function compileAutomationV2(
  input: unknown,
  sources: Record<string, Observable<RuntimeSource>>,
  options: AutomationV2RuntimeOptions = {},
): AutomationV2Runtime {
  const automation = AutomationV2Schema.parse(input);
  const instances = new Map<string, Observable<LocatedValue>>();
  const hostSources = new Map<string, Observable<LocatedValue>>();
  const grantedCapabilities = options.hosts?.grantedCapabilities ?? new Set<string>();

  const hostPort = (ref: string, kind: HostBinding["kind"]) => {
    const declaration = automation.bindings.hosts[ref];
    const binding = options.hosts?.ports[ref];
    if (!declaration) throw new Error(`Unknown host port: ${ref}`);
    if (declaration.kind !== kind) throw new Error(`Host port kind mismatch: ${ref}`);
    if (!binding) throw new Error(`Missing host runtime binding: ${ref}`);
    if (binding.kind !== kind) throw new Error(`Host runtime binding kind mismatch: ${ref}`);
    for (const capability of declaration.capabilities) {
      if (!grantedCapabilities.has(capability)) throw new Error(`Denied host capability: ${capability}`);
    }
    if (!options.hosts?.schemas[declaration.outputSchema]) throw new Error(`Missing host output schema: ${declaration.outputSchema}`);
    if (kind === "operator" && (!declaration.inputSchema || !options.hosts.schemas[declaration.inputSchema])) {
      throw new Error(`Missing host input schema: ${ref}`);
    }
    return { declaration, binding };
  };

  const validate = (schemaRef: string, value: RuntimeValue): RuntimeValue => {
    options.hosts?.schemas[schemaRef].parse(value.value);
    return value;
  };

  const contextFor = (flowRef: string, node: string, signal: AbortSignal): HostContext => ({
    automationId: automation.id,
    flowRef,
    node,
    parameters: automation.circuit.flows[flowRef]?.parameters ?? {},
    signal,
    capabilities: grantedCapabilities,
    trace: options.trace ?? (() => {}),
  });

  const hostObservable = (create: (context: HostContext) => Observable<RuntimeValue>, declaration: { outputSchema: string; delivery: { subscription: "per-subscriber" | "shared"; replay: "none" | "last" } }, flowRef: string, node: string) => {
    const observable = defer(() => {
      const controller = new AbortController();
      return new Observable<RuntimeValue>((subscriber) => {
        let source: Observable<RuntimeValue>;
        try {
          source = create(contextFor(flowRef, node, controller.signal));
        } catch (error) {
          subscriber.error(error);
          return () => controller.abort();
        }
        const subscription = source.pipe(map((value) => validate(declaration.outputSchema, value))).subscribe(subscriber);
        return () => { controller.abort(); subscription.unsubscribe(); };
      });
    });
    return declaration.delivery.subscription === "shared"
      ? observable.pipe(shareReplay({ bufferSize: declaration.delivery.replay === "last" ? 1 : 0, refCount: true }))
      : observable;
  };

  const compileExpression = (expression: ObservableExpression, flowRef: string): Observable<LocatedValue> => {
    if ("source" in expression) {
      const definition = automation.circuit.sources[expression.source.ref];
      if (definition?.host) {
        const ref = definition.host.ref;
        const existing = hostSources.get(ref);
        if (existing) return existing;
        const { declaration, binding } = hostPort(ref, "source");
        const source = binding as Extract<HostBinding, { kind: "source" }>;
        const compiled = hostObservable(source.create, declaration, flowRef, expression.node);
        hostSources.set(ref, compiled);
        return compiled;
      }
      return defer(() => {
        const source = sources[expression.source.ref];
        if (!source) throw new Error(`Missing source runtime binding: ${expression.source.ref}`);
        return source.pipe(map((response) => ({
          value: response as unknown as JsonValue,
          origin: sourceOrigin(response),
        })));
      });
    }
    if ("host" in expression) {
      const { declaration, binding } = hostPort(expression.host.ref, "operator");
      const operator = binding as Extract<HostBinding, { kind: "operator" }>;
      const input$ = compileExpression(expression.host.input, flowRef).pipe(
        map((value) => validate(declaration.inputSchema!, value)),
      );
      return hostObservable((context) => operator.apply(input$, context), declaration, flowRef, expression.node);
    }
    if ("map" in expression) {
      return compileExpression(expression.map.input, flowRef).pipe(
        concatMap((inputValue) => {
          const root = get(inputValue.value, expression.map.from);
          return from(Promise.all(Object.entries(expression.map.fields).map(async ([field, source]) => {
            try {
              const value = await jsonata(source).evaluate(root);
              if (value === undefined) {
                options.trace?.({ node: expression.node, phase: "map", path: field, language: "jsonata", expression: source, outcome: "missing" });
                return [] as const;
              }
              options.trace?.({ node: expression.node, phase: "map", path: field, language: "jsonata", expression: source, outcome: "passed", result: value });
              return [field, value] as const;
            } catch (error) {
              options.trace?.({ node: expression.node, phase: "map", path: field, language: "jsonata", expression: source, outcome: "error", reason: String(error) });
              return [] as const;
            }
          }))).pipe(map((entries) => ({
            value: Object.fromEntries(entries.filter((entry) => entry.length === 2)) as JsonValue,
            origin: inputValue.origin,
          })));
        }),
      );
    }
    if ("merge" in expression) {
      return merge(...expression.merge.inputs.map((input) => compileExpression(input, flowRef)));
    }
    if ("scan" in expression) {
      const definition = automation.circuit.reducers[expression.scan.reducer.ref];
      if (!definition) throw new Error(`Unknown v2 reducer: ${expression.scan.reducer.ref}`);
      return compileExpression(expression.scan.input, flowRef).pipe(
        scan<LocatedValue, LocatedValue>((previous, inputValue) => {
          const event = inputValue.value as JsonObject;
          const eventType = event.type;
          if (typeof eventType !== "string") throw new Error("Scan input requires an event type");
          const reducerCase = definition.cases[eventType];
          if (!reducerCase) return { value: previous.value, origin: inputValue.origin };
          const previousAccumulator = previous.value as JsonObject;
          const accumulator = reducerCase.replace
            ? get(inputValue.value, reducerCase.replace)
            : {
                ...previousAccumulator,
                ...Object.fromEntries(Object.entries(reducerCase.patch ?? {}).flatMap(([field, path]) => {
                  const value = getOptional(inputValue.value, path);
                  return value === undefined ? [] : [[field, value]];
                })),
              };
          if (typeof accumulator !== "object" || accumulator === null || Array.isArray(accumulator)) {
            throw new Error(`Scan accumulator must be an object: ${expression.scan.reducer.ref}`);
          }
          return {
            value: accumulator,
            origin: inputValue.origin,
          } satisfies LocatedValue;
        }, {
          value: definition.seed as unknown as JsonValue,
          origin: undefined,
        }),
      );
    }
    return compileExpression(expression.shareReplay.input, flowRef).pipe(
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  };

  const flow = (ref: string): Observable<LocatedValue> => {
    const definition = automation.circuit.flows[ref];
    if (!definition) throw new Error(`Unknown v2 flow: ${ref}`);
    const key = flowKey(ref, definition.parameters);
    const existing = instances.get(key);
    if (existing) return existing;
    const compiled = compileExpression(definition.expression, ref);
    instances.set(key, compiled);
    return compiled;
  };

  const roots = Object.fromEntries(automation.outputs.map((output) => [
    output.stream,
    flow(output.flow).pipe(
      map((located): DashboardEmission => {
        if (typeof located.value !== "object" || located.value === null || Array.isArray(located.value)) {
          throw new Error(`Dashboard flow must emit an object: ${output.flow}`);
        }
        return {
          ruleId: automation.id,
          url: located.origin?.url ?? output.flow,
          ts: located.origin?.ts ?? 0,
          matches: [located.value as JsonObject],
          stream: output.stream,
          schema: output.schema,
        };
      }),
    ),
  ]));

  return {
    automation,
    roots,
    canonicalIr: JSON.stringify(canonical(automation)),
  };
}
