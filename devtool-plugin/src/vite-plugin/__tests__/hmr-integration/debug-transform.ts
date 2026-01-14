import fs from "fs"
import { parseSync } from "oxc-parser"
import path from "path"
import { transformUserCode } from "../../2_user_transform"

const fixturePath = path.join(import.meta.dirname, "fixture/main.ts")
const code = fs.readFileSync(fixturePath, "utf-8")

console.log("=== Fixture content preview ===")
console.log(code.slice(0, 500))

console.log("\n=== Checking imports ===")
const result = parseSync(fixturePath, code, { sourceType: "module" })
console.log("Parse errors:", result.errors.length)

for (const stmt of result.program.body || []) {
  if (stmt.type === "ImportDeclaration") {
    console.log("Import from:", stmt.source?.value)
    for (const spec of (stmt as any).specifiers || []) {
      console.log("  -", spec.imported?.name || spec.local?.name)
    }
  }
}

console.log("\n=== Looking for patterns ===")
function walk(node: any, cb: (node: any) => void) {
  if (!node || typeof node !== "object") return
  cb(node)
  for (const key of Object.keys(node)) {
    const child = node[key]
    if (Array.isArray(child)) {
      for (const item of child) walk(item, cb)
    } else if (child && typeof child === "object" && child.type) {
      walk(child, cb)
    }
  }
}

walk(result.program, node => {
  if (node.type === "NewExpression") {
    console.log("NewExpression:", node.callee?.name)
  }
  if (
    node.type === "CallExpression" &&
    node.callee?.type === "MemberExpression" &&
    node.callee?.property?.name === "pipe"
  ) {
    console.log("Pipe call on:", node.callee?.object?.name)
  }
  if (node.type === "VariableDeclarator" && node.init) {
    console.log("VarDeclarator:", node.id?.name, "- init:", node.init?.type)
  }
})

console.log("\n=== Simulating collectRxjsImports ===")
const KNOWN_SUBJECT_CLASSES = new Set(["Subject", "BehaviorSubject", "ReplaySubject", "AsyncSubject"])
const KNOWN_RXJS_CREATORS = new Set([
  "of",
  "from",
  "interval",
  "timer",
  "defer",
  "range",
  "fromEvent",
  "fromEventPattern",
  "ajax",
  "fromFetch",
  "combineLatest",
  "merge",
  "forkJoin",
  "zip",
  "race",
  "concat",
])

const creators = new Set<string>()
const subjects = new Set<string>()
const namespaces = new Set<string>()

for (const stmt of result.program.body || []) {
  if (stmt.type === "ImportDeclaration") {
    const source = stmt.source?.value
    console.log("Processing import:", source, "startsWith rxjs?", source?.startsWith("rxjs"))
    if (!source || !source.startsWith("rxjs")) continue

    for (const spec of (stmt as any).specifiers || []) {
      if (spec.type === "ImportSpecifier") {
        const importedName = spec.imported?.name
        const localName = spec.local?.name || importedName
        console.log("  Specifier:", importedName, "->", localName)
        if (KNOWN_RXJS_CREATORS.has(importedName)) {
          creators.add(localName)
          console.log("    -> Added to creators")
        }
        if (KNOWN_SUBJECT_CLASSES.has(importedName)) {
          subjects.add(localName)
          console.log("    -> Added to subjects")
        }
      }
    }
  }
}

console.log("\nCreators:", [...creators])
console.log("Subjects:", [...subjects])
console.log("Namespaces:", [...namespaces])

console.log("\n=== Checking isSubjectConstruction ===")
walk(result.program, node => {
  if (node.type === "NewExpression") {
    const callee = node.callee
    const isSubject =
      callee?.type === "Identifier" && subjects.has(callee.name)
    console.log("NewExpression callee:", callee?.name, "isSubject?", isSubject)
  }
})

console.log("\n=== Running transform ===")
const transformed = transformUserCode(code, fixturePath, parseSync, {
  hmrImport: "@test/hmr",
})

if (transformed) {
  console.log("Transform SUCCESS")
  console.log(transformed.code)
} else {
  console.log("Transform returned null - no targets found or not RxJS code")
}
