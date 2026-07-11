import { defer, from, Observable, type ObservableInput } from "rxjs"
import type { Signal as SignalType } from "./0_types.js"
import type { SignalSource } from "./2_Signal.js"
import {
  createMutation,
  createQuery,
  type Mutation,
  type Query,
  type QueryOptions,
} from "./4_Query.js"

export type Serializable =
  | null
  | boolean
  | number
  | string
  | Serializable[]
  | { [key: string]: Serializable }

export type EndpointRequest = {
  url: string
  method: string
  headers?: Record<string, string>
  body?: Serializable
}

export type EndpointResponse = {
  status: number
  headers?: Record<string, string>
  body?: Serializable
}

export type EndpointTransport = (
  request: EndpointRequest,
) => ObservableInput<EndpointResponse>

export type EndpointConfig<I, O> = {
  request: (input: I) => EndpointRequest
  decode: (response: EndpointResponse) => O
  key?: (input: I) => string
}

/**
 * Declarative request/response boundary bound only by its domain Input/Output.
 * Generated endpoints can subclass this and pass their static config to super.
 * The transport remains replaceable (window fetch, service worker, extension
 * channel, test transport) because requests and responses are serializable.
 */
export class Endpoint<I, O> {
  constructor(
    readonly config: EndpointConfig<I, O>,
    readonly transport: EndpointTransport,
  ) {}

  key(input: I): string {
    return this.config.key?.(input) ?? JSON.stringify(input)
  }

  execute(input: I): Observable<O> {
    return defer(() => from(this.transport(this.config.request(input)))).pipe(
      (source) => new Observable<O>((subscriber) => source.subscribe({
        next: (response) => {
          try {
            subscriber.next(this.config.decode(response))
          } catch (error) {
            subscriber.error(error)
          }
        },
        error: (error) => subscriber.error(error),
        complete: () => subscriber.complete(),
      })),
    )
  }

  createQuery<E = unknown>(
    input: SignalSource<I | undefined>,
    options?: QueryOptions,
  ): Query<I, O, E> {
    return createQuery<I, O, E>(this, input, options)
  }

  createMutation<E = unknown>(
    input?: SignalSource<I | undefined>,
  ): Mutation<I, O, E> {
    return createMutation<I, O, E>(this, input)
  }
}
