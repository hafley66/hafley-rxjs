// @vitest-environment jsdom

import { Observable, Subject } from "rxjs"
import { afterEach, describe, expect, it, vi } from "vitest"
import { trackSubscription } from "../../../vitest.setup"
import { Endpoint, type EndpointResponse } from "./3_Endpoint"

type UserInput = { id: string }
type User = { id: string }

const response = (body: User): EndpointResponse => ({ status: 200, body })

describe("createQuery default visibility pause", () => {
  afterEach(() => vi.useRealTimers())

  it("pauses polling while the document is hidden", () => {
    vi.useFakeTimers()
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    })
    const requests: Array<Subject<EndpointResponse>> = []
    const endpoint = new Endpoint<UserInput, User>({
      key: (input) => input.id,
      request: (input) => ({ url: `/users/${input.id}`, method: "GET", body: input }),
      decode: (raw) => raw.body as User,
    }, () => new Observable<EndpointResponse>((subscriber) => {
      const response$ = new Subject<EndpointResponse>()
      requests.push(response$)
      const subscription = response$.subscribe(subscriber)
      return () => subscription.unsubscribe()
    }))
    const query = endpoint.createQuery({ id: "1" }, { refetchInterval: 1000 })

    trackSubscription(query.$.subscribe())
    requests[0].next(response({ id: "1" }))
    requests[0].complete()
    Object.defineProperty(document, "visibilityState", { value: "hidden" })
    document.dispatchEvent(new Event("visibilitychange"))

    vi.advanceTimersByTime(10_000)
    expect(requests).toHaveLength(1)
  })
})
