import type { FunctionContext, Program, Statement } from "@typespec/compiler";
import { SyntaxKind, type AliasStatementNode, type CallExpressionNode, type NamespaceStatementNode } from "@typespec/compiler/ast";
import { $ } from "@typespec/compiler/typekit";
import type { AutomationMetadata, FlowMetadata, LogicFlowMetadata, MapFlowMetadata, OutputMetadata, SourceMetadata } from "./1_decorators";

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
  const definition = { kind: "map", id, source: sourceNode.definition.id, from, fields } satisfies MapFlowMetadata;
  current.flows.push(definition);
  return token(context, { kind: "flow", definition });
}

function logicReferences(expression: unknown): string[] {
  const roots = new Set<string>();
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) return void value.forEach(visit);
    if (typeof value !== "object" || value === null) return;
    for (const [operator, argument] of Object.entries(value)) {
      if (operator === "var") {
        const path = Array.isArray(argument) ? argument[0] : argument;
        if (typeof path === "string" && path) roots.add(path.split(".")[0]);
      } else visit(argument);
    }
  };
  visit(expression);
  return [...roots].sort();
}

function logic(context: FunctionContext, expression: string): object {
  const current = graph(context.program);
  const parsed = JSON.parse(expression) as unknown;
  const definition = {
    kind: "logic",
    id: `__logic_${current.flows.filter((flow) => flow.kind === "logic").length}`,
    expression: parsed,
    references: [],
  } satisfies LogicFlowMetadata;
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

function callName(call: CallExpressionNode): string | undefined {
  return call.target.kind === SyntaxKind.Identifier ? call.target.sv : undefined;
}

function aliasStatements(statements: readonly Statement[] | NamespaceStatementNode | undefined): AliasStatementNode[] {
  if (!statements) return [];
  if (!Array.isArray(statements)) return aliasStatements((statements as NamespaceStatementNode).statements);
  const list = statements as readonly Statement[];
  return list.flatMap((statement) => statement.kind === SyntaxKind.NamespaceStatement
    ? aliasStatements(statement.statements)
    : statement.kind === SyntaxKind.AliasStatement ? [statement] : []);
}

function resolveAliasScope(program: Program, current: AliasGraphState): void {
  const sources = [...current.sources];
  const maps = current.flows.filter((flow): flow is MapFlowMetadata => flow.kind === "map");
  const logics = current.flows.filter((flow): flow is LogicFlowMetadata => flow.kind === "logic");
  let sourceIndex = 0;
  let mapIndex = 0;
  let logicIndex = 0;
  const aliases = new Map<string, AliasNode>();

  for (const sourceFile of program.sourceFiles.values()) {
    for (const alias of aliasStatements(sourceFile.statements)) {
      if (alias.value.kind !== SyntaxKind.CallExpression) continue;
      const name = callName(alias.value);
      if (name === "automation") aliases.set(alias.id.sv, { kind: "automation", definition: current.automation });
      if (name === "source") {
        const definition = sources[sourceIndex++];
        if (definition) aliases.set(alias.id.sv, { kind: "source", definition });
      }
      if (name === "map") {
        const definition = maps[mapIndex++];
        if (definition) aliases.set(alias.id.sv, { kind: "flow", definition });
      }
      if (name === "logic") {
        const definition = logics[logicIndex++];
        if (!definition) continue;
        const previousId = definition.id;
        definition.id = alias.id.sv;
        for (const output of current.outputs) if (output.flow === previousId) output.flow = definition.id;
        definition.references = logicReferences(definition.expression).map((name) => {
          const target = aliases.get(name);
          if (!target || (target.kind !== "source" && target.kind !== "flow")) throw new Error(`Unknown logic flow reference: ${name}`);
          return { name, kind: target.kind, ref: target.definition.id };
        });
        aliases.set(alias.id.sv, { kind: "flow", definition });
      }
    }
  }
}

export function resolveAliasGraph(program: Program): AliasAutomationGraph | undefined {
  const current = aliasAutomationGraphs.get(program);
  if (!current || !current.automation.id) return undefined;
  resolveAliasScope(program, current);
  return current;
}

export const $functions = { JsonRx: { automation, source, map, logic, output } };
