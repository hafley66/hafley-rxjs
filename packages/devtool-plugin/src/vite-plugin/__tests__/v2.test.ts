import fs from "fs"
import MagicString from "magic-string"
import { parseSync } from "oxc-parser"
import path from "path"
import { describe, expect, it } from "vitest"

const RXJS_OBSERVABLE_PATH = path.join(
  path.dirname(require.resolve("rxjs/package.json")),
  "dist/esm/internal/Observable.js",
)

function transformObservableJs(code: string, className: string, patchModulePath: string, filename: string) {
  const ms = new MagicString(code)
  const result = parseSync(filename, code, { lang: "js" })

  ms.prepend(
    `import { patchObservable as __patchObservable__, emit as __emit__, createId as __createId__, observableIdMap as __observableIdMap__ } from "${patchModulePath}";\n`,
  )

  for (const node of result.program.body) {
    if (
      node.type === "ExportNamedDeclaration" &&
      node.declaration?.type === "ClassDeclaration" &&
      node.declaration.id?.name === className
    ) {
      const classDecl = node.declaration
      const classBody = classDecl.body

      for (const member of classBody.body) {
        if (member.type === "MethodDefinition" && member.kind === "constructor") {
          const constructorBody = member.value.body
          if (constructorBody) {
            const constructorStart = constructorBody.start + 1
            ms.appendRight(constructorStart, `\nconst __id__ = __createId__();\n`)
            const constructorEnd = constructorBody.end - 1
            ms.appendLeft(
              constructorEnd,
              `\n__observableIdMap__.set(this, __id__);\n__emit__({ type: "constructor-call-return", id: __id__, observable: this });\n`,
            )
          }
          break
        }
      }

      const classEnd = classDecl.end
      ms.appendRight(classEnd, `\n__patchObservable__(${className});\n`)
      break
    }
  }

  return {
    code: ms.toString(),
    map: ms.generateMap({ hires: true }),
  }
}

describe("v2 plugin transform", () => {
  it("transforms dist/esm Observable.js", () => {
    const code = fs.readFileSync(RXJS_OBSERVABLE_PATH, "utf-8")
    const result = transformObservableJs(code, "Observable", "./patch-module", RXJS_OBSERVABLE_PATH)

    expect(result.code).toMatchSnapshot()
  })

  it("injects patch import at top", () => {
    const code = fs.readFileSync(RXJS_OBSERVABLE_PATH, "utf-8")
    const result = transformObservableJs(code, "Observable", "./patch-module", RXJS_OBSERVABLE_PATH)

    expect(result.code).toContain("import { patchObservable as __patchObservable__")
  })

  it("injects id creation in constructor", () => {
    const code = fs.readFileSync(RXJS_OBSERVABLE_PATH, "utf-8")
    const result = transformObservableJs(code, "Observable", "./patch-module", RXJS_OBSERVABLE_PATH)

    expect(result.code).toContain("const __id__ = __createId__();")
  })

  it("injects emit at end of constructor", () => {
    const code = fs.readFileSync(RXJS_OBSERVABLE_PATH, "utf-8")
    const result = transformObservableJs(code, "Observable", "./patch-module", RXJS_OBSERVABLE_PATH)

    expect(result.code).toContain('__emit__({ type: "constructor-call-return"')
  })

  it("injects patchObservable after class", () => {
    const code = fs.readFileSync(RXJS_OBSERVABLE_PATH, "utf-8")
    const result = transformObservableJs(code, "Observable", "./patch-module", RXJS_OBSERVABLE_PATH)

    expect(result.code).toContain("__patchObservable__(Observable);")
  })
})
