/**
 * RxJS Devtool Patch Plugin
 *
 * Build-time Vite plugin that patches RxJS internals:
 * - Observable.js constructor: inject ID creation + event emission
 * - Operator files: wrap with decorateOperatorFun
 * - Creation functions (optional): wrap with decorateCreate
 *
 * This is the standalone devtool - use 1_rxjs_hmr_plugin.ts for HMR support.
 */

import { createRequire } from "module"
import path from "path"
import type { Plugin, ResolvedConfig } from "rolldown-vite"

const require = createRequire(import.meta.url)

type VitestConfig = ResolvedConfig & {
  test?: {
    browser?: {
      enabled?: boolean
    }
  }
}

export interface RxjsDevtoolPatchOptions {
  debug?: boolean
  patchModulePath?: string
  /**
   * Patch RxJS creation functions (of, from, etc.) with decorateCreate.
   * Default: false because we use proxy.* wrappers instead.
   * Enable if you want to track observables created directly via raw rxjs imports.
   */
  patchCreation?: boolean
}

const IMPORT_PATCH = (patchPath: string) =>
  `import { patchObservable as __patchObservable__, main as __main__ } from "${patchPath}";\n`

const IMPORT_DECORATE_OP = (patchPath: string) =>
  `import { decorateOperatorFun as __decorateOp__ } from "${patchPath}";\n`

const IMPORT_DECORATE_CREATE = (patchPath: string) =>
  `import { decorateCreate as __decorateCreate__ } from "${patchPath}";\n`

// Conditionally create ID only when tracking is enabled
// If disabled, __oid__ = "" (falsy) so store checks fail gracefully
const CONSTRUCTOR_START = `\nconst __oid__ = __main__.state$.value.isEnabled ? __main__.createId() : "";\n`
const CONSTRUCTOR_END = `\nthis.__oid__ = __oid__;\nif (__oid__) {  __main__.emit({ type: "constructor-call-return", id: __oid__, observable: this }); }\n`
const PATCH_CALL = `\n__patchObservable__(Observable);\n`

// Regex patterns for matching constructor bodies across all formats
const ES5_PATTERN =
  /(function\s+Observable\s*\(\s*subscribe\s*\)\s*\{)(\s*)(if\s*\(\s*subscribe\s*\)\s*\{\s*this\._subscribe\s*=\s*subscribe;\s*\})(\s*)(\})/

const ESM_PATTERN =
  /(constructor\s*\(\s*subscribe\s*\)\s*\{)(\s*)(if\s*\(\s*subscribe\s*\)\s*\{\s*this\._subscribe\s*=\s*subscribe;\s*\})(\s*)(\})/

const TS_PATTERN =
  /(constructor\s*\(\s*subscribe\?\s*:\s*\([^)]+\)\s*=>\s*TeardownLogic\s*\)\s*\{)(\s*)(if\s*\(\s*subscribe\s*\)\s*\{\s*this\._subscribe\s*=\s*subscribe;\s*\})(\s*)(\})/

// Pattern to find end of Observable IIFE: }());
const ES5_IIFE_END = /(\}\(\)\);)/

function patchWithRegex(code: string, patchPath: string, pattern: RegExp, iifeEndPattern?: RegExp) {
  const patched = code.replace(pattern, (_match, open, ws1, body, ws2, close) => {
    return `${open}${CONSTRUCTOR_START}${ws1}${body}${CONSTRUCTOR_END}${ws2}${close}`
  })

  if (patched === code) {
    console.warn("[rxjs-debugger] WARNING: Pattern did not match! Constructor not patched.")
    return null
  }

  // Insert PATCH_CALL right after Observable class definition (IIFE end)
  let withPatch: string
  if (iifeEndPattern) {
    // For IIFE style (esm5): insert after }());
    withPatch = patched.replace(iifeEndPattern, `$&${PATCH_CALL}`)
  } else {
    // For class style (esm/ts): append at end
    withPatch = patched + PATCH_CALL
  }

  const result = IMPORT_PATCH(patchPath) + withPatch
  return { code: result, map: null }
}

function patchEs5(code: string, patchPath: string) {
  return patchWithRegex(code, patchPath, ES5_PATTERN, ES5_IIFE_END)
}

function patchEsm(code: string, patchPath: string) {
  return patchWithRegex(code, patchPath, ESM_PATTERN)
}

function patchTs(code: string, patchPath: string) {
  return patchWithRegex(code, patchPath, TS_PATTERN)
}

/**
 * Patch an ES5 operator file to wrap the main export with decorateOperatorFun.
 */
function patchOperator(code: string, patchPath: string, operatorName: string) {
  const pattern = new RegExp(`export function (${operatorName})\\(`)
  const match = code.match(pattern)

  if (!match) {
    return null
  }

  let patched = code.replace(new RegExp(`export function ${operatorName}\\(`), `function __${operatorName}__(`)
  patched = patched.replace(new RegExp(`= ${operatorName}([;)])`, "g"), `= __${operatorName}__$1`)

  const result =
    IMPORT_DECORATE_OP(patchPath) +
    patched +
    `\nexport var ${operatorName} = __decorateOp__(__${operatorName}__, "${operatorName}", ${JSON.stringify({ tags: operatorName.startsWith("inner") ? ["rxjs", "internal"] : ["rxjs"] })});\n`

  return { code: result, map: null }
}

/**
 * Patch an ES5 creation operator file to wrap the main export with decorateCreate.
 */
function patchCreationFn(code: string, patchPath: string, operatorName: string) {
  const pattern = new RegExp(`export function (${operatorName})\\(`)
  const match = code.match(pattern)

  if (!match) {
    return null
  }

  let patched = code.replace(new RegExp(`export function ${operatorName}\\(`), `function __${operatorName}__(`)
  patched = patched.replace(new RegExp(`= ${operatorName}([;)])`, "g"), `= __${operatorName}__$1`)

  const result =
    IMPORT_DECORATE_CREATE(patchPath) +
    patched +
    `\nexport var ${operatorName} = __decorateCreate__(__${operatorName}__, "${operatorName}", ${JSON.stringify({ tags: operatorName.startsWith("inner") ? ["rxjs", "internal"] : ["rxjs"] })});\n`

  return { code: result, map: null }
}

/**
 * Patch a TypeScript operator file.
 */
function patchOperatorTs(code: string, patchPath: string, operatorName: string) {
  const pattern = new RegExp(`export function (${operatorName})\\b([^;]*?)\\{`)
  const match = code.match(pattern)

  if (!match) {
    return null
  }

  let patched = code.replace(pattern, `function __${operatorName}__$2{`)
  patched = patched.replace(new RegExp(`= ${operatorName}([;)])`, "g"), `= __${operatorName}__$1`)

  const result =
    IMPORT_DECORATE_OP(patchPath) +
    patched +
    `\nexport const ${operatorName} = __decorateOp__(__${operatorName}__, "${operatorName}", ${JSON.stringify({ tags: operatorName.startsWith("inner") ? ["rxjs", "internal"] : ["rxjs"] })});\n`

  return { code: result, map: null }
}

/**
 * Patch a TypeScript creation operator file.
 */
function patchCreationTs(code: string, patchPath: string, operatorName: string) {
  const pattern = new RegExp(`export function (${operatorName})\\b([^;]*?)\\{`)
  const match = code.match(pattern)

  if (!match) {
    return null
  }

  let patched = code.replace(pattern, `function __${operatorName}__$2{`)
  patched = patched.replace(new RegExp(`= ${operatorName}([;)])`, "g"), `= __${operatorName}__$1`)

  const result =
    IMPORT_DECORATE_CREATE(patchPath) +
    patched +
    `\nexport const ${operatorName} = __decorateCreate__(__${operatorName}__, "${operatorName}", ${JSON.stringify({ tags: operatorName.startsWith("inner") ? ["rxjs", "internal"] : ["rxjs"] })});\n`

  return { code: result, map: null }
}

import { loadEnv } from "vite"

export function rxjsDevtoolPatchPlugin(options: RxjsDevtoolPatchOptions = {}): Plugin {
  const { debug = false, patchModulePath, patchCreation: enablePatchCreation = true } = options
  let config: VitestConfig
  let resolvedPatchModulePath: string

  const log = (...args: unknown[]) => {
    if (debug) console.log("[rxjs-devtool]", ...args)
  }
  let env: Record<string, string> = {}
  log("Plugin created with options:", options)
  let command = "serve"
  return {
    name: "rxjs-devtool-patch",
    enforce: "pre",
    config(now) {
      return {
        ...now,
        optimizeDeps: {
          ...now.optimizeDeps,
          exclude: [...(now.optimizeDeps?.exclude ?? []), "rxjs", "rxjs/operators"],
        },
      }
    },
    configResolved(resolvedConfig) {
      config = resolvedConfig
      command = resolvedConfig.command
      env = loadEnv(resolvedConfig.mode, process.cwd(), "") // Use "" as the third argument to load all variables, not just those with the VITE_ prefix
      resolvedPatchModulePath = patchModulePath ?? path.resolve(config.root, "src/tracking/v2/0_store")
      log("configResolved:", {
        command: config.command,
        isProduction: config.isProduction,
        isBrowser: config.test?.browser?.enabled,
        resolvedPatchModulePath,
      })
    },

    resolveId(source) {
      // For vitest (non-browser), redirect rxjs imports to esm5 dist files
      const isBrowser = config.test?.browser?.enabled || command === "serve"

      const isTest = config.mode === "test"
      if ((!isBrowser || isTest) && (source === "rxjs" || source.startsWith("rxjs/"))) {
        const rxjsPath = path.dirname(require.resolve("rxjs/package.json"))
        log("resolveId redirecting:", source)

        if (source === "rxjs") {
          return path.join(rxjsPath, "dist/esm5/index.js")
        }

        const subpath = source.slice("rxjs/".length)
        if (subpath === "operators") {
          return path.join(rxjsPath, "dist/esm5/operators/index.js")
        } else if (subpath.startsWith("internal/")) {
          return path.join(rxjsPath, `dist/esm5/${subpath}.js`)
        } else {
          return path.join(rxjsPath, "dist/esm5", subpath, "index.js")
        }
      }
      return null
    },

    transform(code, id) {
      const cleanId = id.split("?")[0] ?? id

      if (cleanId.includes("/rxjs/")) {
        // log("transform called for rxjs file:", cleanId)
      }

      // dist/esm5/internal/Observable.js - ES5 function style
      if (cleanId.includes("/rxjs/dist/esm5/") && cleanId.endsWith("/Observable.js")) {
        const result = patchEs5(code, resolvedPatchModulePath)
        log("patchEs5 Observable:", result ? "SUCCESS" : "FAILED")
        return result
      }

      // dist/esm/internal/Observable.js - ES2015 class style
      if (cleanId.includes("/rxjs/dist/esm/") && cleanId.endsWith("/Observable.js")) {
        const result = patchEsm(code, resolvedPatchModulePath)
        log("patchEsm Observable:", result ? "SUCCESS" : "FAILED")
        return result
      }

      // src/internal/Observable.ts - TypeScript source
      if (cleanId.includes("/rxjs/src/internal/Observable.ts")) {
        const result = patchTs(code, resolvedPatchModulePath)
        log("patchTs Observable:", result ? "SUCCESS" : "FAILED")
        return result
      }

      // Operator files
      const isEsm5Operator = cleanId.includes("/rxjs/dist/esm5/internal/operators/") && cleanId.endsWith(".js")
      const isEsmOperator = cleanId.includes("/rxjs/dist/esm/internal/operators/") && cleanId.endsWith(".js")
      if (isEsm5Operator || isEsmOperator) {
        const fileName = path.basename(cleanId, ".js")
        if (fileName === "index" || fileName === "OperatorSubscriber") {
          return null
        }
        const result = patchOperator(code, resolvedPatchModulePath, fileName)
        log("patchOperator result:", result ? "SUCCESS" : "FAILED")
        return result
      }

      // Creation functions (optional)
      if (enablePatchCreation) {
        const isEsm5Observable = cleanId.includes("/rxjs/dist/esm5/internal/observable/") && cleanId.endsWith(".js")
        const isEsmObservable = cleanId.includes("/rxjs/dist/esm/internal/observable/") && cleanId.endsWith(".js")
        if (isEsm5Observable || isEsmObservable) {
          const fileName = path.basename(cleanId, ".js")
          if (fileName === "index" || fileName === "ConnectableObservable") {
            return null
          }
          const result = patchCreationFn(code, resolvedPatchModulePath, fileName)
          log("patchCreation result:", result ? "SUCCESS" : "FAILED")
          return result
        }
      }

      // TypeScript source operators
      if (cleanId.includes("/rxjs/src/internal/operators/") && cleanId.endsWith(".ts")) {
        const fileName = path.basename(cleanId, ".ts")
        if (fileName === "index" || fileName === "OperatorSubscriber") {
          return null
        }
        const result = patchOperatorTs(code, resolvedPatchModulePath, fileName)
        log("patchOperatorTs result:", result ? "SUCCESS" : "FAILED")
        return result
      }

      // TypeScript source creation operators
      if (enablePatchCreation && cleanId.includes("/rxjs/src/internal/observable/") && cleanId.endsWith(".ts")) {
        const fileName = path.basename(cleanId, ".ts")
        if (fileName === "index" || fileName === "ConnectableObservable") {
          return null
        }
        const result = patchCreationTs(code, resolvedPatchModulePath, fileName)
        log("patchCreationTs result:", result ? "SUCCESS" : "FAILED")
        return result
      }

      return null
    },
  }
}

export default rxjsDevtoolPatchPlugin
