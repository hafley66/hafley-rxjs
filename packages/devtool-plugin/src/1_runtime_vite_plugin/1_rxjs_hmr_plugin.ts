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
import type { Plugin, ResolvedConfig } from "vite"
import { type RxjsDevtoolPatchOptions, rxjsDevtoolPatchPlugin } from "./0_rxjs_devtool_patch_plugin"
import { shouldTransformUserCode, transformUserCode } from "./2_user_transform"

type VitestConfig = ResolvedConfig & {
  test?: {
    browser?: {
      enabled?: boolean
    }
  }
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

  const log = (...args: unknown[]) => {
    console.log("[rxjs-hmr]", ...args)
  }

  return {
    name: "rxjs-hmr",
    enforce: "pre",

    configResolved(resolvedConfig) {
      config = resolvedConfig
      resolvedHmrModulePath = hmrModulePath ?? path.resolve(config.root, "src/0_runtime_hmr/4_module-scope")
      // Delegate to devtool
      // @ts-expect-error idk
      devtool.configResolved?.call(this, resolvedConfig)
      log("configResolved:", { resolvedHmrModulePath })
    },

    resolveId(source, importer, resolveOptions) {
      // Delegate to devtool for rxjs resolution
      // @ts-expect-error idk
      return devtool.resolveId?.call(this, source, importer, resolveOptions)
    },

    transform(code, id) {
      const cleanId = id.split("?")[0] ?? id

      // First: delegate to devtool for rxjs patching
      // @ts-expect-error idk
      const devtoolResult = devtool.transform?.call(this, code, id)
      if (devtoolResult) {
        return devtoolResult
      }

      // Second: user code transform for HMR wrapping
      if (enableUserTransform && shouldTransformUserCode(cleanId, code)) {
        log("USER CODE transformed:", cleanId)
        const result = transformUserCode(code, cleanId, {
          hmrImport: resolvedHmrModulePath,
        })
        if (result) {
          return result
        }
      } else {
        log("No transform: ", cleanId)
      }

      return null
    },
  }
}

export default rxjsHmrPlugin
