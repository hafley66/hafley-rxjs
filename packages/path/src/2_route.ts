import * as z from "zod"
import { slash } from "./1_path.js"
import type { PathMatch, Simplify } from "./0_types.js"

type ScalarKind = "number" | "string" | "boolean"

type ScalarOf<Kind extends string> =
  Kind extends "number" ? number
  : Kind extends "boolean" ? boolean
  : string

// "{number:id}" -> { id: number }; "{id}" / "{id*}" -> { id: string }; "{id?}" -> { id?: string }
type RouteSegment<Seg extends string> =
  Seg extends `{${infer Kind}:${infer Name}}` ? { [K in Name]: ScalarOf<Kind> }
  : Seg extends `{${infer Name}?}` ? { [K in Name]?: string }
  : Seg extends `{${infer Name}*}` ? { [K in Name]: string }
  : Seg extends `{${infer Name}}` ? { [K in Name]: string }
  : {}

type BeforeQuery<T extends string> = T extends `${infer Head}?${string}` ? Head : T

type RoutePathname<P extends string> =
  P extends `${infer Seg}/${infer Rest}`
    ? Simplify<RouteSegment<Seg> & RoutePathname<Rest>>
    : Simplify<RouteSegment<P>>

export type RoutePathOutput<Path extends string> = RoutePathname<BeforeQuery<Path>>
export type RoutePathInput<Path extends string> = RoutePathOutput<Path>

export const NumberPathParam = <const Name extends string>(name: Name): `{number:${Name}}` =>
  `{number:${name}}`
export const StringPathParam = <const Name extends string>(name: Name): `{string:${Name}}` =>
  `{string:${name}}`
export const BooleanPathParam = <const Name extends string>(name: Name): `{boolean:${Name}}` =>
  `{boolean:${name}}`

export type RouteUrlOutput<Path extends string, Query> = Simplify<RoutePathOutput<Path> & Query>

export interface PulseRoute<
  Path extends string,
  FullInput,
  FullOutput,
  UrlOut,
> {
  readonly path: Path
  readonly schema: z.ZodType<FullOutput, FullInput>
  href(value: FullInput): string
  match(text: string): PathMatch<UrlOut>
}

type ScalarMap = Record<string, ScalarKind>

function normalizeTemplate(template: string): { normalized: string; kinds: ScalarMap } {
  const kinds: ScalarMap = {}
  const normalized = template.replace(/\{(number|string|boolean):([^}]+)\}/g, (_m, kind: string, name: string) => {
    kinds[name] = kind as ScalarKind
    return `{${name}}`
  })
  return { normalized, kinds }
}

function scalarSchema(kind: ScalarKind): z.ZodType {
  if (kind === "number") return z.coerce.number()
  if (kind === "boolean") {
    return z.union([z.boolean(), z.literal("true"), z.literal("false")])
      .transform((v) => typeof v === "boolean" ? v : v === "true") as z.ZodType
  }
  return z.coerce.string()
}

type RouteReturn<
  Path extends string,
  Query extends z.ZodObject<any, any>,
  Payload extends z.ZodObject<any, any>,
> = PulseRoute<
  Path,
  Simplify<RoutePathOutput<Path> & z.input<Query> & z.input<Payload>>,
  Simplify<RoutePathOutput<Path> & z.output<Query> & z.output<Payload>>,
  RouteUrlOutput<Path, z.output<Query>>
>

export function route<
  const Path extends string,
  Query extends z.ZodObject<any, any>,
  Payload extends z.ZodObject<any, any>,
>(
  pathTemplate: Path,
  query: Query,
  payload: Payload,
): RouteReturn<Path, Query, Payload> {
  const { normalized, kinds } = normalizeTemplate(pathTemplate)
  const queryKeys = Object.keys(query.shape)
  const querySuffix = queryKeys.length ? `?${queryKeys.map((k) => `{${k}?}`).join("&")}` : ""
  const ipath = slash(normalized + querySuffix)

  const paramShape: Record<string, z.ZodType> = {}
  for (const [name, kind] of Object.entries(kinds)) paramShape[name] = scalarSchema(kind)
  const pathParamSchema = z.object(paramShape)
  const urlSchema = pathParamSchema.extend(query.shape) as z.ZodObject<any, any>
  const fullSchema = urlSchema.extend(payload.shape) as z.ZodObject<any, any>

  const loose = {
    path: pathTemplate,
    schema: fullSchema,
    href(value: unknown) {
      return ipath.print(fullSchema.parse(value))
    },
    match(text: string): PathMatch<any> {
      const raw = ipath.match(text)
      if (!raw.matched) return raw
      const result = urlSchema.safeParse(raw.values)
      if (!result.success) return { matched: false, reason: "values", error: result.error }
      return { matched: true, values: result.data }
    },
  }
  return loose as unknown as RouteReturn<Path, Query, Payload>
}

