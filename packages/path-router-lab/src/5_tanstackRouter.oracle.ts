import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
} from "@tanstack/react-router"
import type { Equal, Expect, Extends } from "./0_typeAssertions"

type RouterContext = {
  databaseName: string
}

const rootRoute = createRootRouteWithContext<RouterContext>()()

const usersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "users",
  validateSearch: (input: Record<string, unknown>) => ({
    page: Number(input.page ?? 1),
  }),
})

const userRoute = createRoute({
  getParentRoute: () => usersRoute,
  path: "$userIdentifier",
  params: {
    parse: parameters => ({
      userIdentifier: Number(parameters.userIdentifier),
    }),
    stringify: values => ({
      userIdentifier: String(values.userIdentifier),
    }),
  },
  beforeLoad: ({ context, params, search }) => ({
    databaseName: context.databaseName,
    numericUserIdentifier: params.userIdentifier,
    page: search.page,
  }),
  loader: ({ context, params }) => ({
    databaseName: context.databaseName,
    userIdentifier: params.userIdentifier,
    numericUserIdentifier: context.numericUserIdentifier,
  }),
})

const optionalSectionRoute = createRoute({
  getParentRoute: () => userRoute,
  path: "{-$sectionName}",
})

const routeTree = rootRoute.addChildren([
  usersRoute.addChildren([
    userRoute.addChildren([
      optionalSectionRoute,
    ]),
  ]),
])

const router = createRouter({
  routeTree,
  context: {
    databaseName: "application",
  },
})

type UserFullPath = typeof userRoute.types.fullPath
type UserFullPathOracle = Expect<
  Equal<UserFullPath, "/users/$userIdentifier">
>

type UserParameters = typeof userRoute.types.allParams
type UserParametersOracle = Expect<
  Extends<UserParameters, { userIdentifier: number }>
>

type UserSearch = typeof userRoute.types.fullSearchSchema
type UserSearchOracle = Expect<
  Extends<UserSearch, { page: number }>
>

type UserContext = typeof userRoute.types.allContext

declare const userContext: UserContext
userContext.databaseName satisfies string
userContext.numericUserIdentifier satisfies number
userContext.page satisfies number

router.buildLocation({
  to: "/users/$userIdentifier/{-$sectionName}",
  params: {
    userIdentifier: 42,
    sectionName: undefined,
  },
  search: {
    page: 2,
  },
})

router.buildLocation({
  to: "/users/$userIdentifier",
  params: {},
})

router.buildLocation({
  from: "/users/$userIdentifier",
  to: ".",
  params: {
    userIdentifier: 42,
  },
  search: (previousSearch: { page: number }) => ({
    page: previousSearch.page + 1,
  }),
})

export type TanStackRouterOracle =
  | UserFullPathOracle
  | UserParametersOracle
  | UserSearchOracle
