declare const encodedPathText: unique symbol

export type EncodedPathText<Representation extends string = string> = string & {
  [encodedPathText]: Representation
}

export type Simplify<Value> = { [Key in keyof Value]: Value[Key] }

export interface IPathSyntax<
  SegmentDelimiter extends string = string,
  QueryDelimiter extends string = string,
  QueryEntryDelimiter extends string = string,
  PointerDelimiter extends string = string,
> {
  segmentDelimiter: SegmentDelimiter
  queryDelimiter: QueryDelimiter
  queryEntryDelimiter: QueryEntryDelimiter
  pointerDelimiter: PointerDelimiter
}

export type SlashPathSyntax = IPathSyntax<"/", "?", "&", "#">
export type DotPathSyntax = IPathSyntax<".", "?", "&", "#">
export type FileLocatorSyntax = IPathSyntax<"/", "?", "&", ":">

type EscapeOptionalParameterSegment<Segment extends string> =
  Segment extends `{${infer PathProperty}}?${infer NamedRegion}`
    ? PathProperty extends `${infer Name}?`
      ? `{optional:${Name}}?${NamedRegion}`
      : `{${PathProperty}}?${NamedRegion}`
    : Segment extends `{${infer Name}?}` ? `{optional:${Name}}` : Segment

type EscapeOptionalParameters<Text extends string> =
  Text extends `${infer Segment}/${infer Remaining}`
    ? `${EscapeOptionalParameterSegment<Segment>}/${EscapeOptionalParameters<Remaining>}`
    : EscapeOptionalParameterSegment<Text>

type SegmentValues<Segment extends string> =
  Segment extends `{optional:${infer Name}}` ? { [Key in Name]?: string }
    : Segment extends `{${infer Name}*}` ? { [Key in Name]: string }
    : Segment extends `{${infer Name}}` ? { [Key in Name]: string }
    : Segment extends `:${infer Name}` ? { [Key in Name]: string }
    : {}

type PathnameValues<Pathname extends string, Delimiter extends string> =
  Pathname extends `${infer Segment}${Delimiter}${infer Remaining}`
    ? SegmentValues<Segment> & PathnameValues<Remaining, Delimiter>
    : SegmentValues<Pathname>

type NamedValue<Entry extends string> =
  Entry extends `{${infer Name}?}` ? { [Key in Name]?: string }
    : Entry extends `{${infer Name}}` ? { [Key in Name]: string }
    : {}

type NamedValues<Region extends string> =
  Region extends `${infer Entry}&${infer Remaining}` ? NamedValue<Entry> & NamedValues<Remaining>
    : Region extends "" ? {}
    : NamedValue<Region>

type PointerValues<Pointer extends string> =
  Pointer extends `{${infer Name}}` ? { [Key in Name]: string } : {}

type ValuesWithoutPointer<Template extends string, Syntax extends IPathSyntax> =
  Template extends `${infer Pathname}${Syntax["queryDelimiter"]}${infer Named}`
    ? Simplify<PathnameValues<Pathname, Syntax["segmentDelimiter"]> & NamedValues<Named>>
    : Simplify<PathnameValues<Template, Syntax["segmentDelimiter"]>>

export type ValuesOf<Template extends string, Syntax extends IPathSyntax = SlashPathSyntax> =
  EscapeOptionalParameters<Template> extends infer EscapedTemplate extends string
  ? EscapedTemplate extends `${infer PathAndNamed}${Syntax["pointerDelimiter"]}${infer Pointer}`
    ? Simplify<ValuesWithoutPointer<PathAndNamed, Syntax> & PointerValues<Pointer>>
    : ValuesWithoutPointer<EscapedTemplate, Syntax>
  : never

export type ValuesWithAllowedSets<RawValues, AllowedSets> = Simplify<{
  [PropertyName in keyof RawValues]: PropertyName extends keyof AllowedSets
    ? AllowedSets[PropertyName] extends Array<infer AllowedValue> ? AllowedValue : RawValues[PropertyName]
    : RawValues[PropertyName]
}>

export type PathPart =
  | { kind: "literal"; value: string }
  | { kind: "property"; name: string }
  | { kind: "optionalProperty"; name: string }
  | { kind: "restProperty"; name: string }

type PartOfSegment<Segment extends string> =
  Segment extends `{optional:${infer Name}}` ? { kind: "optionalProperty"; name: Name }
    : Segment extends `{${infer Name}*}` ? { kind: "restProperty"; name: Name }
    : Segment extends `{${infer Name}}` ? { kind: "property"; name: Name }
    : Segment extends `:${infer Name}` ? { kind: "property"; name: Name }
    : Segment extends "" ? never
    : { kind: "literal"; value: Segment }

type PartsOfPathname<Pathname extends string, Delimiter extends string> =
  Pathname extends `${infer Segment}${Delimiter}${infer Remaining}`
    ? PartOfSegment<Segment> extends infer Part
      ? [Part] extends [never] ? PartsOfPathname<Remaining, Delimiter>
        : [Part, ...PartsOfPathname<Remaining, Delimiter>]
      : never
    : PartOfSegment<Pathname> extends infer Part
      ? [Part] extends [never] ? [] : [Part]
      : never

type PathnameOf<Template extends string, Syntax extends IPathSyntax> =
  Template extends `${infer Head}${Syntax["pointerDelimiter"]}${string}` ? PathnameOf<Head, Syntax>
    : Template extends `${infer Pathname}${Syntax["queryDelimiter"]}${string}` ? Pathname
    : Template

export type PartsOf<Template extends string, Syntax extends IPathSyntax> =
  PartsOfPathname<PathnameOf<EscapeOptionalParameters<Template>, Syntax>, Syntax["segmentDelimiter"]>

export type JoinedTemplate<Parent extends string, Child extends string> =
  Parent extends `${infer ParentPathname}?${infer ParentNamed}`
    ? Child extends `${infer ChildPathname}?${infer ChildNamed}`
      ? `${ParentPathname}${ChildPathname}?${ParentNamed}&${ChildNamed}`
      : `${ParentPathname}${Child}?${ParentNamed}`
    : `${Parent}${Child}`

type TupleIndex<Tuple extends any[]> = Exclude<keyof Tuple, keyof any[]> & string
type TuplePaths<Tuple extends any[]> = { [Index in TupleIndex<Tuple>]:
  Tuple[Index & keyof Tuple] extends object ? Index | `${Index}.${ObjectPathsOf<Tuple[Index & keyof Tuple]>}` : Index
}[TupleIndex<Tuple>]

export type ObjectPathsOf<Value> = Value extends unknown ? ObjectPathsOfBranch<Value> : never
type ObjectPathsOfBranch<Value> =
  Value extends string | number | boolean | null | undefined ? never
    : Value extends any[]
      ? number extends Value["length"]
        ? Value extends Array<infer Item> ? `${number}` | `${number}.${ObjectPathsOf<Item>}` : never
        : TuplePaths<Value>
      : { [Key in keyof Value & string]:
          NonNullable<Value[Key]> extends any[]
            ? number extends NonNullable<Value[Key]>["length"]
              ? NonNullable<Value[Key]> extends Array<infer Item>
                ? Key | `${Key}.${number}` | `${Key}.${number}.${ObjectPathsOf<Item>}` : never
              : Key | `${Key}.${TuplePaths<NonNullable<Value[Key]>>}`
            : NonNullable<Value[Key]> extends object ? Key | `${Key}.${ObjectPathsOf<NonNullable<Value[Key]>>}` : Key
        }[keyof Value & string]

export type ConflictingPropertyNames<Left, Right> = {
  [PropertyName in keyof Left & keyof Right]: [Left[PropertyName] & Right[PropertyName]] extends [never] ? PropertyName : never
}[keyof Left & keyof Right]

export type PathMatch<Values> =
  | { matched: true; values: Values }
  | { matched: false; reason: "structure" }
  | { matched: false; reason: "values"; error?: unknown }

export type MatchedValues<Path> = Path extends { match(text: string): infer Match }
  ? Extract<Match, { matched: true }> extends { values: infer Values } ? Values : never
  : never

export interface IPath<Values, Template extends string, Syntax extends IPathSyntax> {
  template: Template
  syntax: Syntax
  parts: PartsOf<Template, Syntax>
  print(values: Values): EncodedPathText<Template>
  match(text: string): PathMatch<Values>
  concatenate<OtherValues, OtherTemplate extends string>(
    other: IPath<OtherValues, OtherTemplate, Syntax> & (ConflictingPropertyNames<Values, OtherValues> extends never ? unknown : never),
  ): IPath<Simplify<Values & OtherValues>, JoinedTemplate<Template, OtherTemplate>, Syntax>
  check<Candidate extends ObjectPathsOf<Values>>(candidate: Candidate): Candidate
  concatenatePath<Left extends ObjectPathsOf<Values>, Right extends string>(
    left: Left,
    right: Right & (`${Left}.${Right}` extends ObjectPathsOf<Values> ? unknown : never),
  ): `${Left}.${Right}`
}

export type PathConversion<RawValues, Values> = {
  parse(values: RawValues): Values | undefined
  print(values: Values): RawValues
}

// Per-param value codec: the RHS. One value type <-> its string form.
// Composable: a ParamMap mounts one Param per name, yielding a typed Values.
export type Param<T> = {
  parse(raw: string): T | undefined
  print(value: T): string
}

export type ParamMap<RawValues> = { [Key in keyof RawValues]?: Param<unknown> }

// Retype ValuesOf's string slots via a ParamMap. Names without a Param stay string.
export type ValuesWithParams<RawValues, Params> = Simplify<{
  [Key in keyof RawValues]: Key extends keyof Params
    ? Params[Key] extends Param<infer Value> ? Value : RawValues[Key]
    : RawValues[Key]
}>

export type PathAllowedSets<RawValues> = {
  [PropertyName in keyof RawValues]?: string[]
}

export interface IPathFactory<Syntax extends IPathSyntax> {
  <Template extends string>(
    template: Template,
  ): IPath<ValuesOf<Template, Syntax>, Template, Syntax>

  <Template extends string, Values>(
    template: Template,
    configuration: PathConversion<ValuesOf<Template, Syntax>, Values>,
  ): IPath<Values, Template, Syntax>

  <Template extends string, const AllowedSets extends PathAllowedSets<ValuesOf<Template, Syntax>>>(
    template: Template,
    configuration: {
      values: AllowedSets
    },
  ): IPath<
    ValuesWithAllowedSets<ValuesOf<Template, Syntax>, AllowedSets>,
    Template,
    Syntax
  >

  <Template extends string, const Params extends ParamMap<ValuesOf<Template, Syntax>>>(
    template: Template,
    configuration: { params: Params },
  ): IPath<ValuesWithParams<ValuesOf<Template, Syntax>, Params>, Template, Syntax>

  <Values>(): IPath<Values, "", Syntax>
}

export type AnyPath = IPath<any, any, any>
export type RouteMap<Paths extends AnyPath[]> = { [Path in Paths[number] as Path["template"]]: Path }

type ReactRouterSegment<Segment extends string> =
  Segment extends `{${infer Name}?}` ? `:${Name}?`
    : Segment extends `{${infer Name}*}` ? "*"
    : Segment extends `{${infer Name}}` ? `:${Name}`
    : Segment

export type ReactRouterPattern<Template extends string> =
  Template extends `${infer Head}/${infer Tail}` ? `${ReactRouterSegment<Head>}/${ReactRouterPattern<Tail>}`
    : ReactRouterSegment<Template>

type TanStackSegment<Segment extends string> =
  Segment extends `{${infer Name}?}` ? `{-$${Name}}`
    : Segment extends `{${infer Name}*}` ? "$"
    : Segment extends `{${infer Name}}` ? `$${Name}`
    : Segment

export type TanStackPattern<Template extends string> =
  Template extends `${infer Head}/${infer Tail}` ? `${TanStackSegment<Head>}/${TanStackPattern<Tail>}`
    : TanStackSegment<Template>

export type OpenApiPattern<Template extends string> =
  Template extends `${infer Head}:${infer Name}/${infer Tail}` ? `${Head}{${Name}}/${OpenApiPattern<Tail>}`
    : Template extends `${infer Head}:${infer Name}` ? `${Head}{${Name}}`
    : Template
