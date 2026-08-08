import type {
  AnyPath, ConflictingPropertyNames, EncodedPathText, FileLocatorSyntax, IPath,
  IPathSyntax, JoinedTemplate, PartsOf, PathMatch, PathPart, RouteMap,
  Simplify, SlashPathSyntax, DotPathSyntax, ValuesOf, ValuesWithAllowedSets,
  ReactRouterPattern, TanStackPattern, OpenApiPattern,
  IPathFactory, PathConversion,
} from "./0_types.js"

function pathFactory<Syntax extends IPathSyntax>(
  syntax: Syntax,
): IPathFactory<Syntax> & Syntax {
  const factory = ((template?: string, configuration?: unknown) =>
    template === undefined
      ? path(syntax)
      : path(syntax, template, configuration as never)
  ) as IPathFactory<Syntax>

  return Object.assign(factory, syntax)
}

export const slash = pathFactory<SlashPathSyntax>({
  segmentDelimiter: "/", queryDelimiter: "?", queryEntryDelimiter: "&", pointerDelimiter: "#",
})
export const dots = pathFactory<DotPathSyntax>({
  segmentDelimiter: ".", queryDelimiter: "?", queryEntryDelimiter: "&", pointerDelimiter: "#",
})
export const fileLocator = pathFactory<FileLocatorSyntax>({
  segmentDelimiter: "/", queryDelimiter: "?", queryEntryDelimiter: "&", pointerDelimiter: ":",
})

type RawConfiguration<RawValues, Values> = PathConversion<RawValues, Values>

type AllowedConfiguration<RawValues, AllowedSets> = {
  values: AllowedSets
}

type RuntimePath = {
  template: string
  syntax: IPathSyntax
  parts: PathPart[]
  configuration?: RawConfiguration<Record<string, string | undefined>, unknown>
  allowed?: Record<string, string[]>
}

const runtimePaths = new WeakMap<object, RuntimePath>()

function splitTemplate(template: string, syntax: IPathSyntax) {
  const pointerIndex = indexOfOutsideBraces(template, syntax.pointerDelimiter)
  const beforePointer = pointerIndex === -1 ? template : template.slice(0, pointerIndex)
  const pointer = pointerIndex === -1 ? undefined : template.slice(pointerIndex + syntax.pointerDelimiter.length)
  const queryIndex = indexOfOutsideBraces(beforePointer, syntax.queryDelimiter)
  const pathname = queryIndex === -1 ? beforePointer : beforePointer.slice(0, queryIndex)
  const query = queryIndex === -1 ? "" : beforePointer.slice(queryIndex + syntax.queryDelimiter.length)
  return { pathname, query, pointer }
}

function indexOfOutsideBraces(text: string, delimiter: string) {
  let depth = 0
  for (let index = 0; index <= text.length - delimiter.length; index += 1) {
    if (text[index] === "{") depth += 1
    if (text[index] === "}") depth -= 1
    if (depth === 0 && text.startsWith(delimiter, index)) return index
  }
  return -1
}

function partOf(segment: string): PathPart | undefined {
  const optional = /^\{(.+)\?\}$/.exec(segment)
  if (optional) return { kind: "optionalProperty", name: optional[1] }
  const rest = /^\{(.+)\*\}$/.exec(segment)
  if (rest) return { kind: "restProperty", name: rest[1] }
  const property = /^\{(.+)\}$/.exec(segment) ?? /^:(.+)$/.exec(segment)
  if (property) return { kind: "property", name: property[1] }
  return segment === "" ? undefined : { kind: "literal", value: segment }
}

function partsOf(template: string, syntax: IPathSyntax): PathPart[] {
  return splitTemplate(template, syntax).pathname.split(syntax.segmentDelimiter).flatMap(segment => {
    const part = partOf(segment)
    return part === undefined ? [] : [part]
  })
}

function namesOf(template: string, syntax: IPathSyntax) {
  const { query, pointer } = splitTemplate(template, syntax)
  const pathname = partsOf(template, syntax)
  const queryEntries = query === "" ? [] : query.split(syntax.queryEntryDelimiter)
  return { pathname, queryEntries, pointer }
}

function valueNames(template: string, syntax: IPathSyntax) {
  const target = namesOf(template, syntax)
  const names = target.pathname.flatMap(part =>
    part.kind === "literal" ? [] : [part.name],
  )
  for (const entry of target.queryEntries) {
    const match = /^\{(.+?)(\?)?\}$/.exec(entry)
    if (match) names.push(match[1])
  }
  const pointer = target.pointer && /^\{(.+)\}$/.exec(target.pointer)
  if (pointer) names.push(pointer[1])
  return names
}

function pickValues(values: Record<string, unknown>, names: string[]) {
  return Object.fromEntries(names.flatMap(name =>
    name in values ? [[name, values[name]]] : [],
  ))
}

function concatenateConfiguration(
  parent: RuntimePath,
  child: RuntimePath,
): RuntimePath["configuration"] {
  if (!parent.configuration && !child.configuration) return undefined
  const parentNames = valueNames(parent.template, parent.syntax)
  const childNames = valueNames(child.template, child.syntax)
  return {
    parse(rawValues) {
      const parentValues = parent.configuration
        ? parent.configuration.parse(pickValues(rawValues, parentNames) as Record<string, string | undefined>)
        : pickValues(rawValues, parentNames)
      if (parentValues === undefined) return undefined
      const childValues = child.configuration
        ? child.configuration.parse(pickValues(rawValues, childNames) as Record<string, string | undefined>)
        : pickValues(rawValues, childNames)
      if (childValues === undefined) return undefined
      return { ...parentValues as object, ...childValues as object }
    },
    print(values) {
      const parentValues = parent.configuration
        ? parent.configuration.print(values)
        : pickValues(values as Record<string, unknown>, parentNames)
      const childValues = child.configuration
        ? child.configuration.print(values)
        : pickValues(values as Record<string, unknown>, childNames)
      return {
        ...pickValues(parentValues as Record<string, unknown>, parentNames),
        ...pickValues(childValues as Record<string, unknown>, childNames),
      } as Record<string, string | undefined>
    },
  }
}

function concatenateAllowed(parent?: Record<string, string[]>, child?: Record<string, string[]>) {
  if (!parent) return child
  if (!child) return parent
  const allowed = { ...parent }
  for (const [name, values] of Object.entries(child)) {
    allowed[name] = allowed[name] ? allowed[name].filter(value => values.includes(value)) : values
  }
  return allowed
}

function rawMatch(path: RuntimePath, text: string): PathMatch<Record<string, string | undefined>> {
  const { pathname, query, pointer } = splitTemplate(text, path.syntax)
  const target = namesOf(path.template, path.syntax)
  const actual = pathname.split(path.syntax.segmentDelimiter).filter(Boolean)
  const parts = target.pathname
  const values: Record<string, string | undefined> = {}
  let cursor = 0
  for (const part of parts) {
    if (part.kind === "literal") {
      if (actual[cursor] !== part.value) return { matched: false, reason: "structure" }
      cursor += 1
    } else if (part.kind === "optionalProperty") {
      if (actual[cursor] !== undefined) values[part.name] = decodeURIComponent(actual[cursor++])
    } else if (part.kind === "restProperty") {
      values[part.name] = actual.slice(cursor).map(decodeURIComponent).join(path.syntax.segmentDelimiter)
      cursor = actual.length
    } else {
      if (actual[cursor] === undefined) return { matched: false, reason: "structure" }
      values[part.name] = decodeURIComponent(actual[cursor++])
    }
  }
  if (cursor !== actual.length) return { matched: false, reason: "structure" }
  const parameters = new URLSearchParams(query)
  for (const entry of target.queryEntries) {
    const match = /^\{(.+?)(\?)?\}$/.exec(entry)
    if (!match) continue
    const value = parameters.get(match[1])
    if (value === null && !match[2]) return { matched: false, reason: "structure" }
    if (value !== null) values[match[1]] = value
  }
  if (target.pointer !== undefined) {
    const match = /^\{(.+)\}$/.exec(target.pointer)
    if (match) {
      if (pointer === undefined) return { matched: false, reason: "structure" }
      values[match[1]] = decodeURIComponent(pointer)
    } else if (pointer !== target.pointer) return { matched: false, reason: "structure" }
  }
  return { matched: true, values }
}

function printPath(path: RuntimePath, values: Record<string, unknown>): string {
  const { query, pointer } = splitTemplate(path.template, path.syntax)
  const renderedPathname = partsOf(path.template, path.syntax).map(part => {
    if (part.kind === "literal") return part.value
    const value = values[part.name]
    if (value === undefined && part.kind === "optionalProperty") return undefined
    if (value === undefined) throw new Error(`Missing path value: ${part.name}`)
    return part.kind === "restProperty"
      ? String(value).split(path.syntax.segmentDelimiter).map(encodeURIComponent).join(path.syntax.segmentDelimiter)
      : encodeURIComponent(String(value))
  }).filter((value): value is string => value !== undefined).join(path.syntax.segmentDelimiter)
  const leading = splitTemplate(path.template, path.syntax).pathname.startsWith(path.syntax.segmentDelimiter)
  const pathname = leading ? path.syntax.segmentDelimiter + renderedPathname : renderedPathname
  const entries = query === "" ? [] : query.split(path.syntax.queryEntryDelimiter).flatMap(entry => {
    const match = /^\{(.+?)(\?)?\}$/.exec(entry)
    if (!match) return [entry]
    const value = values[match[1]]
    if (value === undefined && match[2]) return []
    if (value === undefined) throw new Error(`Missing query value: ${match[1]}`)
    return `${encodeURIComponent(match[1])}=${encodeURIComponent(String(value))}`
  })
  const renderedPointer = pointer === undefined ? "" : (() => {
    const match = /^\{(.+)\}$/.exec(pointer)
    if (!match) return path.syntax.pointerDelimiter + pointer
    const value = values[match[1]]
    if (value === undefined) throw new Error(`Missing pointer value: ${match[1]}`)
    return path.syntax.pointerDelimiter + encodeURIComponent(String(value))
  })()
  return pathname + (entries.length ? path.syntax.queryDelimiter + entries.join(path.syntax.queryEntryDelimiter) : "") + renderedPointer
}

function buildPath(runtime: RuntimePath): IPath<any, any, any> {
  const result: IPath<any, any, any> = {
    template: runtime.template,
    syntax: runtime.syntax,
    parts: runtime.parts as any,
    print(values: Record<string, unknown>) {
      if (runtime.allowed) for (const [key, allowed] of Object.entries(runtime.allowed)) {
        if (values[key] !== undefined && !allowed.includes(String(values[key]))) throw new Error(`Invalid value: ${key}`)
      }
      const rawValues = runtime.configuration ? runtime.configuration.print(values) : values
      return printPath(runtime, rawValues as Record<string, unknown>) as EncodedPathText
    },
    match(text: string) {
      const raw = rawMatch(runtime, text)
      if (!raw.matched) return raw
      if (runtime.allowed) for (const [key, allowed] of Object.entries(runtime.allowed)) {
        const value = raw.values[key]
        if (value !== undefined && !allowed.includes(value)) return { matched: false, reason: "values" }
      }
      if (!runtime.configuration) return raw
      try {
        const parsed = runtime.configuration.parse(raw.values)
        return parsed === undefined ? { matched: false, reason: "values" } : { matched: true, values: parsed }
      } catch (error) {
        return { matched: false, reason: "values", error }
      }
    },
    concatenate(other: IPath<any, any, any>) {
      const child = runtimePaths.get(other)
      if (!child) throw new Error("Cannot concatenate a path from a different runtime")
      const parentTemplate = runtime.template
      const childTemplate = child.template
      const parentQueryIndex = indexOfOutsideBraces(parentTemplate, runtime.syntax.queryDelimiter)
      const childQueryIndex = indexOfOutsideBraces(childTemplate, runtime.syntax.queryDelimiter)
      const template = parentQueryIndex === -1 ? parentTemplate + childTemplate
        : childQueryIndex === -1 ? parentTemplate.slice(0, parentQueryIndex) + childTemplate + parentTemplate.slice(parentQueryIndex)
        : parentTemplate.slice(0, parentQueryIndex) + childTemplate.slice(0, childQueryIndex) + runtime.syntax.queryDelimiter + parentTemplate.slice(parentQueryIndex + 1) + runtime.syntax.queryEntryDelimiter + childTemplate.slice(childQueryIndex + 1)
      return buildPath({
        template,
        syntax: runtime.syntax,
        parts: partsOf(template, runtime.syntax),
        configuration: concatenateConfiguration(runtime, child),
        allowed: concatenateAllowed(runtime.allowed, child.allowed),
      })
    },
    check(candidate: string) { return candidate as any },
    concatenatePath(left: string, right: string) { return `${left}.${right}` as any },
  }
  runtimePaths.set(result, runtime)
  return result
}

export function path<Syntax extends IPathSyntax, Template extends string>(syntax: Syntax, template: Template): IPath<ValuesOf<Template, Syntax>, Template, Syntax>
export function path<Syntax extends IPathSyntax, Template extends string, ParsedValues>(syntax: Syntax, template: Template, configuration: RawConfiguration<ValuesOf<Template, Syntax>, ParsedValues>): IPath<ParsedValues, Template, Syntax>
export function path<Syntax extends IPathSyntax, Template extends string, const AllowedSets extends { [PropertyName in keyof ValuesOf<Template, Syntax>]?: string[] }>(syntax: Syntax, template: Template, configuration: AllowedConfiguration<ValuesOf<Template, Syntax>, AllowedSets>): IPath<ValuesWithAllowedSets<ValuesOf<Template, Syntax>, AllowedSets>, Template, Syntax>
export function path<Values, Syntax extends IPathSyntax = SlashPathSyntax>(syntax: Syntax): IPath<Values, "", Syntax>
export function path(syntax: IPathSyntax, template = "", configuration?: unknown): IPath<any, any, any> {
  const config = configuration as { values?: Record<string, string[]>; parse?: RawConfiguration<any, any>["parse"]; print?: RawConfiguration<any, any>["print"] } | undefined
  return buildPath({
    template,
    syntax,
    parts: partsOf(template, syntax),
    allowed: config?.values,
    configuration: config?.parse && config.print ? { parse: config.parse, print: config.print } : undefined,
  })
}

export function routeMap<const Paths extends AnyPath[]>(...paths: Paths): RouteMap<Paths> {
  return Object.fromEntries(paths.map(path => [path.template, path])) as RouteMap<Paths>
}

export function toReactRouterPattern<Values, Template extends string, Syntax extends IPathSyntax>(path: IPath<Values, Template, Syntax>): ReactRouterPattern<Template> {
  const regions = splitTemplate(path.template, path.syntax)
  if (regions.query !== "" || regions.pointer !== undefined) throw new Error("React Router patterns do not encode query or pointer values")
  return path.template.replace(/\{([^}?*]+)\?\}/g, ":$1?").replace(/\{([^}?*]+)\*\}/g, "*").replace(/\{([^}?*]+)\}/g, ":$1") as ReactRouterPattern<Template>
}

export function toTanStackPattern<Values, Template extends string, Syntax extends IPathSyntax>(path: IPath<Values, Template, Syntax>): TanStackPattern<Template> {
  const regions = splitTemplate(path.template, path.syntax)
  if (regions.query !== "" || regions.pointer !== undefined) throw new Error("TanStack patterns do not encode query or pointer values")
  return path.template
    .replace(/\{([^}?*]+)\?\}/g, (_match, name: string) => `{-$${name}}`)
    .replace(/\{([^}?*]+)\*\}/g, () => "$")
    .replace(/\{([^}?*$-]+)\}/g, (_match, name: string) => `$${name}`) as TanStackPattern<Template>
}

export function toOpenApiPattern<Values, Template extends string, Syntax extends IPathSyntax>(path: IPath<Values, Template, Syntax>): OpenApiPattern<Template> {
  const regions = splitTemplate(path.template, path.syntax)
  if (regions.query !== "" || regions.pointer !== undefined || /\{[^}]*[?*]\}/.test(path.template)) throw new Error("OpenAPI path templates do not represent query, pointer, optional, or rest values")
  return path.template.replace(/:([^/]+)/g, "{$1}") as OpenApiPattern<Template>
}
