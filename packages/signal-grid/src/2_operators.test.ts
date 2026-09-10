import { describe, expect, it } from "vitest"
import type { ColumnDef, FilterItem, FilterModel, SortModel } from "./0_types.js"
import {
  booleanOperators,
  buildComparator,
  buildRowPredicate,
  compareBoolean,
  compareDate,
  compareNumber,
  compareString,
  comparatorFor,
  dateOperators,
  dateTimeOperators,
  numberOperators,
  operatorByName,
  operatorsFor,
  singleSelectOperators,
  stringOperators,
} from "./2_operators.js"

const item = (operator: string, value?: unknown, field = "f"): FilterItem => ({
  id: operator + ":" + field,
  field,
  operator,
  value,
})

const predicate = (
  set: readonly { name: string; build: (i: FilterItem) => ((v: unknown) => boolean) | null }[],
  name: string,
  value?: unknown,
): ((v: unknown) => boolean) | null => {
  const op = set.find((o) => o.name === name)
  if (op === undefined) throw new Error("no operator " + name)
  return op.build(item(name, value))
}

const must = (
  set: readonly { name: string; build: (i: FilterItem) => ((v: unknown) => boolean) | null }[],
  name: string,
  value?: unknown,
): ((v: unknown) => boolean) => {
  const fn = predicate(set, name, value)
  if (fn === null) throw new Error("operator " + name + " reported incomplete")
  return fn
}

// Local midnight, so the tests read the same clock the day-grain comparison reads.
const day = (y: number, m: number, d: number, h = 0, min = 0): Date => new Date(y, m - 1, d, h, min)

describe("string operators", () => {
  it("matches case-insensitively", () => {
    expect(must(stringOperators, "contains", "AB")("xxabxx")).toBe(true)
    expect(must(stringOperators, "equals", "HELLO")("hello")).toBe(true)
    expect(must(stringOperators, "startsWith", "HE")("hello")).toBe(true)
    expect(must(stringOperators, "endsWith", "LO")("hello")).toBe(true)
  })

  it("ignores leading and trailing whitespace on the filter term", () => {
    expect(must(stringOperators, "contains", "  ab  ")("xxabxx")).toBe(true)
    expect(must(stringOperators, "equals", "  hello ")("hello")).toBe(true)
  })

  it("treats a whitespace-only term as incomplete", () => {
    expect(predicate(stringOperators, "contains", "")).toBeNull()
    expect(predicate(stringOperators, "contains", undefined)).toBeNull()
    expect(predicate(stringOperators, "contains", null)).toBeNull()
  })

  it("answers true on an empty cell for the negated operators", () => {
    expect(must(stringOperators, "doesNotContain", "ab")(null)).toBe(true)
    expect(must(stringOperators, "doesNotEqual", "ab")(undefined)).toBe(true)
    expect(must(stringOperators, "contains", "ab")(null)).toBe(false)
  })

  it("negated operators are exact complements of their positive form", () => {
    const yes = must(stringOperators, "contains", "ab")
    const no = must(stringOperators, "doesNotContain", "ab")
    for (const v of ["ab", "zz", null, undefined, "", 12]) expect(no(v)).toBe(!yes(v))
  })
})

describe("isEmpty and isNotEmpty", () => {
  it("is true for null, undefined, and the empty string", () => {
    const empty = must(stringOperators, "isEmpty")
    expect(empty(null)).toBe(true)
    expect(empty(undefined)).toBe(true)
    expect(empty("")).toBe(true)
  })

  it("is false for 0 and for false", () => {
    const empty = must(numberOperators, "isEmpty")
    expect(empty(0)).toBe(false)
    expect(empty(false)).toBe(false)
  })

  it("isNotEmpty is the exact complement of isEmpty", () => {
    const empty = must(stringOperators, "isEmpty")
    const filled = must(stringOperators, "isNotEmpty")
    for (const v of [null, undefined, "", 0, false, "x"]) expect(filled(v)).toBe(!empty(v))
  })

  it("is never incomplete because it takes no value", () => {
    expect(predicate(stringOperators, "isEmpty", undefined)).not.toBeNull()
    expect(stringOperators.find((o) => o.name === "isEmpty")?.unary).toBe(true)
  })
})

describe("isAnyOf", () => {
  it("takes an array value and matches any member", () => {
    const any = must(stringOperators, "isAnyOf", ["Ada", "Grace"])
    expect(any("grace")).toBe(true)
    expect(any("linus")).toBe(false)
  })

  it("treats an empty array as incomplete", () => {
    expect(predicate(stringOperators, "isAnyOf", [])).toBeNull()
    expect(predicate(numberOperators, "isAnyOf", [])).toBeNull()
    expect(predicate(singleSelectOperators, "isAnyOf", [])).toBeNull()
  })

  it("treats a non-array value as incomplete", () => {
    expect(predicate(stringOperators, "isAnyOf", "Ada")).toBeNull()
  })

  it("compares numbers numerically rather than as text", () => {
    const any = must(numberOperators, "isAnyOf", [1, 2, 3])
    expect(any("2")).toBe(true)
    expect(any(4)).toBe(false)
  })
})

describe("number operators", () => {
  it("keeps 0 as a complete filter term", () => {
    const eq = must(numberOperators, "=", 0)
    expect(eq(0)).toBe(true)
    expect(eq(1)).toBe(false)
  })

  it("orders with the six comparison operators", () => {
    expect(must(numberOperators, ">", 5)(6)).toBe(true)
    expect(must(numberOperators, ">", 5)(5)).toBe(false)
    expect(must(numberOperators, ">=", 5)(5)).toBe(true)
    expect(must(numberOperators, "<", 5)(4)).toBe(true)
    expect(must(numberOperators, "<=", 5)(5)).toBe(true)
    expect(must(numberOperators, "!=", 5)(4)).toBe(true)
  })

  it("does not match an empty cell except under !=", () => {
    expect(must(numberOperators, "=", 5)(null)).toBe(false)
    expect(must(numberOperators, ">", 5)(null)).toBe(false)
    expect(must(numberOperators, "!=", 5)(null)).toBe(true)
  })

  it("reports a non-numeric filter term as incomplete", () => {
    expect(predicate(numberOperators, "=", "abc")).toBeNull()
  })
})

describe("boolean operators", () => {
  it("accepts both a boolean and the string form of the term", () => {
    expect(must(booleanOperators, "is", true)(true)).toBe(true)
    expect(must(booleanOperators, "is", "true")(true)).toBe(true)
    expect(must(booleanOperators, "is", "false")(false)).toBe(true)
  })

  it("treats false as a complete filter term", () => {
    expect(predicate(booleanOperators, "is", false)).not.toBeNull()
    expect(must(booleanOperators, "is", false)(false)).toBe(true)
    expect(must(booleanOperators, "is", false)(true)).toBe(false)
  })
})

describe("date operators", () => {
  it("compares by calendar day and drops the time", () => {
    const is = must(dateOperators, "is", day(2026, 9, 10, 9, 30))
    expect(is(day(2026, 9, 10, 23, 59))).toBe(true)
    expect(is(day(2026, 9, 11, 0, 1))).toBe(false)
  })

  it("reads a bare YYYY-MM-DD term as that local calendar day", () => {
    const is = must(dateOperators, "is", "2026-09-10")
    expect(is(day(2026, 9, 10, 0, 5))).toBe(true)
    expect(is(day(2026, 9, 9, 23, 55))).toBe(false)
  })

  it("orders with after, onOrAfter, before, and onOrBefore at day grain", () => {
    const term = day(2026, 9, 10, 12, 0)
    expect(must(dateOperators, "after", term)(day(2026, 9, 10, 23, 0))).toBe(false)
    expect(must(dateOperators, "after", term)(day(2026, 9, 11))).toBe(true)
    expect(must(dateOperators, "onOrAfter", term)(day(2026, 9, 10))).toBe(true)
    expect(must(dateOperators, "before", term)(day(2026, 9, 9))).toBe(true)
    expect(must(dateOperators, "onOrBefore", term)(day(2026, 9, 10, 1, 0))).toBe(true)
  })

  it("not is true for a different day", () => {
    const not = must(dateOperators, "not", day(2026, 9, 10))
    expect(not(day(2026, 9, 11))).toBe(true)
    expect(not(day(2026, 9, 10, 6, 0))).toBe(false)
  })

  it("returns false rather than throwing on a value that is not a date", () => {
    for (const name of ["is", "not", "after", "onOrAfter", "before", "onOrBefore"]) {
      const fn = must(dateOperators, name, day(2026, 9, 10))
      expect(fn("not a date")).toBe(false)
      expect(fn(null)).toBe(false)
      expect(fn({})).toBe(false)
      expect(fn(new Date(Number.NaN))).toBe(false)
    }
  })

  it("reports an unparseable filter term as incomplete", () => {
    expect(predicate(dateOperators, "is", "not a date")).toBeNull()
  })
})

describe("dateTime operators", () => {
  it("compares by instant rather than by day", () => {
    const is = must(dateTimeOperators, "is", day(2026, 9, 10, 9, 30))
    expect(is(day(2026, 9, 10, 9, 30))).toBe(true)
    expect(is(day(2026, 9, 10, 9, 31))).toBe(false)
    expect(must(dateTimeOperators, "after", day(2026, 9, 10, 9, 30))(day(2026, 9, 10, 9, 31))).toBe(
      true,
    )
  })
})

describe("singleSelect operators", () => {
  it("matches an option that round-tripped through a string", () => {
    expect(must(singleSelectOperators, "is", 3)("3")).toBe(true)
    expect(must(singleSelectOperators, "is", "3")(3)).toBe(true)
  })

  it("not is true for an empty cell", () => {
    expect(must(singleSelectOperators, "not", "a")(null)).toBe(true)
    expect(must(singleSelectOperators, "is", "a")(null)).toBe(false)
  })
})

describe("operator lookup", () => {
  it("routes each column type to its own set", () => {
    expect(operatorsFor("string")).toBe(stringOperators)
    expect(operatorsFor("number")).toBe(numberOperators)
    expect(operatorsFor("boolean")).toBe(booleanOperators)
    expect(operatorsFor("date")).toBe(dateOperators)
    expect(operatorsFor("dateTime")).toBe(dateTimeOperators)
    expect(operatorsFor("singleSelect")).toBe(singleSelectOperators)
  })

  it("falls back to the string set for custom and actions", () => {
    expect(operatorsFor("custom")).toBe(stringOperators)
    expect(operatorsFor("actions")).toBe(stringOperators)
  })

  it("exposes the MUI operator names per type", () => {
    expect(stringOperators.map((o) => o.name)).toEqual([
      "contains",
      "doesNotContain",
      "equals",
      "doesNotEqual",
      "startsWith",
      "endsWith",
      "isEmpty",
      "isNotEmpty",
      "isAnyOf",
    ])
    expect(numberOperators.map((o) => o.name)).toEqual([
      "=",
      "!=",
      ">",
      ">=",
      "<",
      "<=",
      "isEmpty",
      "isNotEmpty",
      "isAnyOf",
    ])
    expect(booleanOperators.map((o) => o.name)).toEqual(["is"])
    const dateNames = [
      "is",
      "not",
      "after",
      "onOrAfter",
      "before",
      "onOrBefore",
      "isEmpty",
      "isNotEmpty",
    ]
    expect(dateOperators.map((o) => o.name)).toEqual(dateNames)
    // Both date sets carry one name list. Comparing them to each other passed by construction,
    // because `dateSet(grain)` builds each from the same literal; pinning the list can fail.
    expect(dateTimeOperators.map((o) => o.name)).toEqual(dateNames)
    expect(singleSelectOperators.map((o) => o.name)).toEqual(["is", "not", "isAnyOf"])
  })

  it("returns undefined for a name the type does not carry", () => {
    expect(operatorByName("number", "startsWith")).toBeUndefined()
    expect(operatorByName("string", "contains")?.name).toBe("contains")
  })
})

// --- buildRowPredicate ------------------------------------------------------

interface Row {
  readonly name: string | null
  readonly age: number | null
  readonly city: string
}

const rows: readonly Row[] = [
  { name: "Ada", age: 36, city: "London" },
  { name: "Grace", age: 45, city: "New York" },
  { name: null, age: null, city: "Oslo" },
]

const cols: readonly ColumnDef<Row>[] = [
  { id: "name", type: "string" },
  { id: "age", type: "number" },
  { id: "city", type: "string" },
]

const read = (row: Row, col: string): unknown => (row as unknown as Record<string, unknown>)[col]

const model = (over: Partial<FilterModel> = {}): FilterModel => ({
  items: [],
  logic: "and",
  quick: [],
  quickLogic: "and",
  ...over,
})

const names = (fn: (row: Row) => boolean): (string | null)[] =>
  rows.filter(fn).map((row) => row.name)

describe("buildRowPredicate", () => {
  it("is a constant true when nothing effective is set", () => {
    const fn = buildRowPredicate(model(), cols, read)
    expect(names(fn)).toEqual(["Ada", "Grace", null])
  })

  it("skips an incomplete item instead of rejecting every row", () => {
    const fn = buildRowPredicate(model({ items: [item("contains", "", "name")] }), cols, read)
    expect(names(fn)).toEqual(["Ada", "Grace", null])
  })

  it("ands multiple items under logic and", () => {
    const fn = buildRowPredicate(
      model({ items: [item("isNotEmpty", undefined, "name"), item(">", 40, "age")] }),
      cols,
      read,
    )
    expect(names(fn)).toEqual(["Grace"])
  })

  it("ors multiple items under logic or", () => {
    const fn = buildRowPredicate(
      model({ items: [item("equals", "Ada", "name"), item(">", 40, "age")], logic: "or" }),
      cols,
      read,
    )
    expect(names(fn)).toEqual(["Ada", "Grace"])
  })

  it("skips an item naming a column that is absent from the schema", () => {
    const fn = buildRowPredicate(model({ items: [item("contains", "x", "nope")] }), cols, read)
    expect(names(fn)).toEqual(["Ada", "Grace", null])
  })

  it("skips an item naming an operator the column type does not carry", () => {
    const fn = buildRowPredicate(model({ items: [item("startsWith", "3", "age")] }), cols, read)
    expect(names(fn)).toEqual(["Ada", "Grace", null])
  })

  it("prefers the column's own filterOperators over the type default", () => {
    const own: readonly ColumnDef<Row>[] = [
      {
        id: "name",
        type: "string",
        filterOperators: [{ name: "contains", build: () => () => false }],
      },
      { id: "age", type: "number" },
      { id: "city", type: "string" },
    ]
    const fn = buildRowPredicate(model({ items: [item("contains", "a", "name")] }), own, read)
    expect(names(fn)).toEqual([])
  })

  it("matches a quick term against every filterable column, case-insensitively", () => {
    const fn = buildRowPredicate(model({ quick: ["osl"] }), cols, read)
    expect(names(fn)).toEqual([null])
  })

  it("ands quick terms by default and ors them under quickLogic or", () => {
    const and = buildRowPredicate(model({ quick: ["a", "london"] }), cols, read)
    expect(names(and)).toEqual(["Ada"])
    const or = buildRowPredicate(model({ quick: ["oslo", "london"], quickLogic: "or" }), cols, read)
    expect(names(or)).toEqual(["Ada", null])
  })

  it("skips a column whose filterable is false when quick matching", () => {
    const hidden: readonly ColumnDef<Row>[] = [
      { id: "name", type: "string" },
      { id: "age", type: "number" },
      { id: "city", type: "string", filterable: false },
    ]
    const fn = buildRowPredicate(model({ quick: ["oslo"] }), hidden, read)
    expect(names(fn)).toEqual([])
  })

  it("ands the quick result with the item result", () => {
    const fn = buildRowPredicate(
      model({ items: [item(">", 40, "age")], quick: ["ada"] }),
      cols,
      read,
    )
    expect(names(fn)).toEqual([])
  })

  it("ignores a blank quick term", () => {
    const fn = buildRowPredicate(model({ quick: ["   "] }), cols, read)
    expect(names(fn)).toEqual(["Ada", "Grace", null])
  })
})

// --- Comparators ------------------------------------------------------------

const sorted = <T>(values: readonly T[], cmp: (a: T, b: T) => number): T[] =>
  [...values].sort(cmp)

describe("comparators", () => {
  it("sorts strings, numbers, booleans, and dates in ascending order", () => {
    expect(sorted(["b", "a", "c"], compareString)).toEqual(["a", "b", "c"])
    expect(sorted([3, 1, 2], compareNumber)).toEqual([1, 2, 3])
    expect(sorted([true, false], compareBoolean)).toEqual([false, true])
    expect(sorted([day(2026, 9, 11), day(2026, 9, 10)], compareDate)).toEqual([
      day(2026, 9, 10),
      day(2026, 9, 11),
    ])
  })

  it("puts null and undefined last in ascending order", () => {
    expect(sorted(["b", null, "a", undefined], compareString)).toEqual(["a", "b", null, undefined])
    expect(sorted([2, null, 1], compareNumber)).toEqual([1, 2, null])
    expect(sorted([true, null, false], compareBoolean)).toEqual([false, true, null])
    expect(sorted([day(2026, 9, 10), null], compareDate)).toEqual([day(2026, 9, 10), null])
  })

  it("floats null and undefined to the front when the order is negated for desc", () => {
    const desc = (a: unknown, b: unknown): number => -compareString(a, b)
    expect(sorted(["b", null, "a"], desc)).toEqual([null, "b", "a"])
    const descNum = (a: unknown, b: unknown): number => -compareNumber(a, b)
    expect(sorted([2, null, 1], descNum)).toEqual([null, 2, 1])
  })

  it("treats two blanks as equal", () => {
    expect(compareString(null, undefined)).toBe(0)
    expect(compareNumber(null, undefined)).toBe(0)
    expect(compareDate(null, undefined)).toBe(0)
  })

  it("routes each column type to its comparator", () => {
    expect(comparatorFor("number")).toBe(compareNumber)
    expect(comparatorFor("boolean")).toBe(compareBoolean)
    expect(comparatorFor("date")).toBe(compareDate)
    expect(comparatorFor("dateTime")).toBe(compareDate)
    expect(comparatorFor("string")).toBe(compareString)
    expect(comparatorFor("singleSelect")).toBe(compareString)
  })
})

describe("buildComparator", () => {
  it("returns null for an empty model", () => {
    expect(buildComparator([], cols, read)).toBeNull()
  })

  it("returns null when every field names a column absent from the schema", () => {
    const m: SortModel = [{ field: "nope", sort: "asc" }]
    expect(buildComparator(m, cols, read)).toBeNull()
  })

  it("sorts by the first field and only breaks ties with the next", () => {
    const tied: readonly Row[] = [
      { name: "b", age: 1, city: "x" },
      { name: "a", age: 2, city: "x" },
      { name: "a", age: 1, city: "x" },
    ]
    const cmp = buildComparator([{ field: "city", sort: "asc" }, { field: "name", sort: "asc" }, { field: "age", sort: "asc" }], cols, read)
    if (cmp === null) throw new Error("expected a comparator")
    expect(sorted(tied, cmp).map((r) => r.name + ":" + String(r.age))).toEqual([
      "a:1",
      "a:2",
      "b:1",
    ])
  })

  it("negates one field only when that field is desc", () => {
    const data: readonly Row[] = [
      { name: "a", age: 1, city: "x" },
      { name: "a", age: 2, city: "x" },
      { name: "b", age: 1, city: "x" },
    ]
    const cmp = buildComparator([{ field: "name", sort: "asc" }, { field: "age", sort: "desc" }], cols, read)
    if (cmp === null) throw new Error("expected a comparator")
    expect(sorted(data, cmp).map((r) => r.name + ":" + String(r.age))).toEqual([
      "a:2",
      "a:1",
      "b:1",
    ])
  })

  it("uses the column's own sortComparator when present", () => {
    const byLength: readonly ColumnDef<Row>[] = [
      { id: "name", type: "string", sortComparator: (a, b) => String(a).length - String(b).length },
      { id: "age", type: "number" },
      { id: "city", type: "string" },
    ]
    const data: readonly Row[] = [
      { name: "aaa", age: 1, city: "x" },
      { name: "b", age: 1, city: "x" },
    ]
    const cmp = buildComparator([{ field: "name", sort: "asc" }], byLength, read)
    if (cmp === null) throw new Error("expected a comparator")
    expect(sorted(data, cmp).map((r) => r.name)).toEqual(["b", "aaa"])
  })

  it("keeps blank cells last under asc and first under desc through the model", () => {
    const asc = buildComparator([{ field: "age", sort: "asc" }], cols, read)
    const desc = buildComparator([{ field: "age", sort: "desc" }], cols, read)
    if (asc === null || desc === null) throw new Error("expected comparators")
    expect(sorted(rows, asc).map((r) => r.age)).toEqual([36, 45, null])
    expect(sorted(rows, desc).map((r) => r.age)).toEqual([null, 45, 36])
  })
})
