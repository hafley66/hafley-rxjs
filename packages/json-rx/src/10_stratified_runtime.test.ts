import { lastValueFrom, of, toArray } from "rxjs"
import { describe, expect, it } from "vitest"
import { compile, type Program, settle, type Tick } from "./10_stratified_runtime"

type Route = { path: "/lobby" } | { path: "/match/{match}/round/{round}"; match: number; round: number }

type State = { route: Route; score: number }
type Event = { type: "navigate"; route: Route } | { type: "hit"; damage: number } | { type: "award"; points: number }
type PureEffect = { type: "damage-scored"; damage: number }
type ExternalEffect = { type: "sound"; name: "hit" }

const program: Program<State, Event, PureEffect, ExternalEffect> = {
  initial: { route: { path: "/lobby" }, score: 0 },
  maxEventsPerTick: 16,
  reduce: (state, event) => {
    if (event.type === "navigate") return { state: { ...state, route: event.route } }
    if (event.type === "award") return { state: { ...state, score: state.score + event.points } }
    return {
      state,
      pure: [{ type: "damage-scored", damage: event.damage }],
      external: [{ type: "sound", name: "hit" }],
    }
  },
  expand: (_state, effect) => [{ type: "award", points: effect.damage }],
}

const inputs: readonly Tick<Event>[] = [
  {
    tick: 0,
    events: [
      {
        type: "navigate",
        route: { path: "/match/{match}/round/{round}", match: 7, round: 1 },
      },
    ],
  },
  { tick: 1, events: [{ type: "hit", damage: 12 }] },
]

describe("stratified runtime", () => {
  it("reduces, expands pure effects to a fixed point, then commits", () => {
    const frame = settle(program, { tick: 0, state: program.initial }, inputs[1])

    expect(frame).toMatchInlineSnapshot(`
      {
        "pendingExternal": [
          {
            "name": "hit",
            "type": "sound",
          },
        ],
        "state": {
          "route": {
            "path": "/lobby",
          },
          "score": 12,
        },
        "tick": 1,
        "trace": [
          {
            "event": {
              "damage": 12,
              "type": "hit",
            },
            "ordinal": 0,
            "phase": "reduce",
          },
          {
            "effect": {
              "damage": 12,
              "type": "damage-scored",
            },
            "ordinal": 0,
            "phase": "expand",
            "produced": 1,
          },
          {
            "event": {
              "points": 12,
              "type": "award",
            },
            "ordinal": 1,
            "phase": "reduce",
          },
        ],
      }
    `)
  })

  it("replays one cold input timeline identically", async () => {
    const run = () => lastValueFrom(of(...inputs).pipe(compile(program), toArray()))
    expect(await run()).toEqual(await run())
  })

  it("keeps the unary route value inside rollback state", async () => {
    const frames = await lastValueFrom(of(...inputs).pipe(compile(program), toArray()))
    expect(frames.at(-1)?.state).toMatchInlineSnapshot(`
      {
        "route": {
          "match": 7,
          "path": "/match/{match}/round/{round}",
          "round": 1,
        },
        "score": 12,
      }
    `)
  })

  it("rejects an unbounded pure expansion", () => {
    const looping: Program<number, "again", "again", never> = {
      initial: 0,
      maxEventsPerTick: 3,
      reduce: state => ({ state: state + 1, pure: ["again"] }),
      expand: () => ["again"],
    }

    expect(() => settle(looping, { tick: -1, state: 0 }, { tick: 0, events: ["again"] as const })).toThrowError(
      "Tick 0 exceeded 3 events",
    )
  })
})
