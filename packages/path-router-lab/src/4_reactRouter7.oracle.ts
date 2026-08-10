import { generatePath, matchPath } from "react-router-7"
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

generatePath("/users/:userIdentifier?", {
  userIdentifier: null,
})

generatePath("/files/*", {
  "*": "a/b",
})

generatePath("/users/:userIdentifier", {
  userIdentifier: "42",
  additionalValue: "anything",
})

export type ReactRouter7Oracle = InferredParametersOracle
