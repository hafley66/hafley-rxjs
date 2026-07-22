export type JsonPrimitive = null | boolean | number | string
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }
export type JsonObject = { [key: string]: JsonValue }

export type Event<Data extends JsonValue = JsonValue> = { type: string; data: Data; time?: number; id?: string; partitionKey?: string; causationId?: string }
export type Effect = { id?: string; op: string; input?: JsonValue; timeoutMs?: number; retry?: { maxAttempts: number; backoffMs?: number } }

export type HttpEvent = {
  method: string
  pageUrl: string
  requestUrl: string
  status: number
  ts: number
  body: JsonValue
}
export type HostEvent = { type: string; data: JsonValue; url: string; ts: number }

export type RuntimeSource = HttpEvent | HostEvent

export type RuntimeEmission = {
  automationId: string
  output: string
  stream: string
  value: JsonValue
  schema: Record<string, unknown>
  origin?: { url: string; ts: number }
}
