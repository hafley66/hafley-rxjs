import { Observable, Subject, of } from "rxjs"
import { afterEach, describe, expect, it, vi } from "vitest"
import { trackSubscription } from "../../../vitest.setup"
import { Signal } from "./2_Signal"
import { Endpoint, type EndpointResponse } from "./3_Endpoint"

type UserInput = { id: string }
type User = { id: string; profile: { name: string } }

const response = (body: User): EndpointResponse => ({ status: 200, body })

function controlledEndpoint() {
  const requests: Array<{
    input: UserInput
    response: Subject<EndpointResponse>
    cancelled: () => boolean
  }> = []

  const endpoint = new Endpoint<UserInput, User>({
    key: (input) => input.id,
    request: (input) => ({ url: `/users/${input.id}`, method: "GET", body: input }),
    decode: (raw) => raw.body as User,
  }, (request) => new Observable<EndpointResponse>((subscriber) => {
    const response$ = new Subject<EndpointResponse>()
    let cancelled = false
    const input = request.body as UserInput
    requests.push({ input, response: response$, cancelled: () => cancelled })
    const sub = response$.subscribe(subscriber)
    return () => {
      cancelled = true
      sub.unsubscribe()
    }
  }))

  return { endpoint, requests }
}

describe("Endpoint", () => {
  it("binds serializable request/response transport to Input and Output", () => {
    const seen: unknown[] = []
    const endpoint = new Endpoint<UserInput, User>({
      request: (input) => ({ url: `/users/${input.id}`, method: "GET" }),
      decode: (raw) => raw.body as User,
    }, (request) => {
      seen.push(request)
      return of(response({ id: "1", profile: { name: "Chris" } }))
    })

    const values: User[] = []
    trackSubscription(endpoint.execute({ id: "1" }).subscribe((value) => values.push(value)))

    expect(seen).toEqual([{ url: "/users/1", method: "GET" }])
    expect(values[0].profile.name).toBe("Chris")
  })

  it("supports generated subclasses with static declarative config", () => {
    class GetUser extends Endpoint<UserInput, User> {
      static readonly config = {
        key: (input: UserInput) => input.id,
        request: (input: UserInput) => ({
          url: `/users/${input.id}`,
          method: "GET",
        }),
        decode: (raw: EndpointResponse) => raw.body as User,
      }

      constructor() {
        super(GetUser.config, () => of(response({
          id: "1",
          profile: { name: "Generated" },
        })))
      }
    }

    const endpoint = new GetUser()
    const values: User[] = []
    trackSubscription(endpoint.execute({ id: "1" }).subscribe((value) => values.push(value)))

    expect(endpoint.key({ id: "1" })).toBe("1")
    expect(values[0].profile.name).toBe("Generated")
  })
})

describe("createQuery", () => {
  it("normalizes a plain input value into the exposed input Signal", () => {
    const { endpoint, requests } = controlledEndpoint()
    const query = endpoint.createQuery({ id: "1" })

    trackSubscription(query.$.subscribe())

    expect(query.input.$()).toEqual({ id: "1" })
    expect(requests[0].input).toEqual({ id: "1" })
  })

  it("preserves an existing input Signal instead of duplicating state", () => {
    const { endpoint } = controlledEndpoint()
    const input = Signal<UserInput | undefined>({ id: "1" })
    const query = endpoint.createQuery(input)

    expect(query.input).toBe(input)
  })

  it("accepts a computed function as declarative input", () => {
    const { endpoint, requests } = controlledEndpoint()
    const id = Signal("1")
    const query = endpoint.createQuery(() => ({ id: id.$() }))

    trackSubscription(query.$.subscribe())
    expect(requests[0].input.id).toBe("1")

    id.$("2")
    expect(requests[0].cancelled()).toBe(true)
    expect(requests[1].input.id).toBe("2")
  })

  it("accepts an Observable directly as declarative input", () => {
    const { endpoint, requests } = controlledEndpoint()
    const input$ = new Subject<UserInput | undefined>()
    const query = endpoint.createQuery(input$)

    trackSubscription(query.$.subscribe())
    expect(requests).toHaveLength(0)

    input$.next({ id: "1" })
    expect(requests[0].input.id).toBe("1")
  })

  it("is itself a recursive Signal with flat ergonomic state", () => {
    const { endpoint, requests } = controlledEndpoint()
    const input = Signal<UserInput | undefined>({ id: "1" })
    const query = endpoint.createQuery(input)
    const names: Array<string | undefined> = []
    const loading: boolean[] = []

    trackSubscription(query.data.profile.name.$.subscribe((name) => names.push(name)))
    trackSubscription(query.isLoadingEmpty.$.subscribe((value) => loading.push(value)))
    requests[0].response.next(response({ id: "1", profile: { name: "Chris" } }))

    // Initialized state, query idle, and first-loading all have undefined data.
    // Scoped Signals intentionally do not dedupe unchanged values.
    expect(names).toEqual([undefined, undefined, undefined, "Chris"])
    expect(loading).toContain(true)
    expect(query.data.profile.name.$()).toBe("Chris")
    expect(query.status.$()).toBe("success")
  })

  it("globally shares one request/cache entry for endpoint + serialized input", () => {
    const { endpoint, requests } = controlledEndpoint()
    const first = endpoint.createQuery(Signal<UserInput | undefined>({ id: "1" }))
    const second = endpoint.createQuery(Signal<UserInput | undefined>({ id: "1" }))

    trackSubscription(first.$.subscribe())
    trackSubscription(second.$.subscribe())

    expect(requests).toHaveLength(1)
    requests[0].response.next(response({ id: "1", profile: { name: "Shared" } }))
    expect(first.data.profile.name.$()).toBe("Shared")
    expect(second.data.profile.name.$()).toBe("Shared")
  })

  it("switches request/response cycles and cancels the superseded input", () => {
    const { endpoint, requests } = controlledEndpoint()
    const input = Signal<UserInput | undefined>({ id: "1" })
    const query = endpoint.createQuery(input)
    const names: Array<string | undefined> = []

    trackSubscription(query.data.profile.name.$.subscribe((name) => names.push(name)))
    input.$({ id: "2" })

    expect(requests).toHaveLength(2)
    expect(requests[0].cancelled()).toBe(true)

    requests[0].response.next(response({ id: "1", profile: { name: "Stale" } }))
    requests[1].response.next(response({ id: "2", profile: { name: "Current" } }))

    expect(names).not.toContain("Stale")
    expect(query.data.profile.name.$()).toBe("Current")
  })

  it("keeps data during refetch and exposes loading versus loading-empty", () => {
    const { endpoint, requests } = controlledEndpoint()
    const query = endpoint.createQuery(
      Signal<UserInput | undefined>({ id: "1" }),
      { staleTime: Infinity },
    )

    trackSubscription(query.$.subscribe())
    expect(query.isLoading.$()).toBe(true)
    expect(query.isLoadingEmpty.$()).toBe(true)

    requests[0].response.next(response({ id: "1", profile: { name: "Old" } }))
    query.refetch()

    expect(query.data.profile.name.$()).toBe("Old")
    expect(query.isLoading.$()).toBe(true)
    expect(query.isLoadingEmpty.$()).toBe(false)

    requests[1].response.next(response({ id: "1", profile: { name: "New" } }))
    expect(query.data.profile.name.$()).toBe("New")
  })

  it("invalidates and background-refetches without dropping current data", () => {
    const { endpoint, requests } = controlledEndpoint()
    const query = endpoint.createQuery(
      Signal<UserInput | undefined>({ id: "1" }),
      { staleTime: Infinity },
    )

    trackSubscription(query.$.subscribe())
    requests[0].response.next(response({ id: "1", profile: { name: "Known" } }))
    query.invalidate()

    expect(requests).toHaveLength(2)
    expect(query.data.profile.name.$()).toBe("Known")
    expect(query.isStale.$()).toBe(true)
    expect(query.isLoading.$()).toBe(true)

    requests[1].response.next(response({ id: "1", profile: { name: "Fresh" } }))
    expect(query.data.profile.name.$()).toBe("Fresh")
    expect(query.isStale.$()).toBe(false)
  })

  it("keeps stale data when a background refetch errors", () => {
    const { endpoint, requests } = controlledEndpoint()
    const query = endpoint.createQuery(
      Signal<UserInput | undefined>({ id: "1" }),
      { staleTime: Infinity },
    )

    trackSubscription(query.$.subscribe())
    requests[0].response.next(response({ id: "1", profile: { name: "Known" } }))
    query.refetch()
    requests[1].response.error(new Error("offline"))

    expect(query.data.profile.name.$()).toBe("Known")
    expect(query.status.$()).toBe("error")
    expect(query.isError.$()).toBe(true)
    expect(query.error.$()).toBeInstanceOf(Error)
  })

  it("reuses fresh cached state without starting another request", () => {
    const { endpoint, requests } = controlledEndpoint()
    const first = endpoint.createQuery(
      Signal<UserInput | undefined>({ id: "1" }),
      { staleTime: Infinity, cacheTime: 60_000 },
    )
    const firstSub = first.$.subscribe()
    requests[0].response.next(response({ id: "1", profile: { name: "Cached" } }))
    firstSub.unsubscribe()

    const second = endpoint.createQuery(
      Signal<UserInput | undefined>({ id: "1" }),
      { staleTime: Infinity, cacheTime: 60_000 },
    )
    trackSubscription(second.$.subscribe())

    expect(requests).toHaveLength(1)
    expect(second.data.profile.name.$()).toBe("Cached")
  })

  it("forgets singleton cached knowledge after cacheTime", () => {
    vi.useFakeTimers()
    const { endpoint, requests } = controlledEndpoint()
    const first = endpoint.createQuery(
      Signal<UserInput | undefined>({ id: "1" }),
      { staleTime: Infinity, cacheTime: 10 },
    )
    const firstSub = first.$.subscribe()
    requests[0].response.next(response({ id: "1", profile: { name: "Old" } }))
    firstSub.unsubscribe()
    vi.advanceTimersByTime(10)

    const second = endpoint.createQuery(
      Signal<UserInput | undefined>({ id: "1" }),
      { staleTime: Infinity, cacheTime: 10 },
    )
    trackSubscription(second.$.subscribe())

    expect(requests).toHaveLength(2)
    expect(second.isLoadingEmpty.$()).toBe(true)
  })

  it("uses undefined input to clear declarative query state", () => {
    const { endpoint, requests } = controlledEndpoint()
    const input = Signal<UserInput | undefined>({ id: "1" })
    const query = endpoint.createQuery(input)

    trackSubscription(query.$.subscribe())
    requests[0].response.next(response({ id: "1", profile: { name: "Chris" } }))
    query.clear()

    expect(query.status.$()).toBe("idle")
    expect(query.data.$()).toBeUndefined()
  })
})

afterEach(() => vi.useRealTimers())

describe("createMutation", () => {
  it("accepts a declarative Observable input when imperative input is unnecessary", () => {
    const { endpoint, requests } = controlledEndpoint()
    const saves$ = new Subject<UserInput | undefined>()
    const mutation = endpoint.createMutation(saves$)

    trackSubscription(mutation.$.subscribe())
    saves$.next({ id: "1" })

    expect(mutation.input.$()).toEqual({ id: "1" })
    expect(requests[0].input.id).toBe("1")
  })

  it("is a recursive Signal driven imperatively by its input Signal", () => {
    const { endpoint, requests } = controlledEndpoint()
    const mutation = endpoint.createMutation()

    trackSubscription(mutation.$.subscribe())
    expect(mutation.status.$()).toBe("idle")

    mutation.input.$({ id: "1" })
    expect(mutation.isLoadingEmpty.$()).toBe(true)

    requests[0].response.next(response({ id: "1", profile: { name: "Saved" } }))
    expect(mutation.data.profile.name.$()).toBe("Saved")
  })

  it("switches rather than merging concurrent request/response cycles", () => {
    const { endpoint, requests } = controlledEndpoint()
    const mutation = endpoint.createMutation()

    trackSubscription(mutation.$.subscribe())
    mutation.input.$({ id: "1" })
    mutation.input.$({ id: "2" })

    expect(requests[0].cancelled()).toBe(true)
    requests[0].response.next(response({ id: "1", profile: { name: "Stale" } }))
    requests[1].response.next(response({ id: "2", profile: { name: "Current" } }))

    expect(mutation.data.profile.name.$()).toBe("Current")
  })

  it("clears when input becomes undefined", () => {
    const { endpoint, requests } = controlledEndpoint()
    const mutation = endpoint.createMutation()

    trackSubscription(mutation.$.subscribe())
    mutation.input.$({ id: "1" })
    requests[0].response.next(response({ id: "1", profile: { name: "Saved" } }))
    mutation.input.$(undefined)

    expect(mutation.status.$()).toBe("idle")
    expect(mutation.data.$()).toBeUndefined()
  })

  it("turns errors into flat state and accepts a later input", () => {
    const { endpoint, requests } = controlledEndpoint()
    const mutation = endpoint.createMutation()

    trackSubscription(mutation.$.subscribe())
    mutation.input.$({ id: "1" })
    requests[0].response.error(new Error("nope"))

    expect(mutation.status.$()).toBe("error")
    expect(mutation.isError.$()).toBe(true)
    expect(mutation.error.$()).toBeInstanceOf(Error)

    mutation.input.$({ id: "2" })
    requests[1].response.next(response({ id: "2", profile: { name: "Recovered" } }))

    expect(mutation.status.$()).toBe("success")
    expect(mutation.data.profile.name.$()).toBe("Recovered")
  })
})
