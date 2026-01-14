// vite-plugin-class-trap.ts

import MagicString from "magic-string"
import type { Plugin } from "rolldown-vite"

export function classTrackPlugin(): Plugin {
  return {
    name: "class-track",
    transform(code, id) {
      if (!id.endsWith(".ts") && !id.endsWith(".tsx")) return
      if (!code.includes("class ")) return

      const s = new MagicString(code)

      // Option A: Add decorator import + apply
      // Regex for class declarations (simple version)
      const classRegex = /^(\s*)(export\s+)?(class\s+\w+)/gm

      let hasClass = false
      let match
      while ((match = classRegex.exec(code))) {
        hasClass = true
        const [full, indent, exportKw, classDecl] = match
        s.overwrite(
          match.index,
          match.index + full.length,
          `${indent}${exportKw || ""}@trackClass\n${indent}${classDecl}`,
        )
      }

      if (hasClass) {
        s.prepend(`import { trackClass } from '@tracking/class-trap';\n`)
      }

      return { code: s.toString(), map: s.generateMap() }
    },
  }
}
