import type {
  AnyPath, ConflictingPropertyNames, EncodedPathText, FileLocatorSyntax, IPath,
  IPathSyntax, JoinedTemplate, PartsOf, PathMatch, PathPart, RouteMap,
  Simplify, SlashPathSyntax, DotPathSyntax, ValuesOf, ValuesWithSchema,
  PathSchema, PathValueSchema, PathValueSchemaView, PathSchemaView, JsonValueConstraint,
  ReactRouterPattern, TanStackPattern, OpenApiPattern,
  IPathFactory, PathConversion, Param, ParamMap, ValuesWithParams,
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

type SchemaConfiguration<RawValues, Schema> = {
  schema: Schema
}

type ZodLike = {
  safeParse(value: unknown): { success: boolean; data?: unknown }
  toJSONSchema?: () => unknown
}

type RuntimeSchema = {
  allowed: Record<string, string[]>
  patterns: Record<string, RegExp>
  required: string[]
  zod: Record<string, ZodLike>
  properties: Record<string, unknown>
}

type RuntimePath = {
  template: string
  syntax: IPathSyntax
  parts: PathPart[]
  configuration?: RawConfiguration<Record<string, string | undefined>, unknown>
  schema?: RuntimeSchema
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

function isZodLike(entry: unknown): entry is ZodLike {
  return typeof entry === "object" && entry !== null && typeof (entry as ZodLike).safeParse === "function"
}

/** Read the JSON Schema config once: allowed sets, patterns, required names, zod backends, view fragments. */
function describeSchema(
  schema: { properties?: Record<string, unknown>; required?: readonly string[] } | undefined,
): RuntimeSchema | undefined {
  if (!schema) return undefined
  const allowed: Record<string, string[]> = {}
  const patterns: Record<string, RegExp> = {}
  const zod: Record<string, ZodLike> = {}
  const properties: Record<string, unknown> = {}
  const required = [...(schema.required ?? [])]
  for (const [name, entry] of Object.entries(schema.properties ?? {})) {
    if (entry === undefined) continue
    if (isZodLike(entry)) {
      zod[name] = entry
      properties[name] = typeof entry.toJSONSchema === "function" ? entry.toJSONSchema() : { type: "string" }
      continue
    }
    const fragment = entry as JsonValueConstraint
    const members = fragment.const !== undefined ? [fragment.const] : fragment.enum ? [...fragment.enum] : undefined
    if (members) allowed[name] = members
    if (fragment.pattern !== undefined) patterns[name] = new RegExp(fragment.pattern)
    properties[name] = fragment
  }
  return { allowed, patterns, required, zod, properties }
}

/** The names a template makes mandatory by structure: mandatory segments, non-optional query, pointer. */
function requiredNames(template: string, syntax: IPathSyntax): string[] {
  const target = namesOf(template, syntax)
  const names: string[] = []
  for (const part of target.pathname) {
    if (part.kind === "property" || part.kind === "restProperty") names.push(part.name)
  }
  for (const entry of target.queryEntries) {
    const match = /^\{(.+?)(\?)?\}$/.exec(entry)
    if (match && !match[2]) names.push(match[1])
  }
  const pointer = target.pointer && /^\{(.+)\}$/.exec(target.pointer)
  if (pointer) names.push(pointer[1])
  return names
}

function concatenateSchema(parent?: RuntimeSchema, child?: RuntimeSchema): RuntimeSchema | undefined {
  if (!parent) return child
  if (!child) return parent
  const allowed = { ...parent.allowed }
  for (const [name, members] of Object.entries(child.allowed)) {
    allowed[name] = allowed[name] ? allowed[name].filter(value => members.includes(value)) : members
  }
  return {
    allowed,
    patterns: { ...parent.patterns, ...child.patterns },
    required: [...new Set([...parent.required, ...child.required])],
    zod: { ...parent.zod, ...child.zod },
    properties: { ...parent.properties, ...child.properties },
  }
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
    get schema() {
      const names = valueNames(runtime.template, runtime.syntax)
      const required = [...new Set([...requiredNames(runtime.template, runtime.syntax), ...(runtime.schema?.required ?? [])])]
      const properties: Record<string, PathValueSchemaView> = {}
      for (const name of names) {
        properties[name] = (runtime.schema?.properties?.[name] ?? { type: "string" }) as PathValueSchemaView
      }
      return { type: "object" as const, properties, required }
    },
    print(values: Record<string, unknown>) {
      if (runtime.schema) for (const [key, allowed] of Object.entries(runtime.schema.allowed)) {
        if (values[key] !== undefined && !allowed.includes(String(values[key]))) throw new Error(`Invalid value: ${key}`)
      }
      const rawValues = runtime.configuration ? runtime.configuration.print(values) : values
      return printPath(runtime, rawValues as Record<string, unknown>) as EncodedPathText
    },
    match(text: string) {
      const raw = rawMatch(runtime, text)
      if (!raw.matched) return raw
      const schema = runtime.schema
      const values: Record<string, unknown> = { ...raw.values }
      if (schema) {
        for (const name of schema.required) {
          if (raw.values[name] === undefined) return { matched: false, reason: "schema" }
        }
        for (const [name, allowed] of Object.entries(schema.allowed)) {
          const value = raw.values[name]
          if (value !== undefined && !allowed.includes(value)) return { matched: false, reason: "schema" }
        }
        for (const [name, pattern] of Object.entries(schema.patterns)) {
          const value = raw.values[name]
          if (value !== undefined && !pattern.test(value)) return { matched: false, reason: "schema" }
        }
        for (const [name, codec] of Object.entries(schema.zod)) {
          const value = raw.values[name]
          if (value === undefined) continue
          const parsed = codec.safeParse(value)
          if (!parsed.success) return { matched: false, reason: "schema" }
          values[name] = parsed.data
        }
      }
      if (!runtime.configuration) return { matched: true, values }
      try {
        const parsed = runtime.configuration.parse(values as Record<string, string | undefined>)
        return parsed === undefined ? { matched: false, reason: "schema" } : { matched: true, values: parsed }
      } catch (error) {
        return { matched: false, reason: "schema", error }
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
        schema: concatenateSchema(runtime.schema, child.schema),
      })
    },
    check(candidate: string) { return candidate as any },
    concatenatePath(left: string, right: string) { return `${left}.${right}` as any },
  }
  runtimePaths.set(result, runtime)
  return result
}

// Synthesize a record-level PathConversion from a per-key ParamMap. Names with
// a Param use its parse/print; names without pass through as string.
function paramsToConversion(
  params: Record<string, Param<unknown>>,
): RawConfiguration<Record<string, string | undefined>, Record<string, unknown>> {
  return {
    parse(raw) {
      const out: Record<string, unknown> = {}
      for (const key of Object.keys(raw)) {
        const param = params[key]
        const rawValue = raw[key]
        if (param && rawValue !== undefined) {
          const parsed = param.parse(rawValue)
          if (parsed === undefined) return undefined
          out[key] = parsed
        } else {
          out[key] = rawValue
        }
      }
      return out
    },
    print(values) {
      const out: Record<string, string | undefined> = {}
      for (const key of Object.keys(values)) {
        const param = params[key]
        const value = (values as Record<string, unknown>)[key]
        out[key] = param && value !== undefined
          ? param.print(value as never)
          : value === undefined ? undefined : String(value)
      }
      return out
    },
  }
}

export function path<Syntax extends IPathSyntax, Template extends string>(syntax: Syntax, template: Template): IPath<ValuesOf<Template, Syntax>, Template, Syntax>
export function path<Syntax extends IPathSyntax, Template extends string, ParsedValues>(syntax: Syntax, template: Template, configuration: RawConfiguration<ValuesOf<Template, Syntax>, ParsedValues>): IPath<ParsedValues, Template, Syntax>
export function path<Syntax extends IPathSyntax, Template extends string, const Schema extends PathSchema<ValuesOf<Template, Syntax>>>(syntax: Syntax, template: Template, configuration: SchemaConfiguration<ValuesOf<Template, Syntax>, Schema>): IPath<ValuesWithSchema<ValuesOf<Template, Syntax>, Schema>, Template, Syntax>
export function path<Syntax extends IPathSyntax, Template extends string, const Params extends ParamMap<ValuesOf<Template, Syntax>>>(syntax: Syntax, template: Template, configuration: { params: Params }): IPath<ValuesWithParams<ValuesOf<Template, Syntax>, Params>, Template, Syntax>
export function path<Values, Syntax extends IPathSyntax = SlashPathSyntax>(syntax: Syntax): IPath<Values, "", Syntax>
export function path(syntax: IPathSyntax, template = "", configuration?: unknown): IPath<any, any, any> {
  const config = configuration as { schema?: { properties?: Record<string, unknown>; required?: readonly string[] }; parse?: RawConfiguration<any, any>["parse"]; print?: RawConfiguration<any, any>["print"]; params?: Record<string, Param<unknown>> } | undefined
  const resolved = config?.parse && config.print
    ? { parse: config.parse, print: config.print }
    : config?.params ? paramsToConversion(config.params) : undefined
  return buildPath({
    template,
    syntax,
    parts: partsOf(template, syntax),
    schema: describeSchema(config?.schema),
    configuration: resolved,
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
