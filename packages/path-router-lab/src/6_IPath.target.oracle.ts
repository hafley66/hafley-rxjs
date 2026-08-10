import {
  dots,
  fileLocator,
  path,
  routeMap,
  slash,
  toOpenApiPattern,
  toReactRouterPattern,
  toTanStackPattern,
} from "@hafley66/path"
import type { EncodedPathText, MatchedValues, SlashPathSyntax } from "@hafley66/path"
import { generatePath as generateReactRouterPath } from "react-router-6"
import type { Equal, Expect } from "./0_typeAssertions"

const userPath = slash("/users/:userIdentifier")
type UserPathSyntaxOracle = Expect<Equal<typeof userPath.syntax, SlashPathSyntax>>
type UserPathPartsOracle = Expect<Equal<typeof userPath.parts, [
  { kind: "literal"; value: "users" },
  { kind: "property"; name: "userIdentifier" },
]>>
type UserValuesOracle = Expect<Equal<MatchedValues<typeof userPath>, { userIdentifier: string }>>
const encodedUserPath = userPath.print({ userIdentifier: "42" })
encodedUserPath satisfies EncodedPathText<"/users/:userIdentifier">
// @ts-expect-error an arbitrary string has not passed through path encoding
const unencodedPath: EncodedPathText = "/users/red blue"

const dotTemplatePath = dots("users.{userIndex}.profile.displayName")
type DotTemplateValuesOracle = Expect<Equal<MatchedValues<typeof dotTemplatePath>, { userIndex: string }>>
type DotTemplatePartsOracle = Expect<Equal<typeof dotTemplatePath.parts, [
  { kind: "literal"; value: "users" },
  { kind: "property"; name: "userIndex" },
  { kind: "literal"; value: "profile" },
  { kind: "literal"; value: "displayName" },
]>>

const sourceLinePath = fileLocator("source/file.ts:{lineNumber}")
type SourceLineValuesOracle = Expect<Equal<MatchedValues<typeof sourceLinePath>, { lineNumber: string }>>
type SourceLinePartsOracle = Expect<Equal<typeof sourceLinePath.parts, [
  { kind: "literal"; value: "source" },
  { kind: "literal"; value: "file.ts" },
]>>
sourceLinePath.print({ lineNumber: "120" })

const openApiUserPath = path(slash, "/organizations/{organizationIdentifier}/users/{userIdentifier}")
type OpenApiUserValuesOracle = Expect<Equal<MatchedValues<typeof openApiUserPath>, {
  organizationIdentifier: string
  userIdentifier: string
}>>
// @ts-expect-error required OpenAPI path value is absent
openApiUserPath.print({ organizationIdentifier: "acme" })

const numericUserPath = path(slash, "/users/{userIdentifier}?{page?}", {
  parse(values) {
    values.userIdentifier satisfies string
    values.page satisfies string | undefined
    return { userIdentifier: Number(values.userIdentifier), page: Number(values.page ?? 1) }
  },
  print(values) {
    values.userIdentifier satisfies number
    return { userIdentifier: String(values.userIdentifier), page: String(values.page) }
  },
})
type NumericUserValuesOracle = Expect<Equal<MatchedValues<typeof numericUserPath>, { userIdentifier: number; page: number }>>
numericUserPath.print({ userIdentifier: 42, page: 2 })
numericUserPath.print({
  // @ts-expect-error parsed public value is numeric
  userIdentifier: "42",
  page: 2,
})

const validatedNumericUserPath = path(slash, "/validated-users/{userIdentifier}", {
  parse(values) {
    const userIdentifier = Number(values.userIdentifier)
    return Number.isInteger(userIdentifier) ? { userIdentifier } : undefined
  },
  print(values) { return { userIdentifier: String(values.userIdentifier) } },
})
declare const validatedMatch: ReturnType<typeof validatedNumericUserPath.match>
if (validatedMatch.matched) validatedMatch.values.userIdentifier satisfies number
else if (validatedMatch.reason === "values") validatedMatch.error satisfies unknown
else validatedMatch.reason satisfies "structure"

const pointerPath = path(slash, "/users/{userIdentifier}?{selectedTab?}#{selectedRow}")
type PointerValuesOracle = Expect<Equal<MatchedValues<typeof pointerPath>, {
  userIdentifier: string; selectedTab?: string; selectedRow: string
}>>
pointerPath.print({ userIdentifier: "42", selectedRow: "row3" })

const reportPath = path(slash, "/reports?{year}&{format?}")
type ReportValuesOracle = Expect<Equal<MatchedValues<typeof reportPath>, { year: string; format?: string }>>
// @ts-expect-error required query value is absent
reportPath.print({})

const localizedReportPath = path(slash, "/{locale}/reports?{format}", {
  values: { locale: ["en", "fr"], format: ["csv", "json"] },
})
type LocalizedReportValuesOracle = Expect<Equal<MatchedValues<typeof localizedReportPath>, {
  locale: "en" | "fr"; format: "csv" | "json"
}>>
localizedReportPath.print({ locale: "en", format: "csv" })
localizedReportPath.print({
  // @ts-expect-error locale is outside its configured closed set
  locale: "de", format: "csv",
})

const pagedUsersPath = path(slash, "/users?{page?}", {
  parse(values) { return { page: Number(values.page ?? 1) } },
  print(values) { return { page: String(values.page) } },
})
const numericChildUserPath = path(slash, "/{userIdentifier}", {
  parse(values) { return { userIdentifier: Number(values.userIdentifier) } },
  print(values) { return { userIdentifier: String(values.userIdentifier) } },
})
const pagedNumericUserPath = pagedUsersPath.concatenate(numericChildUserPath)
type PagedNumericUserValuesOracle = Expect<Equal<MatchedValues<typeof pagedNumericUserPath>, { page: number; userIdentifier: number }>>

const organizationUserPath = path(slash, "/organizations/{userIdentifier}")
const organizationUserDetailsPath = organizationUserPath.concatenate(path(slash, "/users/{userIdentifier}"))
type SharedUserIdentifierValuesOracle = Expect<Equal<MatchedValues<typeof organizationUserDetailsPath>, { userIdentifier: string }>>
const numericIdentifierPath = path(slash, "/numeric/{userIdentifier}", {
  parse(values) { return { userIdentifier: Number(values.userIdentifier) } },
  print(values) { return { userIdentifier: String(values.userIdentifier) } },
})
// @ts-expect-error composed property has conflicting string and number types
organizationUserPath.concatenate(numericIdentifierPath)

const optionalSectionPath = path(slash, "/users/{userIdentifier}/{sectionName?}")
type OptionalSectionValuesOracle = Expect<Equal<MatchedValues<typeof optionalSectionPath>, { userIdentifier: string; sectionName?: string }>>
const filesPath = path(slash, "/files/{remainingPath*}")
type FilesValuesOracle = Expect<Equal<MatchedValues<typeof filesPath>, { remainingPath: string }>>
const usersPath = path(slash, "/users?{selectedTab?}")
const childUserPath = path(slash, "/:userIdentifier?{expanded?}")
const composedUserPath = usersPath.concatenate(childUserPath)
type ComposedUserTemplateOracle = Expect<Equal<typeof composedUserPath.template, "/users/:userIdentifier?{selectedTab?}&{expanded?}">>
type ComposedUserValuesOracle = Expect<Equal<MatchedValues<typeof composedUserPath>, {
  selectedTab?: string; userIdentifier: string; expanded?: string
}>>

type FormValues = {
  users: { profile: { displayName: string } }[]
  coordinates: [number, { label: string }]
  settings?: { theme: string }
  destination: { kind: "user"; user: { name: string } } | { kind: "team"; team: { title: string } }
  usersByIdentifier: Record<string, { displayName: string }>
  knownUsersByIdentifier: Record<"chris" | "sam", { displayName: string }>
}
const formPaths = dots<FormValues>()
const checkedControllerName = formPaths.check("users.0.profile.displayName")
type CheckedControllerNameOracle = Expect<Equal<typeof checkedControllerName, "users.0.profile.displayName">>
const concatenatedControllerName = formPaths.concatenatePath("users.0", "profile.displayName")
type ConcatenatedControllerNameOracle = Expect<Equal<typeof concatenatedControllerName, "users.0.profile.displayName">>
formPaths.check("coordinates.0")
formPaths.check("coordinates.1.label")
formPaths.check("settings.theme")
formPaths.check("destination.user.name")
formPaths.check("destination.team.title")
formPaths.check("usersByIdentifier.chris.displayName")
formPaths.check("knownUsersByIdentifier.chris.displayName")
// @ts-expect-error finite record key
formPaths.check("knownUsersByIdentifier.alex.displayName")
// @ts-expect-error union property
formPaths.check("destination.organization.name")
// @ts-expect-error tuple index
formPaths.check("coordinates.2")
// @ts-expect-error dot syntax only
formPaths.check("users[0].profile.displayName")

const routeTable = routeMap(usersPath, childUserPath, filesPath)
type RouteMapOracle = Expect<Equal<keyof typeof routeTable, "/users?{selectedTab?}" | "/:userIdentifier?{expanded?}" | "/files/{remainingPath*}">>

const reactRouterPattern = toReactRouterPattern(optionalSectionPath)
type ReactRouterRenderOracle = Expect<Equal<typeof reactRouterPattern, "/users/:userIdentifier/:sectionName?">>
generateReactRouterPath("/users/:userIdentifier/:sectionName?", { userIdentifier: "42", sectionName: null })
const tanStackPattern = toTanStackPattern(optionalSectionPath)
type TanStackRenderOracle = Expect<Equal<typeof tanStackPattern, "/users/$userIdentifier/{-$sectionName}">>
const openApiPattern = toOpenApiPattern(openApiUserPath)
type OpenApiRenderOracle = Expect<Equal<typeof openApiPattern, "/organizations/{organizationIdentifier}/users/{userIdentifier}">>

export type IPathTargetOracle =
  | UserPathSyntaxOracle | UserPathPartsOracle | UserValuesOracle | DotTemplateValuesOracle
  | DotTemplatePartsOracle | SourceLineValuesOracle | SourceLinePartsOracle | OpenApiUserValuesOracle
  | NumericUserValuesOracle | PointerValuesOracle | ReportValuesOracle | LocalizedReportValuesOracle
  | PagedNumericUserValuesOracle | SharedUserIdentifierValuesOracle | OptionalSectionValuesOracle
  | FilesValuesOracle | ComposedUserTemplateOracle | ComposedUserValuesOracle
  | CheckedControllerNameOracle | ConcatenatedControllerNameOracle | RouteMapOracle
  | ReactRouterRenderOracle | TanStackRenderOracle | OpenApiRenderOracle
