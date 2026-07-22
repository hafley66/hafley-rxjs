export type UsageSnapshot = { fiveHour: number; sevenDay: number }
export type UsageUpdate = { fiveHour?: number; sevenDay?: number }
export type SnapshotEvent = { type: 'snapshot'; value: UsageSnapshot }
export type UpdateEvent = { type: 'update'; value: UsageUpdate }
export type UsageEvent = SnapshotEvent | UpdateEvent
