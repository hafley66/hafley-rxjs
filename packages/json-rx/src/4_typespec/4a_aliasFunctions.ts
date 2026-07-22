import type { FunctionContext, Program } from "@typespec/compiler";
import { $ } from "@typespec/compiler/typekit";
import type { AutomationMetadata, FlowMetadata, OutputMetadata, SourceMetadata } from "./1_decorators";

export type AliasAutomationGraph = {
  automation: AutomationMetadata;
  sources: SourceMetadata[];
  flows: FlowMetadata[];
  outputs: OutputMetadata[];
};

type AliasNode =
  | { kind: "automation"; definition: AutomationMetadata }
  | { kind: "source"; definition: SourceMetadata }
  | { kind: "flow"; definition: FlowMetadata }
  | { kind: "output"; definition: OutputMetadata };

type AliasGraphState = AliasAutomationGraph & {
  nodes: WeakMap<object, AliasNode>;
};

export const aliasAutomationGraphs = new WeakMap<Program, AliasGraphState>();

function graph(program: Program): AliasGraphState {
  let current = aliasAutomationGraphs.get(program);
  if (!current) {
    current = { automation: { id: "", pageHost: "" }, sources: [], flows: [], outputs: [], nodes: new WeakMap() };
    aliasAutomationGraphs.set(program, current);
  }
  return current;
}

function token(context: FunctionContext, node: AliasNode): object {
  const value = $(context.program).model.create({ properties: {} });
  graph(context.program).nodes.set(value, node);
  return value;
}

function expectNode<Kind extends AliasNode["kind"]>(
  context: FunctionContext,
  value: object,
  kind: Kind,
): Extract<AliasNode, { kind: Kind }> {
  const node = graph(context.program).nodes.get(value);
  if (!node || node.kind !== kind) throw new Error(`Expected ${kind} alias input`);
  return node as Extract<AliasNode, { kind: Kind }>;
}

function automation(context: FunctionContext, id: string, pageHost: string): object {
  const current = graph(context.program);
  if (current.automation.id) throw new Error("Expected one automation alias");
  const definition = { id, pageHost } satisfies AutomationMetadata;
  current.automation = definition;
  return token(context, { kind: "automation", definition });
}

function source(context: FunctionContext, owner: object, id: string, requestUrl: string, methods: string[]): object {
  expectNode(context, owner, "automation");
  const current = graph(context.program);
  if (current.sources.some((entry) => entry.id === id)) throw new Error(`Duplicate source alias: ${id}`);
  const definition = { id, requestUrl, methods } satisfies SourceMetadata;
  current.sources.push(definition);
  return token(context, { kind: "source", definition });
}

function map(context: FunctionContext, sourceValue: object, id: string, from: string, fields: Record<string, string>): object {
  const sourceNode = expectNode(context, sourceValue, "source");
  const current = graph(context.program);
  if (current.flows.some((entry) => entry.id === id)) throw new Error(`Duplicate flow alias: ${id}`);
  const definition = { id, source: sourceNode.definition.id, from, fields } satisfies FlowMetadata;
  current.flows.push(definition);
  return token(context, { kind: "flow", definition });
}

function output(context: FunctionContext, flowValue: object, stream: string): object {
  const flowNode = expectNode(context, flowValue, "flow");
  const current = graph(context.program);
  if (current.outputs.some((entry) => entry.stream === stream)) throw new Error(`Duplicate output alias: ${stream}`);
  const definition = { flow: flowNode.definition.id, stream } satisfies OutputMetadata;
  current.outputs.push(definition);
  return token(context, { kind: "output", definition });
}

export const $functions = { JsonRx: { automation, source, map, output } };
