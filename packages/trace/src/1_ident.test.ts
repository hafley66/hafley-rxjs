import { describe, expect, it } from "vitest"
import { ident, key, parentKey, runtimeOf } from "./1_ident.js"
import { workerName } from "./6_spawn.js"
import { ATTR, resource } from "./2_resource.js"

describe("ident in node", () => {
  it("reads its own pid and its parent's", () => {
    const id = ident({ service: "probe" })
    expect(runtimeOf()).toBe("nodejs")
    expect(id.pid).toBe(String(process.pid))
    expect(id.parent).toBe(String(process.ppid))
    expect(id.runtime).toBe("nodejs")
  })

  it("prints a prefix a console line can lead with", () => {
    expect(ident({ service: "grid" }).prefix).toBe(`grid/nodejs:${process.pid}`)
  })

  it("prefers npm_package_name to the conventions' fallback, and the fallback to nothing", () => {
    const held = process.env["npm_package_name"]
    process.env["npm_package_name"] = "from-npm"
    expect(ident().service).toBe("from-npm")
    delete process.env["npm_package_name"]
    expect(ident().service).toBe("unknown_service:nodejs")
    if (held !== undefined) process.env["npm_package_name"] = held
  })

  it("gives every call its own instance id", () => {
    expect(ident().instance).not.toBe(ident().instance)
  })

  it("takes OTEL_SERVICE_NAME over the fallback", () => {
    process.env["OTEL_SERVICE_NAME"] = "from-env"
    expect(ident().service).toBe("from-env")
    delete process.env["OTEL_SERVICE_NAME"]
  })
})

describe("workerName", () => {
  it("round trips the parent key and the service through the one channel a worker has", () => {
    const host = ident({ service: "grid", pid: "0bfcc223" })
    expect(workerName(host, "sorter")).toBe(`hafley:${key(host)}:sorter`)
  })
})

describe("parentKey", () => {
  it("forms the parent's key only when a handoff carried the birth time", () => {
    const handed = ident({ parent: "17", parentBorn: 1700000000000 })
    expect(parentKey(handed)).toBe("17@1700000000000")
    expect(parentKey(ident({ parent: "17", parentBorn: undefined }))).toBeUndefined()
    expect(parentKey(ident({ parent: undefined }))).toBeUndefined()
  })
})

describe("resource", () => {
  it("renames every field to its OpenTelemetry attribute", () => {
    const id = ident({ service: "grid", namespace: "hafley", parent: "17", pid: "42", version: "1.2.3" })
    const attrs = resource(id)
    expect(attrs[ATTR.serviceName]).toBe("grid")
    expect(attrs[ATTR.serviceNamespace]).toBe("hafley")
    expect(attrs[ATTR.processPid]).toBe("42")
    expect(attrs[ATTR.processParentPid]).toBe("17")
    expect(attrs[ATTR.processRuntimeName]).toBe("nodejs")
    expect(attrs[ATTR.telemetrySdkLanguage]).toBe("javascript")
  })

  it("leaves an absent parent out rather than printing undefined", () => {
    expect(ATTR.processParentPid in resource(ident({ parent: undefined, pid: "1" }))).toBe(false)
  })

  it("calls a worker a browser runtime, because the conventions have no third value", () => {
    expect(resource(ident({ runtime: "worker", pid: "w1" }))[ATTR.processRuntimeName]).toBe("browser")
  })
})
