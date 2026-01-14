import type { State } from "./00.types"

type Store = State["store"]

// Get root observables (not operator targets, not runtime created)
export function getRootObservables(store: Store) {
  const runtimeObsIds = new Set(
    Object.values(store.arg_call)
      .map(ac => ac.observable_id)
      .filter(Boolean),
  )
  const operatorTargets = new Set(Object.values(store.operator).map(op => op.target_observable_id))

  return Object.values(store.observable)
    .filter(obs => !operatorTargets.has(obs.id) && !runtimeObsIds.has(obs.id))
    .sort((a, b) => a.created_at - b.created_at)
}

// Get pipes for an observable
export function getPipesFor(store: Store, obsId: string) {
  return Object.values(store.pipe)
    .filter(p => p.parent_observable_id === obsId)
    .sort((a, b) => a.created_at - b.created_at)
}

// Get operators in a pipe, sorted by index
export function getOperatorsIn(store: Store, pipeId: string) {
  return Object.values(store.operator)
    .filter(op => op.pipe_id === pipeId)
    .sort((a, b) => a.index - b.index)
}

// Get args for an operator_fun
export function getArgsFor(store: Store, operatorFunId: string) {
  return Object.values(store.arg).filter(a => a.owner_id === operatorFunId)
}

// Get top-level subscriptions (no parent)
export function getTopLevelSubscriptions(store: Store) {
  return Object.values(store.subscription)
    .filter(s => !s.parent_subscription_id)
    .sort((a, b) => a.created_at - b.created_at)
}

// Get child subscriptions
export function getChildSubscriptions(store: Store, parentSubId: string) {
  return Object.values(store.subscription)
    .filter(s => s.parent_subscription_id === parentSubId)
    .sort((a, b) => a.created_at - b.created_at)
}

// Get sends for a subscription
export function getSendsFor(store: Store, subId: string) {
  return Object.values(store.send)
    .filter(s => s.subscription_id === subId)
    .sort((a, b) => a.created_at - b.created_at)
}

// Get all sends sorted by time (with id as tiebreaker for same timestamp)
export function getAllSends(store: Store) {
  return Object.values(store.send).sort((a, b) => {
    const timeDiff = a.created_at - b.created_at
    if (timeDiff !== 0) return timeDiff
    // Use numeric id comparison as tiebreaker (IDs are sequential)
    return Number(a.id) - Number(b.id)
  })
}

// Get dynamic observables created by an arg during a subscription
export function getDynamicObs(store: Store, argId: string, subId?: string) {
  return Object.values(store.arg_call)
    .filter(ac => ac.arg_id === argId && (!subId || ac.subscription_id === subId))
    .map(ac => (ac.observable_id ? store.observable[ac.observable_id] : null))
    .filter(Boolean)
}

// Check if observable is a runtime-created one (from arg_call)
export function isRuntimeObs(store: Store, obsId: string) {
  return Object.values(store.arg_call).some(ac => ac.observable_id === obsId)
}

// Get the arg_call that created an observable
export function getArgCallForObs(store: Store, obsId: string) {
  return Object.values(store.arg_call).find(ac => ac.observable_id === obsId)
}

// === HMR Queries ===

// Get dangling subscriptions (subscribed to observables no longer tracked)
// These are subscriptions to orphaned observables that won't receive HMR updates
export function getDanglingSubscriptions(store: Store) {
  const liveObsIds = new Set(Object.values(store.hmr_track).map(t => t.entity_id))
  return Object.values(store.subscription).filter(
    s => !liveObsIds.has(s.observable_id) && !s.unsubscribed_at,
  )
}

// === Marble Diagram Queries ===

type Subscription = Store["subscription"][string]
type Send = Store["send"][string]

export type SubTreeNode = {
  sub: Subscription
  children: SubTreeNode[]
  sends: Send[]
}

export type FlatSubRow = {
  sub: Subscription
  depth: number
  sends: Send[]
}

// Get full subscription tree rooted at a sub
export function getSubTree(store: Store, rootSubId: string): SubTreeNode | null {
  const sub = store.subscription[rootSubId]
  if (!sub) return null

  const sends = getSendsFor(store, rootSubId)
  const children = getChildSubscriptions(store, rootSubId).map(child => getSubTree(store, child.id)!).filter(Boolean)

  return { sub, children, sends }
}

// Flatten tree for rendering (with depth)
export function flattenSubTree(node: SubTreeNode, depth = 0): FlatSubRow[] {
  const rows: FlatSubRow[] = [{ sub: node.sub, depth, sends: node.sends }]
  for (const child of node.children) {
    rows.push(...flattenSubTree(child, depth + 1))
  }
  return rows
}

// Get time range from rows (or full store)
export function getTimeRange(rows: FlatSubRow[]): { min: number; max: number } {
  let min = Infinity
  let max = -Infinity

  for (const row of rows) {
    min = Math.min(min, row.sub.created_at)
    max = Math.max(max, row.sub.created_at_end ?? row.sub.unsubscribed_at ?? row.sub.created_at)

    for (const send of row.sends) {
      min = Math.min(min, send.created_at)
      max = Math.max(max, send.created_at_end ?? send.created_at)
    }
  }

  // Handle edge case of empty data
  if (min === Infinity) min = 0
  if (max === -Infinity) max = 0

  return { min, max }
}
