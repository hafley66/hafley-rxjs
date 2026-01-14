/**
 * RxJS HMR Plugin
 *
 * Composes rxjsDevtoolPatchPlugin + user code HMR transforms into a single plugin.
 * Delegates to devtool plugin for RxJS patching, adds user code wrapping on top.
 *
 * Use this plugin when you want both devtools AND hot module replacement.
 * Use rxjsDevtoolPatchPlugin directly if you only want devtools without HMR.
 */

import path from "path"
import type { Plugin, ResolvedConfig } from "rolldown-vite"
import { rxjsDevtoolPatchPlugin, type RxjsDevtoolPatchOptions } from "./0_rxjs_devtool_patch_plugin"
import { shouldTransformUserCode, transformUserCode } from "./2_user_transform"

type VitestConfig = ResolvedConfig & {
  test?: {
    browser?: {
      enabled?: boolean
    }
  }
}

interface OxcParseResult {
  program: any
  errors: any[]
}

export interface RxjsHmrPluginOptions extends RxjsDevtoolPatchOptions {
  hmrModulePath?: string
  /** Transform user code to wrap observables/subscriptions. Default: true */
  transformUserCode?: boolean
}

export function rxjsHmrPlugin(options: RxjsHmrPluginOptions = {}): Plugin {
  const {
    debug = false,
    hmrModulePath,
    transformUserCode: enableUserTransform = true,
    patchModulePath,
    patchCreation,
  } = options

  // Create devtool plugin instance to delegate to
  const devtool = rxjsDevtoolPatchPlugin({ debug, patchModulePath, patchCreation })

  let config: VitestConfig
  let resolvedHmrModulePath: string
  let parseSync: ((filename: string, code: string, options?: any) => OxcParseResult) | null = null

  const log = (...args: unknown[]) => {
    if (debug) console.log("[rxjs-hmr]", ...args)
  }

  return {
    name: "rxjs-hmr",
    enforce: "pre",

    configResolved(resolvedConfig) {
      config = resolvedConfig
      resolvedHmrModulePath = hmrModulePath ?? path.resolve(config.root, "src/tracking/v2/hmr/4_module-scope")
      // Delegate to devtool
      devtool.configResolved?.(resolvedConfig)
      log("configResolved:", { resolvedHmrModulePath })
    },

    resolveId(source, importer, resolveOptions) {
      // Delegate to devtool for rxjs resolution
      return devtool.resolveId?.call(this, source, importer, resolveOptions)
    },

    async buildStart(buildOptions) {
      // Load oxc-parser for user code transforms
      if (enableUserTransform) {
        try {
          const oxc = await import("oxc-parser")
          parseSync = oxc.parseSync
          log("oxc-parser loaded for user code transforms")
        } catch {
          console.warn("[rxjs-hmr] oxc-parser not available, user code transforms disabled")
        }
      }
    },

    transform(code, id) {
      const cleanId = id.split("?")[0] ?? id

      // First: delegate to devtool for rxjs patching
      const devtoolResult = devtool.transform?.call(this, code, id)
      if (devtoolResult) {
        return devtoolResult
      }

      // Second: user code transform for HMR wrapping
      if (enableUserTransform && parseSync && shouldTransformUserCode(cleanId)) {
        const result = transformUserCode(code, cleanId, parseSync, {
          hmrImport: resolvedHmrModulePath,
        })
        if (result) {
          log("USER CODE transformed:", cleanId)
          return result
        }
      }

      return null
    },
  }
}

export default rxjsHmrPlugin
