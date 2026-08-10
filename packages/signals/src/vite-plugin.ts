import type { Plugin } from "vite"

// Redirect JSX-compiled react/jsx-runtime imports to the signals runtime, which
// wraps each function component in SignalReact. Works for esbuild and plugin-react.
export function signalsJsx(): Plugin {
  return {
    name: "@hafley66/signals-jsx",
    enforce: "pre",
    transform(code, id) {
      if (!/\.[cm]?[tj]sx$/.test(id)) return null
      let out = code
      out = out.replace(/(["'])react\/jsx-dev-runtime\1/g, "$1@hafley66/signals/jsx-dev-runtime$1")
      out = out.replace(/(["'])react\/jsx-runtime\1/g, "$1@hafley66/signals/jsx-runtime$1")
      return out === code ? null : { code: out, map: null }
    },
  }
}
