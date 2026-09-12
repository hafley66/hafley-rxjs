import { lastValueFrom, of, toArray } from "rxjs"
import { describe, expect, it } from "vitest"
import { compile, program, type Transition, tick, transition } from "./10_stratified_runtime"

type Route = readonly [path: string, match: number, round: number]
type State = readonly [route: Route, score: number]
type Event = readonly [kind: "navigate", route: Route] | readonly [kind: "hit" | "award", points: number]
type PureEffect = readonly [kind: "damage-scored", damage: number]
type ExternalEffect = readonly [kind: "sound", name: "hit"]

function reduce(state: State, event: Event): Transition<State, PureEffect, ExternalEffect> {
  if (event[0] === "navigate") return transition([event[1], state[1]])
  if (event[0] === "award") return transition([state[0], state[1] + event[1]])
  return transition(state, [["damage-scored", event[1]]], [["sound", "hit"]])
}

function expandPure(_state: State, effect: PureEffect): readonly Event[] {
  return [["award", effect[1]]]
}

function game() {
  return program<State, Event, PureEffect, ExternalEffect>([["/lobby", 0, 0], 0], reduce, expandPure, 16)
}

function inputs() {
  return [tick<Event>(0, [["navigate", ["/match/{match}/round/{round}", 7, 1]]]), tick<Event>(1, [["hit", 12]])]
}

function run() {
  return lastValueFrom(of(...inputs()).pipe(compile(game()), toArray()))
}

describe("stratified runtime", () => {
  it("expands pure effects before committing the frame", async () => {
    expect(await lastValueFrom(of(...inputs()).pipe(compile(game()), toArray()))).toMatchInlineSnapshot(`
      [
        [
          0,
          [
            [
              "/match/{match}/round/{round}",
              7,
              1,
            ],
            0,
          ],
          [],
        ],
        [
          1,
          [
            [
              "/match/{match}/round/{round}",
              7,
              1,
            ],
            12,
          ],
          [
            [
              "sound",
              "hit",
            ],
          ],
        ],
      ]
    `)
  })

  it("replays one cold timeline identically", async () => {
    expect(await run()).toEqual(await run())
  })

  it("rejects an unbounded pure expansion", async () => {
    function again(state: number): Transition<number, "again", never> {
      return transition(state + 1, ["again"])
    }
    function recur(): readonly "again"[] {
      return ["again"]
    }

    await expect(
      lastValueFrom(of(tick<"again">(0, ["again"])).pipe(compile(program(0, again, recur, 3)))),
    ).rejects.toThrowError("Tick 0 exceeded 3 events")
  })
})
