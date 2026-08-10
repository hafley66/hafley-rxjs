import { generatePath, matchPath } from "react-router-5"
import type { Equal, Expect } from "./0_typeAssertions"

const inferredMatch = matchPath("/users/42", {
  path: "/users/:userIdentifier",
  exact: true,
})

type InferredParameters = NonNullable<typeof inferredMatch>["params"]
type InferredParametersOracle = Expect<Equal<InferredParameters, {}>>

const manuallyTypedMatch = matchPath<{ userIdentifier: string }>("/users/42", {
  path: "/users/:userIdentifier",
  exact: true,
})

type ManuallyTypedParameters =
  NonNullable<typeof manuallyTypedMatch>["params"]
type ManuallyTypedParametersOracle = Expect<
  Equal<ManuallyTypedParameters, { userIdentifier: string }>
>

generatePath("/users/:userIdentifier", {
  userIdentifier: "42",
  // @ts-expect-error undeclared path parameter is rejected
  additionalValue: "anything",
})

export type ReactRouter5Oracle =
  | InferredParametersOracle
  | ManuallyTypedParametersOracle
