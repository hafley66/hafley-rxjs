import { matchPath } from "react-router-4"
import type { match } from "react-router-4"
import type { Equal, Expect } from "./0_typeAssertions"

const inferredMatch = matchPath("/users/42", {
  path: "/users/:userIdentifier",
  exact: true,
})

type InferredParameters = NonNullable<typeof inferredMatch>["params"]
type InferredParametersOracle = Expect<Equal<keyof InferredParameters, never>>

const manuallyTypedMatch = matchPath<{ userIdentifier: string }>("/users/42", {
  path: "/users/:userIdentifier",
  exact: true,
})

type ManuallyTypedParameters =
  NonNullable<typeof manuallyTypedMatch>["params"]
type ManuallyTypedParametersOracle = Expect<
  Equal<ManuallyTypedParameters, { userIdentifier: string }>
>

declare const routeMatch: match<{ userIdentifier: string }>

routeMatch.params.userIdentifier satisfies string

export type ReactRouter4Oracle =
  | InferredParametersOracle
  | ManuallyTypedParametersOracle
