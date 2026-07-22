export type DelayedRequest = { id: string; delayTicks: number }
export type ResultId = string
export type RequestEvent = { type: 'request'; value: DelayedRequest }
