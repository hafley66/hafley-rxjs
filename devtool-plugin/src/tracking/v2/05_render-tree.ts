import { set } from "lodash"
import type { State } from "./00.types"

type Store = State["store"]

type Line = { code: string; comment: string }

/**
 * Renders the static observable tree - definition-time structure only.
 * No subscriptions, no sends, no arg_calls (runtime data).
 */
export function renderStaticTree(store: Store): string {
  const lines: Line[] = []

  // Exclude observables created dynamically by arg_calls (runtime)
  const runtimeObsIds = new Set(
    Object.values(store.arg_call)
      .map(ac => ac.observable_id)
      .filter(Boolean),
  )

  // Find root observables (not created by an operator, not created at runtime)
  const operatorTargets = new Set(Object.values(store.operator).map(op => op.target_observable_id))
  const rootObservables = Object.values(store.observable).filter(
    obs => !operatorTargets.has(obs.id) && !runtimeObsIds.has(obs.id),
  )

  // Track which pipes we've rendered (to find orphan pipes later)
  const renderedPipes = new Set<string>()

  for (const obs of rootObservables) {
    renderObservable(obs.id, store, lines, 0, renderedPipes)
  }

  // Find orphan pipes (pipes whose parent is a pipe output, not a root observable)
  // These are chained pipes like: a$.pipe(...) where a$ is itself a pipe output
  const orphanPipes = Object.values(store.pipe)
    .filter(p => !renderedPipes.has(p.id))
    .sort((a, b) => a.created_at - b.created_at)

  for (const pipe of orphanPipes) {
    // Render with reference to parent observable (which is a pipe output)
    lines.push({ code: `#${pipe.parent_observable_id}`, comment: "" })
    renderPipe(pipe.id, store, lines, 1, renderedPipes)
  }

  // Align comments to column
  const maxCodeLen = Math.max(...lines.map(l => l.code.length))
  return lines.map(l => `${l.code.padEnd(maxCodeLen)}  // ${l.comment}`).join("\n")
}

function renderObservable(obsId: string, store: Store, lines: Line[], depth: number, renderedPipes: Set<string>) {
  const obs = store.observable[obsId]
  if (!obs) return

  const indent = "  ".repeat(depth)
  lines.push({ code: `${indent}${obs.name ?? "Observable"}`, comment: `#${obs.id}` })

  // Find pipes that start from this observable
  const pipes = Object.values(store.pipe).filter(p => p.parent_observable_id === obsId)

  for (const pipe of pipes) {
    renderPipe(pipe.id, store, lines, depth + 1, renderedPipes)
  }
}

function renderPipe(pipeId: string, store: Store, lines: Line[], depth: number, renderedPipes: Set<string>) {
  const pipe = store.pipe[pipeId]
  if (!pipe) return

  renderedPipes.add(pipeId)

  const indent = "  ".repeat(depth)
  lines.push({ code: `${indent}.pipe(`, comment: "" })

  // Get operators in this pipe, sorted by index
  const operators = Object.values(store.operator)
    .filter(op => op.pipe_id === pipeId)
    .sort((a, b) => a.index - b.index)

  for (const op of operators) {
    renderOperator(op.id, store, lines, depth + 1)
  }

  lines.push({ code: `${indent})`, comment: `-> #${pipe.observable_id}` })
}

function renderOperator(opId: string, store: Store, lines: Line[], depth: number) {
  const op = store.operator[opId]
  if (!op) return

  const opFun = store.operator_fun[op.operator_fun_id]
  const indent = "  ".repeat(depth)

  // Get static args for this operator_fun
  const args = Object.values(store.arg).filter(a => a.owner_id === op.operator_fun_id)
  const argStr = renderArgsSummary(args)

  lines.push({ code: `${indent}${opFun?.name ?? "op"}(${argStr}),`, comment: `#${op.target_observable_id}` })
}

function cleanFnSource(source: string): string {
  // Strip __vite_ssr_import_ prefixes from function source
  return source.replace(/__vite_ssr_import_\d+__\./g, "")
}

function renderArgValue(arg: Store["arg"][string]): string {
  if (arg.is_function) {
    return arg.fn_source ? cleanFnSource(arg.fn_source) : "fn"
  } else if (arg.observable_id) {
    return `#${arg.observable_id}`
  } else if (arg.value !== undefined) {
    return JSON.stringify(arg.value)
  }
  return "?"
}

// Marker class to distinguish arg leaves from regular objects
class ArgLeaf {
  constructor(public arg: Store["arg"][string]) {}
}

function renderArgsSummary(args: Store["arg"][string][]): string {
  if (args.length === 0) return ""

  // Build tree using lodash set
  const root: Record<string, unknown> = {}
  for (const arg of args) {
    const path = arg.path.replace(/^\$args\.?/, "")
    set(root, path, new ArgLeaf(arg))
  }

  // Render top-level args
  const keys = Object.keys(root).sort((a, b) => Number(a) - Number(b))
  return keys.map(k => renderNode(root[k])).join(", ")
}

function renderNode(node: unknown): string {
  if (node instanceof ArgLeaf) {
    return renderArgValue(node.arg)
  }

  if (Array.isArray(node)) {
    return `[${node.map(renderNode).join(", ")}]`
  }

  if (typeof node === "object" && node !== null) {
    const entries = Object.entries(node).map(([k, v]) => `${k}: ${renderNode(v)}`)
    return `{ ${entries.join(", ")} }`
  }

  return "?"
}
