import { generatePath, matchPath } from "react-router-6"
import type { Equal, Expect } from "./0_typeAssertions"

const match = matchPath("/users/:userIdentifier", "/users/42")

type InferredParameters = NonNullable<typeof match>["params"]
type InferredParametersOracle = Expect<
  Equal<
    InferredParameters,
    { readonly userIdentifier: string | undefined }
  >
>

generatePath("/users/:userIdentifier", {
  userIdentifier: "42",
})

// @ts-expect-error required path parameter is absent
generatePath("/users/:userIdentifier", {})

generatePath("/users/:userIdentifier", {
  userIdentifier: "42",
  // @ts-expect-error undeclared path parameter is rejected
  additionalValue: "anything",
})

const optionalMatch = matchPath(
  "/users/:userIdentifier?",
  "/users",
)

type OptionalParameters = NonNullable<typeof optionalMatch>["params"]
type OptionalParametersOracle = Expect<
  Equal<
    OptionalParameters,
    { readonly userIdentifier: string | undefined }
  >
>

const splatMatch = matchPath("/files/*", "/files/a/b")

type SplatParameters = NonNullable<typeof splatMatch>["params"]
type SplatParametersOracle = Expect<
  Equal<SplatParameters, { readonly "*": string | undefined }>
>

export type ReactRouter6Oracle =
  | InferredParametersOracle
  | OptionalParametersOracle
  | SplatParametersOracle
