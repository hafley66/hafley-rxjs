// The rename from `Ident` to OpenTelemetry resource attributes. Nothing here imports OTel: the
// attribute names are the contract and they are strings, so a consumer with no collector still gets
// a record every backend already understands.
import type { Ident } from "./0_types.js"

export const ATTR = {
  serviceName: "service.name",
  serviceNamespace: "service.namespace",
  serviceInstanceId: "service.instance.id",
  serviceVersion: "service.version",
  processPid: "process.pid",
  processParentPid: "process.parent_pid",
  processCreationTime: "process.creation.time",
  processRuntimeName: "process.runtime.name",
  processRuntimeVersion: "process.runtime.version",
  telemetrySdkLanguage: "telemetry.sdk.language",
} as const

export type Attributes = Readonly<Record<string, string | number>>

// `process.runtime.name` takes `nodejs` or `browser` from the conventions. A worker is a browser
// runtime by that list, so the distinction rides on `service.name` where it is queryable.
const RUNTIME_ATTR: Readonly<Record<Ident["runtime"], string>> = {
  nodejs: "nodejs",
  bun: "bun",
  deno: "deno",
  browser: "browser",
  worker: "browser",
  unknown: "unknown",
}

export function resource(id: Ident): Attributes {
  const out: Record<string, string | number> = {
    [ATTR.serviceName]: id.service,
    [ATTR.serviceInstanceId]: id.instance,
    [ATTR.processPid]: id.pid,
    [ATTR.processCreationTime]: Math.round(id.born),
    [ATTR.processRuntimeName]: RUNTIME_ATTR[id.runtime],
    [ATTR.telemetrySdkLanguage]: "javascript",
  }
  if (id.namespace !== undefined) out[ATTR.serviceNamespace] = id.namespace
  if (id.parent !== undefined) out[ATTR.processParentPid] = id.parent
  if (id.version !== undefined) out[ATTR.processRuntimeVersion] = id.version
  return out
}
