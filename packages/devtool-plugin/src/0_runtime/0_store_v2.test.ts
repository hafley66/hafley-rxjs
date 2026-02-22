import { expect, test } from "vitest"
import { Tracer } from "./0_store_v2"

// noRxjs
class Hey<T> {
  subscribe(props: { next: (somethin: T) => void }) {
    props.next(1)
    props.next(2)
  }
  pipe(...fns: Function[]) {
    return fns.reduce((prev: any, fn: Function) => {
      return fn(prev)
    }, this as any)
  }
}

const A = (lol: any) => {
  return (loll: any) => {
    return 5
  }
}

test("Tracer", () => {
  const hi = new Tracer()
  const Heyy = hi.decoratoPatronus(Hey)
  const AA = hi.decoratoPatronus(A)
  const ok = new Heyy()
  expect(hi.state$.value).toMatchInlineSnapshot(`
    {
      "arg": {},
      "call": {
        "Hey#0": {
          "fun_id": "Hey",
          "id": "Hey#0",
          "index": 0,
          "left": 2,
          "right": 3,
        },
      },
      "fun": {
        "A": {
          "id": "A",
          "left": 1,
          "name": "A",
          "path": "A",
          "ref": WeakRef {},
        },
        "Hey": {
          "id": "Hey",
          "left": 0,
          "name": "Hey",
          "path": "Hey",
          "ref": WeakRef {},
        },
      },
      "obs": {},
    }
  `)
  const w = AA("jackpot")
  w("any")
  expect(hi.state$.value).toMatchInlineSnapshot(`
    {
      "arg": {
        "A#0/0": {
          "call_id": "A#0",
          "id": "A#0/0",
          "value": "jackpot",
        },
        "A#0/return": {
          "call_id": "A#0",
          "fun_id": "A#0/return/",
          "id": "A#0/return",
        },
        "A#0/return/#0/0": {
          "call_id": "A#0/return/#0",
          "id": "A#0/return/#0/0",
          "value": "any",
        },
        "A#0/return/#0/return": {
          "call_id": "A#0/return/#0",
          "id": "A#0/return/#0/return",
          "value": 5,
        },
      },
      "call": {
        "A#0": {
          "fun_id": "A",
          "id": "A#0",
          "index": 0,
          "left": 4,
          "right": 5,
        },
        "A#0/return/#0": {
          "fun_id": "A#0/return/",
          "id": "A#0/return/#0",
          "index": 0,
          "left": 7,
          "right": 8,
        },
        "Hey#0": {
          "fun_id": "Hey",
          "id": "Hey#0",
          "index": 0,
          "left": 2,
          "right": 3,
        },
      },
      "fun": {
        "A": {
          "id": "A",
          "left": 1,
          "name": "A",
          "path": "A",
          "ref": WeakRef {},
        },
        "A#0/return/": {
          "id": "A#0/return/",
          "left": 6,
          "name": "",
          "path": "A#0/return/",
          "ref": WeakRef {},
        },
        "Hey": {
          "id": "Hey",
          "left": 0,
          "name": "Hey",
          "path": "Hey",
          "ref": WeakRef {},
        },
      },
      "obs": {},
    }
  `)
  ok.pipe(w)
  expect(hi.state$.value).toMatchInlineSnapshot(`
    {
      "arg": {
        "A#0/0": {
          "call_id": "A#0",
          "id": "A#0/0",
          "value": "jackpot",
        },
        "A#0/return": {
          "call_id": "A#0",
          "fun_id": "A#0/return/",
          "id": "A#0/return",
        },
        "A#0/return/#0/0": {
          "call_id": "A#0/return/#0",
          "id": "A#0/return/#0/0",
          "value": "any",
        },
        "A#0/return/#0/return": {
          "call_id": "A#0/return/#0",
          "id": "A#0/return/#0/return",
          "value": 5,
        },
        "A#0/return/#1/0.pipe": {
          "call_id": "A#0/return/#1",
          "fun_id": "Hey#0/pipe",
          "id": "A#0/return/#1/0.pipe",
        },
        "A#0/return/#1/return": {
          "call_id": "A#0/return/#1",
          "id": "A#0/return/#1/return",
          "value": 5,
        },
        "Hey#0/pipe#0/0": {
          "call_id": "Hey#0/pipe#0",
          "fun_id": "A#0/return/",
          "id": "Hey#0/pipe#0/0",
        },
        "Hey#0/pipe#0/return": {
          "call_id": "Hey#0/pipe#0",
          "id": "Hey#0/pipe#0/return",
          "value": 5,
        },
      },
      "call": {
        "A#0": {
          "fun_id": "A",
          "id": "A#0",
          "index": 0,
          "left": 4,
          "right": 5,
        },
        "A#0/return/#0": {
          "fun_id": "A#0/return/",
          "id": "A#0/return/#0",
          "index": 0,
          "left": 7,
          "right": 8,
        },
        "A#0/return/#1": {
          "fun_id": "A#0/return/",
          "id": "A#0/return/#1",
          "index": 1,
          "left": 11,
          "parent_call_id": "Hey#0/pipe#0",
          "right": 12,
        },
        "Hey#0": {
          "fun_id": "Hey",
          "id": "Hey#0",
          "index": 0,
          "left": 2,
          "right": 3,
        },
        "Hey#0/pipe#0": {
          "fun_id": "Hey#0/pipe",
          "id": "Hey#0/pipe#0",
          "index": 0,
          "left": 10,
          "right": 13,
        },
      },
      "fun": {
        "A": {
          "id": "A",
          "left": 1,
          "name": "A",
          "path": "A",
          "ref": WeakRef {},
        },
        "A#0/return/": {
          "id": "A#0/return/",
          "left": 6,
          "name": "",
          "path": "A#0/return/",
          "ref": WeakRef {},
        },
        "Hey": {
          "id": "Hey",
          "left": 0,
          "name": "Hey",
          "path": "Hey",
          "ref": WeakRef {},
        },
        "Hey#0/pipe": {
          "id": "Hey#0/pipe",
          "left": 9,
          "name": "pipe",
          "path": "Hey#0/pipe",
          "ref": WeakRef {},
        },
      },
      "obs": {},
    }
  `)
})
