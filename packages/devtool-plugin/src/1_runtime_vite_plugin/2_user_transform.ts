/**
 * User Code Transform for HMR
 *
 * AST-based transform that wraps RxJS observables and subscriptions
 * with __$ and __$.sub() for HMR tracking.
 *
 * Before:
 *   import { of } from 'rxjs'
 *   const data$ = of(1, 2, 3)
 *   data$.subscribe(console.log)
 *
 * After:
 *   import { _rxjs_debugger_module_start } from "rxjs-debugger/hmr"
 *   import { of } from 'rxjs'
 *   const __$ = _rxjs_debugger_module_start(import.meta.url)
 *   const data$ = __$("data$:a1b2c3d4", () => of(1, 2, 3))
 *   __$.sub("sub:e5f6g7h8", () => data$.subscribe(console.log))
 *   __$.end()
 */

import MagicString, { SourceMap } from "magic-string"
import { type Node, ParseResult, parseSync } from "oxc-parser"

export interface UserTransformOptions {
  include?: RegExp
  exclude?: RegExp
  hmrImport?: string
}

interface TransformTarget {
  type: "observable" | "subscription" | "function"
  varName?: string
  start: number
  end: number
  node: Node
  isExport?: boolean
}

// Known RxJS creators (used to validate imports)
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

const KNOWN_SUBJECT_CLASSES = new Set(["Subject", "BehaviorSubject", "ReplaySubject", "AsyncSubject"])

// Observable base class - tracked separately from Subjects
const KNOWN_OBSERVABLE_CLASSES = new Set(["Observable"])

// Collect imports from rxjs modules
function collectRxjsImports(ast: ParseResult["program"]): {
  creators: Set<string>
  subjects: Set<string>
  observables: Set<string>
  namespaces: Set<string>
} {
  const creators = new Set<string>()
  const subjects = new Set<string>()
  const observables = new Set<string>()
  const namespaces = new Set<string>()

  for (const stmt of ast.body || []) {
    if (stmt.type === "ImportDeclaration") {
      // Track last import position (handles interleaved imports)

      const source = stmt.source?.value
      if (!source || !source.startsWith("rxjs")) continue

      for (const spec of stmt.specifiers || []) {
        if (spec.type === "ImportSpecifier") {
          // For aliased imports: import { of as createObs }
          // imported.name = "of", local.name = "createObs"
          const importedName = spec.imported?.type === "Identifier" ? spec.imported.name : ""
          const localName = spec.local?.name || importedName
          if (KNOWN_RXJS_CREATORS.has(importedName)) {
            creators.add(localName)
          }
          if (KNOWN_SUBJECT_CLASSES.has(importedName)) {
            subjects.add(localName)
          }
          if (KNOWN_OBSERVABLE_CLASSES.has(importedName)) {
            observables.add(localName)
          }
        } else if (spec.type === "ImportNamespaceSpecifier") {
          // import * as rx from 'rxjs'
          namespaces.add(spec.local?.name)
        }
      }
    }
  }

  return { creators, subjects, observables, namespaces }
}

// Structural serialization - mirrors runtime's serializeValue
// Produces keys like: of(1,2,3).map(fn).filter(fn)
function serializeAstNode(node: Node): string {
  if (!node) return "?"

  // Functions → "fn"
  if (node.type === "ArrowFunctionExpression" || node.type === "FunctionExpression") {
    return "fn"
  }

  // Identifiers - variable references
  if (node.type === "Identifier") {
    return node.name
  }

  // Literals
  if (node.type === "Literal" && typeof node.value === "number") {
    return String(node.value)
  }
  if (node.type === "Literal" && typeof node.value === "string") {
    return `"${node.value}"`
  }
  if (node.type === "Literal" && typeof node.value === "boolean") {
    return String(node.value)
  }
  if (node.type === "Literal" && node.value === null) {
    return "null"
  }

  // Array expressions
  if (node.type === "ArrayExpression") {
    const elements = (node.elements || []).map(el => el && serializeAstNode(el))
    return `[${elements.join(",")}]`
  }

  // Object expressions
  if (node.type === "ObjectExpression") {
    const props = (node.properties || [])
      .filter(p => p.type === "Property" || p.type === "SpreadElement")
      .map(p => {
        // @ts-expect-error too dynamic
        const key = p.key?.name || p.key?.value || "?"
        // @ts-expect-error too dynamic
        return `${key}:${serializeAstNode(p.value ?? "?")}`
      })
      .sort()
    return `{${props.join(",")}}`
  }

  // New expressions (new Subject(), new BehaviorSubject(0))
  if (node.type === "NewExpression") {
    // @ts-expect-error too dynamic
    const callee = node.callee?.name || node.callee?.property?.name || "?"
    const args = (node.arguments || []).map(a => serializeAstNode(a))
    return `new ${callee}(${args.join(",")})`
  }

  // Call expressions - check for pipe pattern
  if (node.type === "CallExpression") {
    // Pipe call: source$.pipe(op1, op2) → source$.op1(...).op2(...)
    // @ts-expect-error too dynamic
    if (node.callee?.type === "MemberExpression" && node.callee?.property?.name === "pipe") {
      const source = serializeAstNode(node.callee.object)
      const operators = (node.arguments || []).map(op => {
        if (op.type === "CallExpression" && op.callee?.type === "Identifier") {
          const opName = op.callee.name
          const opArgs = (op.arguments || []).map(a => serializeAstNode(a))
          return `.${opName}(${opArgs.join(",")})`
        }
        return `.?(${serializeAstNode(op)})`
      })
      return source + operators.join("")
    }

    // Member call: a$.subscribe(...) → a$.subscribe(...)
    if (node.callee?.type === "MemberExpression") {
      const obj = serializeAstNode(node.callee.object)
      // @ts-expect-error too dynamic
      const prop = node.callee.property?.name || "?"
      const args = (node.arguments || []).map(a => serializeAstNode(a))
      return `${obj}.${prop}(${args.join(",")})`
    }

    // Regular call: of(1, 2, 3)
    // @ts-expect-error too dynamic
    const callee = node.callee?.name || "?"
    const args = (node.arguments || []).map(a => serializeAstNode(a))
    return `${callee}(${args.join(",")})`
  }

  // Member expressions (for chained pipes like source$.pipe().pipe())
  if (node.type === "MemberExpression") {
    const obj = serializeAstNode(node.object)
    // @ts-expect-error too dynamic
    const prop = node.property?.name || node.property?.value || "?"
    return `${obj}.${prop}`
  }

  // Spread elements
  if (node.type === "SpreadElement") {
    return `...${serializeAstNode(node.argument)}`
  }

  // Template literals
  if (node.type === "TemplateLiteral") {
    return "`...`"
  }

  return "?"
}

function generateStructuralKey(prefix: string, node: Node): string {
  const structure = serializeAstNode(node)
  return `${prefix}:${structure}`
}

// AST detection helpers - now take imported symbols as context
function isRxjsCreatorCall(node: Node, importedCreators: Set<string>, namespaces: Set<string>): boolean {
  if (node.type !== "CallExpression") return false
  const callee = node.callee

  // Direct call: of(1)
  if (callee?.type === "Identifier" && importedCreators.has(callee.name)) {
    return true
  }

  // Namespace call: rx.of(1)
  if (
    callee?.type === "MemberExpression" &&
    callee.object?.type === "Identifier" &&
    namespaces.has(callee.object.name) &&
    callee.property?.type === "Identifier" &&
    KNOWN_RXJS_CREATORS.has(callee.property.name)
  ) {
    return true
  }

  return false
}

function isSubjectConstruction(node: Node, importedSubjects: Set<string>, _namespaces: Set<string>): boolean {
  if (node.type !== "NewExpression") return false
  const callee = node.callee

  // Direct: new Subject() / new BehaviorSubject() / new EasierBS()
  // Conservative match - if name matches known class OR was detected as subclass, wrap it
  // Over-matching is harmless, missing is not
  if (callee?.type === "Identifier" && (KNOWN_SUBJECT_CLASSES.has(callee.name) || importedSubjects.has(callee.name))) {
    return true
  }

  // Namespace/member: new rx.Subject() or new foo.CustomSubject()
  // Match any member access where property name is a known subject class
  if (
    callee?.type === "MemberExpression" &&
    callee.property?.type === "Identifier" &&
    KNOWN_SUBJECT_CLASSES.has(callee.property.name)
  ) {
    return true
  }

  return false
}

function isObservableConstruction(node: Node, importedObservables: Set<string>, _namespaces: Set<string>): boolean {
  if (node.type !== "NewExpression") return false
  const callee = node.callee

  // Direct: new Observable() / new MyObservable()
  if (
    callee?.type === "Identifier" &&
    (KNOWN_OBSERVABLE_CLASSES.has(callee.name) || importedObservables.has(callee.name))
  ) {
    return true
  }

  // Namespace/member: new rx.Observable()
  if (
    callee?.type === "MemberExpression" &&
    callee.property?.type === "Identifier" &&
    KNOWN_OBSERVABLE_CLASSES.has(callee.property.name)
  ) {
    return true
  }

  return false
}

function isPipeCall(node: Node): boolean {
  if (node.type !== "CallExpression") return false
  const callee = node.callee
  // @ts-expect-error too dynamic
  return callee?.type === "MemberExpression" && callee.property?.name === "pipe"
}

function isSubscribeCall(node: Node): boolean {
  if (node.type !== "CallExpression") return false
  const callee = node.callee
  if (callee?.type !== "MemberExpression") return false
  // @ts-expect-error too dynamic
  const prop = callee.property?.name
  return prop === "subscribe" || prop === "forEach"
}

// Expand subjects set to include user-defined subclasses
// class MySubject extends Subject {} -> MySubject added to subjects
// Handles: direct extends, renamed imports, namespace access, and transitive inheritance
function expandSubjectsWithSubclasses(
  ast: ParseResult["program"],
  subjects: Set<string>,
  namespaces: Set<string>,
): void {
  // Fixed point iteration - keep expanding until no new subjects found
  let changed = true
  while (changed) {
    changed = false
    for (const stmt of ast.body || []) {
      if (stmt.type !== "ClassDeclaration" && stmt.type !== "ClassExpression") continue
      const className = stmt.id?.name
      if (!className || subjects.has(className)) continue

      const superClass = stmt.superClass
      if (!superClass) continue

      // Direct extends: class Foo extends Subject (or renamed import)
      if (superClass.type === "Identifier" && subjects.has(superClass.name)) {
        subjects.add(className)
        changed = true
        continue
      }

      // Namespace extends: class Foo extends rx.Subject
      if (
        superClass.type === "MemberExpression" &&
        superClass.object?.type === "Identifier" &&
        namespaces.has(superClass.object.name) &&
        superClass.property?.type === "Identifier" &&
        KNOWN_SUBJECT_CLASSES.has(superClass.property.name)
      ) {
        subjects.add(className)
        changed = true
      }
    }
  }
}

// Expand observables set to include user-defined subclasses (excluding Subjects)
// class MyObservable extends Observable {} -> MyObservable added to observables
// Does NOT include Subject subclasses - those are tracked separately
function expandObservablesWithSubclasses(
  ast: ParseResult["program"],
  observables: Set<string>,
  subjects: Set<string>,
  namespaces: Set<string>,
): void {
  // Fixed point iteration - keep expanding until no new observables found
  let changed = true
  while (changed) {
    changed = false
    for (const stmt of ast.body || []) {
      if (stmt.type !== "ClassDeclaration" && stmt.type !== "ClassExpression") continue
      const className = stmt.id?.name
      if (!className || observables.has(className) || subjects.has(className)) continue

      const superClass = stmt.superClass
      if (!superClass) continue

      // Direct extends: class Foo extends Observable (or renamed import)
      if (superClass.type === "Identifier" && observables.has(superClass.name)) {
        observables.add(className)
        changed = true
        continue
      }

      // Namespace extends: class Foo extends rx.Observable
      if (
        superClass.type === "MemberExpression" &&
        superClass.object?.type === "Identifier" &&
        namespaces.has(superClass.object.name) &&
        superClass.property?.type === "Identifier" &&
        KNOWN_OBSERVABLE_CLASSES.has(superClass.property.name)
      ) {
        observables.add(className)
        changed = true
      }
    }
  }
}

function isObservableExpression(
  node: Node,
  creators: Set<string>,
  subjects: Set<string>,
  observables: Set<string>,
  namespaces: Set<string>,
): boolean {
  return (
    isRxjsCreatorCall(node, creators, namespaces) ||
    isSubjectConstruction(node, subjects, namespaces) ||
    isObservableConstruction(node, observables, namespaces) ||
    isPipeCall(node)
  )
}

// Skip rules - don't transform inside these contexts
function shouldSkip(ancestors: Node[]): boolean {
  return ancestors.some(a => {
    // Already inside __$ wrapper
    if (a.type === "CallExpression" && a.callee?.type === "Identifier" && a.callee.name.includes("__$")) {
      return true
    }
    // Inside function body (not top-level declarations)
    if (a.type === "FunctionDeclaration" || a.type === "FunctionExpression" || a.type === "ArrowFunctionExpression") {
      return true
    }
    return false
  })
}

// Walk AST with ancestor tracking
function walkAst(node: Node, visitor: (node: Node, ancestors: Node[]) => void, ancestors: Node[] = []) {
  if (!node || typeof node !== "object") return

  visitor(node, ancestors)

  const newAncestors = [...ancestors, node]

  for (const key of Object.keys(node)) {
    // @ts-expect-error too dynamic
    const child = node[key]
    if (Array.isArray(child)) {
      for (const item of child) {
        walkAst(item, visitor, newAncestors)
      }
    } else if (child && typeof child === "object" && child.type) {
      walkAst(child, visitor, newAncestors)
    }
  }
}

// Collect all transform targets in a single pass
function collectTargets(
  ast: ParseResult["program"],
  creators: Set<string>,
  subjects: Set<string>,
  observables: Set<string>,
  namespaces: Set<string>,
): TransformTarget[] {
  const targets: TransformTarget[] = []

  walkAst(ast, (node, ancestors) => {
    if (shouldSkip(ancestors)) return
    const parent = node.parent
    const isExport = parent?.type === "ExportDefaultDeclaration" || parent?.type === "ExportNamedDeclaration"
    const start = node.start
    const end = node.end

    // Observable declarations: const x$ = of(1)
    if (
      node.type === "VariableDeclarator" &&
      node.id?.type === "Identifier" &&
      node.init &&
      isObservableExpression(node.init, creators, subjects, observables, namespaces)
    ) {
      targets.push({
        type: "observable",
        varName: node.id.name,
        start: node.init.start,
        end: node.init.end,
        node: node.init,
        isExport,
      })
    }

    // Class properties: class Store { data$ = of(1) }
    if (
      node.type === "PropertyDefinition" &&
      node.key?.type === "Identifier" &&
      node.value &&
      isObservableExpression(node.value, creators, subjects, observables, namespaces)
    ) {
      targets.push({
        type: "observable",
        varName: node.key.name,
        start: node.value.start,
        end: node.value.end,
        node: node.value,
        isExport,
      })
    }

    // Subscribe calls: x$.subscribe(...)
    if (isSubscribeCall(node)) {
      targets.push({
        type: "subscription",
        start,
        end,
        node,
        isExport,
      })
    }

    // Module-level function declarations: function foo() {}
    if (node.type === "FunctionDeclaration" && node.id?.name && !node.id.name.includes("$Refresh")) {
      targets.push({
        type: "function",
        varName: node.id.name,
        start,
        end,
        node,
        isExport,
      })
    }

    // Module-level function expressions: const foo = function() {} or const foo = () => {}
    if (
      node.type === "VariableDeclarator" &&
      node.id?.type === "Identifier" &&
      node.init &&
      (node.init.type === "FunctionExpression" || node.init.type === "ArrowFunctionExpression")
    ) {
      targets.push({
        type: "function",
        varName: node.id.name,
        start: node.init.start,
        end: node.init.end,
        node: node.init,
        isExport,
      })
    }
  })

  return targets
}

// Apply transforms using MagicString (reverse order)
function applyTransforms(ms: MagicString, code: string, targets: TransformTarget[], hmrImport: string): void {
  if (targets.length === 0) return

  // Apply in reverse order to preserve positions
  const sorted = [...targets].sort((a, b) => b.start - a.start)

  // Counter for unique generated names
  let fnCounter = 0

  for (const t of sorted) {
    if (t.type === "observable") {
      const key = generateStructuralKey(t.varName!, t.node)
      ms.prependLeft(t.start, `__$(${JSON.stringify(key)}, () => `)
      ms.appendRight(t.end, `)`)
      if (t.isExport) {
        ms.prependLeft(t.start, "export ")
      }
    } else if (t.type === "subscription") {
      const key = generateStructuralKey("sub", t.node)
      ms.prependLeft(t.start, `__$.sub(${JSON.stringify(key)}, () => `)
      ms.appendRight(t.end, `)`)
      if (t.isExport) {
        ms.prependLeft(t.start, "export ")
      }
    } else if (t.type === "function") {
      const key = `fn:${t.varName}`
      if (t.node.type === "FunctionDeclaration") {
        // Preserve hoisting: create const with unique name, keep function as proxy
        // export function A() {}
        // export

        // function foo() { ... } ->
        // const __fn$0 = __$("fn:foo", function foo() { ... })
        // function foo() { return __fn$0.apply(this, arguments) }
        const implName = `__fn$${fnCounter++}`
        if (!t.node.body) continue
        ms.overwrite(
          t.node.start,
          t.node.end,
          `function ${t.varName}() { return ${implName}.apply(this, arguments) };
const ${implName} = __$.fn(${JSON.stringify(key)}, ${ms.slice(t.node.start, t.node.end).toString()});`,
        )
      } else {
        // Arrow or function expression - just wrap the expression
        ms.prependLeft(t.start, `__$.fn(${JSON.stringify(key)}, `)
        ms.appendRight(t.end, `)`)
        if (t.isExport) {
          ms.prependLeft(t.start, "export ")
        }
      }
    }
  }

  // Module wrapper - add after wraps so positions are correct
  ms.prepend(`
import { _rxjs_debugger_module_start } from "${hmrImport}";
const __$ = _rxjs_debugger_module_start(import.meta.url);
`)

  // Add __$.end() at the end of the original code (not append() which goes to final string end)
  const codeEnd = code.length
  ms.appendRight(codeEnd, `\n__$.end()\n`)

  // Inject HMR self-accept so module handles its own updates
  // trackedObservable wrappers swap inner source when module re-executes with same keys
  ms.appendRight(codeEnd, `if (import.meta.hot) {\n  import.meta.hot.accept()\n}\n`)
}

// File detection
export function shouldTransformUserCode(id: string, code?: string): boolean {
  const include = /\.[tj]sx?$/
  const exclude = /node_modules|\.d\.ts|\/0_runtime|\/0_runtime_hmr|\/1_runtime_vite_plugin/
  const cleanId = id.split("?")[0] ?? id

  if (id.includes("1_runtime_vite_plugin/") || id.includes("0_runtime/") || id.includes("0_runtime_hmr/")) {
    return false
  }

  if (code?.includes("autoTrackFile()")) {
    console.log("v2 testing include:", cleanId)
    return true
  }

  if (!include.test(cleanId)) {
    // console.log("Including:", cleanId)
    return false
  } else if (exclude.test(cleanId)) {
    // console.log("Excluding:", cleanId)
    return false
  }
  // console.log("Return:", cleanId)
  return true
}

// Main transform function
export function transformUserCode(
  code: string,
  id: string,
  options: UserTransformOptions = {},
): { code: string; map: SourceMap } | null {
  const { hmrImport = "@hafley66/rxjs-debugger/hmr" } = options
  const no = code.includes("// noRxjs()")
  if (no) return null
  const disableAutoCreateDecorate = id.match(/node_modules.*\/rxjs.*/gi)

  // Parse
  let ast: ParseResult["program"]
  try {
    const result = parseSync(id, code, { sourceType: "module" })
    if (result.errors.length > 0) return null
    ast = result.program
  } catch {
    return null
  }

  // Collect RxJS imports - only wrap symbols actually imported from rxjs
  const { creators, subjects, observables, namespaces } = collectRxjsImports(ast)

  // Expand subjects to include user-defined subclasses
  // class MySubject extends Subject {} -> new MySubject() gets wrapped
  expandSubjectsWithSubclasses(ast, subjects, namespaces)

  // Expand observables to include user-defined subclasses (excluding Subjects)
  // class MyObservable extends Observable {} -> new MyObservable() gets wrapped
  expandObservablesWithSubclasses(ast, observables, subjects, namespaces)

  // Collect targets using verified imports
  const targets = collectTargets(ast, creators, subjects, observables, namespaces).filter(
    it => it.type !== "function" || !disableAutoCreateDecorate,
  )
  if (targets.length === 0) return null

  // Apply transforms
  const ms = new MagicString(code)
  applyTransforms(ms, code, targets, hmrImport)

  console.log(id, code, ms.toString())

  return {
    code: ms.toString(),
    map: ms.generateMap({ hires: "boundary", source: id }),
  }
}

// ExportNamedDeclaration
// ExportDefaultDeclaration
