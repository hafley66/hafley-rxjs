import { expect, test } from "vitest"
import { Tracer } from "./0_store_v2"

class Hey<T> {
  subscribe(props: { next: (somethin: T) => void }) {
    props.next(1)
    props.next(2)
  }
  pipe(...fns: Function[]) {
    return fns.reduce((prev: any, fn: Function) => fn(prev), this as any)
  }
}

const A = function A(lol: any) {
  return function (loll: any) {
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
      "arg": {
        "Hey/constructor/0/$": {
          "id": "Hey/constructor/0/$",
          "ref": WeakRef {},
        },
      },
      "call": {
        "Hey/constructor/0": {
          "arg_ids": [],
          "fun_id": "Hey",
          "id": "Hey/constructor/0",
          "left": 0,
          "parent_call_id": undefined,
          "return_id": "Hey/constructor/0/$",
          "right": 1,
        },
      },
      "fun": {
        "A2": {
          "call_ids": [],
          "id": "A2",
          "name": "A2",
          "ref": WeakRef {},
        },
        "Hey": {
          "call_ids": [],
          "id": "Hey",
          "name": "Hey",
          "ref": WeakRef {},
        },
      },
    }
  `)
  const w = AA("jackpot")
  w("any")
  expect(hi.state$.value).toMatchInlineSnapshot(`
    {
      "arg": {
        "A2/0/$": {
          "fun_id": "A2/0/$/",
          "id": "A2/0/$",
        },
        "A2/0/$//0/$": {
          "id": "A2/0/$//0/$",
          "value": 5,
        },
        "A2/0/$//0/0": {
          "id": "A2/0/$//0/0",
          "value": "any",
        },
        "A2/0/0": {
          "id": "A2/0/0",
          "value": "jackpot",
        },
        "Hey/constructor/0/$": {
          "id": "Hey/constructor/0/$",
          "ref": WeakRef {},
        },
      },
      "call": {
        "A2/0": {
          "arg_ids": [],
          "fun_id": "A2",
          "id": "A2/0",
          "left": 2,
          "parent_call_id": undefined,
          "return_id": "A2/0/$",
          "right": 3,
        },
        "A2/0/$//0": {
          "arg_ids": [],
          "fun_id": "A2/0/$/",
          "id": "A2/0/$//0",
          "left": 4,
          "parent_call_id": undefined,
          "return_id": "A2/0/$//0/$",
          "right": 5,
        },
        "Hey/constructor/0": {
          "arg_ids": [],
          "fun_id": "Hey",
          "id": "Hey/constructor/0",
          "left": 0,
          "parent_call_id": undefined,
          "return_id": "Hey/constructor/0/$",
          "right": 1,
        },
      },
      "fun": {
        "A2": {
          "call_ids": [],
          "id": "A2",
          "name": "A2",
          "ref": WeakRef {},
        },
        "A2/0/$/": {
          "call_ids": [],
          "id": "A2/0/$/",
          "name": "",
          "ref": WeakRef {},
        },
        "Hey": {
          "call_ids": [],
          "id": "Hey",
          "name": "Hey",
          "ref": WeakRef {},
        },
      },
    }
  `)
  ok.pipe(w)
  expect(hi.state$.value).toMatchInlineSnapshot(`
    {
      "arg": {
        "A2/0/$": {
          "fun_id": "A2/0/$/",
          "id": "A2/0/$",
        },
        "A2/0/$//0/$": {
          "id": "A2/0/$//0/$",
          "value": 5,
        },
        "A2/0/$//0/0": {
          "id": "A2/0/$//0/0",
          "value": "any",
        },
        "A2/0/$//1/$": {
          "id": "A2/0/$//1/$",
          "value": 5,
        },
        "A2/0/$//1/0": {
          "id": "A2/0/$//1/0",
          "ref": WeakRef {},
        },
        "A2/0/0": {
          "id": "A2/0/0",
          "value": "jackpot",
        },
        "Hey/constructor/0/$": {
          "id": "Hey/constructor/0/$",
          "ref": WeakRef {},
        },
        "Hey/constructor/0/pipe/0/$": {
          "id": "Hey/constructor/0/pipe/0/$",
          "value": 5,
        },
        "Hey/constructor/0/pipe/0/0": {
          "fun_id": "A2/0/$/",
          "id": "Hey/constructor/0/pipe/0/0",
        },
      },
      "call": {
        "A2/0": {
          "arg_ids": [],
          "fun_id": "A2",
          "id": "A2/0",
          "left": 2,
          "parent_call_id": undefined,
          "return_id": "A2/0/$",
          "right": 3,
        },
        "A2/0/$//0": {
          "arg_ids": [],
          "fun_id": "A2/0/$/",
          "id": "A2/0/$//0",
          "left": 4,
          "parent_call_id": undefined,
          "return_id": "A2/0/$//0/$",
          "right": 5,
        },
        "A2/0/$//1": {
          "arg_ids": [],
          "fun_id": "A2/0/$/",
          "id": "A2/0/$//1",
          "left": 7,
          "parent_call_id": "Hey/constructor/0/pipe/0",
          "return_id": "A2/0/$//1/$",
          "right": 8,
        },
        "Hey/constructor/0": {
          "arg_ids": [],
          "fun_id": "Hey",
          "id": "Hey/constructor/0",
          "left": 0,
          "parent_call_id": undefined,
          "return_id": "Hey/constructor/0/$",
          "right": 1,
        },
        "Hey/constructor/0/pipe/0": {
          "arg_ids": [],
          "fun_id": "Hey/constructor/0/pipe",
          "id": "Hey/constructor/0/pipe/0",
          "left": 6,
          "parent_call_id": undefined,
          "return_id": "Hey/constructor/0/pipe/0/$",
          "right": 9,
        },
      },
      "fun": {
        "A2": {
          "call_ids": [],
          "id": "A2",
          "name": "A2",
          "ref": WeakRef {},
        },
        "A2/0/$/": {
          "call_ids": [],
          "id": "A2/0/$/",
          "name": "",
          "ref": WeakRef {},
        },
        "Hey": {
          "call_ids": [],
          "id": "Hey",
          "name": "Hey",
          "ref": WeakRef {},
        },
        "Hey/constructor/0/pipe": {
          "call_ids": [],
          "id": "Hey/constructor/0/pipe",
          "name": "pipe",
          "ref": WeakRef {},
        },
      },
    }
  `)
})

test("arg traversal: primitive", () => {
  const tracer = new Tracer()
  const Double = tracer.decoratoPatronus(function Double(n: number) {
    return n * 2
  })
  Double(5)

  expect(tracer.state$.value).toMatchInlineSnapshot(`
    {
      "arg": {
        "Double2/0/$": {
          "id": "Double2/0/$",
          "value": 10,
        },
        "Double2/0/0": {
          "id": "Double2/0/0",
          "value": 5,
        },
      },
      "call": {
        "Double2/0": {
          "arg_ids": [],
          "fun_id": "Double2",
          "id": "Double2/0",
          "left": 0,
          "parent_call_id": undefined,
          "return_id": "Double2/0/$",
          "right": 1,
        },
      },
      "fun": {
        "Double2": {
          "call_ids": [],
          "id": "Double2",
          "name": "Double2",
          "ref": WeakRef {},
        },
      },
    }
  `)
})

test("arg traversal: POJO with nested props", () => {
  const tracer = new Tracer()
  const GetNested = tracer.decoratoPatronus(function GetNested(obj: any) {
    return obj.a.b
  })
  GetNested({ a: { b: 42, c: "hello" } })

  expect(tracer.state$.value).toMatchInlineSnapshot(`
    {
      "arg": {
        "GetNested2/0/$": {
          "id": "GetNested2/0/$",
          "value": 42,
        },
        "GetNested2/0/0.a.b": {
          "id": "GetNested2/0/0.a.b",
          "value": 42,
        },
        "GetNested2/0/0.a.c": {
          "id": "GetNested2/0/0.a.c",
          "value": "hello",
        },
      },
      "call": {
        "GetNested2/0": {
          "arg_ids": [],
          "fun_id": "GetNested2",
          "id": "GetNested2/0",
          "left": 0,
          "parent_call_id": undefined,
          "return_id": "GetNested2/0/$",
          "right": 1,
        },
      },
      "fun": {
        "GetNested2": {
          "call_ids": [],
          "id": "GetNested2",
          "name": "GetNested2",
          "ref": WeakRef {},
        },
      },
    }
  `)
})
