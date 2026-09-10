// Value-level operators: filter predicates and comparators. Pure functions over single
// cell values, so every rule here is testable without a row, a signal, or a subscription.
//
// The operator sets mirror MUI X Data Grid name for name, because the filter panel is a user-facing
// contract: a saved model from an MUI grid has to keep meaning the same thing here.
import type {
  ColId,
  ColumnDef,
  ColumnType,
  FilterItem,
  FilterModel,
  FilterOperator,
  SortModel,
} from "./0_types.js"

// --- Coercion helpers -------------------------------------------------------

const isNil = (value: unknown): value is null | undefined => value === null || value === undefined

/**
 * An item is incomplete while the user is still typing, and an incomplete item must not remove any
 * row. Only `undefined`, `null`, and `""` count: `0` and `false` are real filter terms.
 */
const isBlank = (value: unknown): boolean => isNil(value) || value === ""

const text = (value: unknown): string => (isNil(value) ? "" : String(value))

const fold = (value: unknown): string => text(value).toLowerCase()

/** The filter term is trimmed but the cell text is not, so a stray trailing space still matches. */
const term = (value: unknown): string => text(value).trim().toLowerCase()

const numberOf = (value: unknown): number | null => {
  if (isNil(value) || value === "") return null
  const n = typeof value === "number" ? value : Number(value)
  return Number.isNaN(n) ? null : n
}

const booleanOf = (value: unknown): boolean | null => {
  if (typeof value === "boolean") return value
  if (value === "true") return true
  if (value === "false") return false
  return null
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * A bare `YYYY-MM-DD` is what a native date input emits. `new Date` reads it as UTC midnight, which
 * lands on the previous calendar day for anyone west of Greenwich, so it is built from local parts.
 */
const dateOf = (value: unknown): Date | null => {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value === "number") {
    const fromMs = new Date(value)
    return Number.isNaN(fromMs.getTime()) ? null : fromMs
  }
  if (typeof value !== "string") return null
  const parts = DATE_ONLY.exec(value)
  if (parts !== null) {
    const local = new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]))
    return Number.isNaN(local.getTime()) ? null : local
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/** Date columns hold an instant but mean a day, so both sides collapse to local midnight. */
const dayGrain = (date: Date): number =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
const instantGrain = (date: Date): number => date.getTime()

const isEmptyCell = (value: unknown): boolean => isNil(value) || value === ""

const asArray = (value: unknown): readonly unknown[] | null => {
  if (!Array.isArray(value)) return null
  // An untouched isAnyOf chip list is an empty array, which is still "not filtering yet".
  return value.length === 0 ? null : value
}

// --- Operator factories -----------------------------------------------------

/**
 * `onNil` is what the operator answers for an empty cell. Positive operators say no, negated ones
 * say yes, so `contains` and `doesNotContain` stay exact complements on every value.
 */
const stringOp = (
  name: string,
  test: (cell: string, needle: string) => boolean,
  onNil: boolean,
): FilterOperator<unknown> => ({
  name,
  build: (item: FilterItem) => {
    if (isBlank(item.value)) return null
    const needle = term(item.value)
    return (value: unknown) => (isNil(value) ? onNil : test(fold(value), needle))
  },
})

const numberOp = (
  name: string,
  test: (cell: number, needle: number) => boolean,
  onNil: boolean,
): FilterOperator<unknown> => ({
  name,
  build: (item: FilterItem) => {
    if (isBlank(item.value)) return null
    const needle = numberOf(item.value)
    if (needle === null) return null
    return (value: unknown) => {
      const cell = numberOf(value)
      return cell === null ? onNil : test(cell, needle)
    }
  },
})

const dateOp = (
  name: string,
  test: (cell: number, needle: number) => boolean,
  grain: (date: Date) => number,
): FilterOperator<unknown> => ({
  name,
  build: (item: FilterItem) => {
    if (isBlank(item.value)) return null
    const needle = dateOf(item.value)
    if (needle === null) return null
    const rhs = grain(needle)
    return (value: unknown) => {
      const cell = dateOf(value)
      // A cell that is not a date cannot satisfy a date comparison. Answering false keeps a dirty
      // column from throwing mid-scan, which would take the whole grid down.
      return cell === null ? false : test(grain(cell), rhs)
    }
  },
})

const emptyOp = (name: string, want: boolean): FilterOperator<unknown> => ({
  name,
  unary: true,
  build: () => (value: unknown) => isEmptyCell(value) === want,
})

const anyOfOp = (
  name: string,
  match: (cell: unknown, needles: readonly unknown[]) => boolean,
): FilterOperator<unknown> => ({
  name,
  build: (item: FilterItem) => {
    const needles = asArray(item.value)
    if (needles === null) return null
    return (value: unknown) => match(value, needles)
  },
})

/** Options may round-trip through a `<select>` as strings, so 3 and "3" are the same option. */
const sameOption = (a: unknown, b: unknown): boolean => a === b || String(a) === String(b)

// --- Operator sets ----------------------------------------------------------

export const stringOperators: readonly FilterOperator<unknown>[] = [
  stringOp("contains", (cell, needle) => cell.includes(needle), false),
  stringOp("doesNotContain", (cell, needle) => !cell.includes(needle), true),
  stringOp("equals", (cell, needle) => cell === needle, false),
  stringOp("doesNotEqual", (cell, needle) => cell !== needle, true),
  stringOp("startsWith", (cell, needle) => cell.startsWith(needle), false),
  stringOp("endsWith", (cell, needle) => cell.endsWith(needle), false),
  emptyOp("isEmpty", true),
  emptyOp("isNotEmpty", false),
  anyOfOp("isAnyOf", (cell, needles) => {
    if (isNil(cell)) return false
    const cellText = fold(cell)
    return needles.some((needle) => term(needle) === cellText)
  }),
]

export const numberOperators: readonly FilterOperator<unknown>[] = [
  numberOp("=", (cell, needle) => cell === needle, false),
  numberOp("!=", (cell, needle) => cell !== needle, true),
  numberOp(">", (cell, needle) => cell > needle, false),
  numberOp(">=", (cell, needle) => cell >= needle, false),
  numberOp("<", (cell, needle) => cell < needle, false),
  numberOp("<=", (cell, needle) => cell <= needle, false),
  emptyOp("isEmpty", true),
  emptyOp("isNotEmpty", false),
  anyOfOp("isAnyOf", (cell, needles) => {
    const n = numberOf(cell)
    return n === null ? false : needles.some((needle) => numberOf(needle) === n)
  }),
]

export const booleanOperators: readonly FilterOperator<unknown>[] = [
  {
    name: "is",
    build: (item: FilterItem) => {
      if (isBlank(item.value)) return null
      const want = booleanOf(item.value)
      if (want === null) return null
      // Truthiness, not identity: a boolean column rendered from missing data reads as false.
      return (value: unknown) => Boolean(value) === want
    },
  },
]

const dateSet = (grain: (date: Date) => number): readonly FilterOperator<unknown>[] => [
  dateOp("is", (cell, needle) => cell === needle, grain),
  dateOp("not", (cell, needle) => cell !== needle, grain),
  dateOp("after", (cell, needle) => cell > needle, grain),
  dateOp("onOrAfter", (cell, needle) => cell >= needle, grain),
  dateOp("before", (cell, needle) => cell < needle, grain),
  dateOp("onOrBefore", (cell, needle) => cell <= needle, grain),
  emptyOp("isEmpty", true),
  emptyOp("isNotEmpty", false),
]

export const dateOperators: readonly FilterOperator<unknown>[] = dateSet(dayGrain)
export const dateTimeOperators: readonly FilterOperator<unknown>[] = dateSet(instantGrain)

export const singleSelectOperators: readonly FilterOperator<unknown>[] = [
  {
    name: "is",
    build: (item: FilterItem) => {
      if (isBlank(item.value)) return null
      const wanted = item.value
      return (value: unknown) => !isNil(value) && sameOption(value, wanted)
    },
  },
  {
    name: "not",
    build: (item: FilterItem) => {
      if (isBlank(item.value)) return null
      const wanted = item.value
      return (value: unknown) => isNil(value) || !sameOption(value, wanted)
    },
  },
  anyOfOp("isAnyOf", (cell, needles) => {
    if (isNil(cell)) return false
    return needles.some((needle) => sameOption(cell, needle))
  }),
]

/** "custom" and "actions" have no value semantics of their own, so they fall back to text matching. */
export const operatorsFor = (type: ColumnType): readonly FilterOperator<unknown>[] => {
  switch (type) {
    case "number":
      return numberOperators
    case "boolean":
      return booleanOperators
    case "date":
      return dateOperators
    case "dateTime":
      return dateTimeOperators
    case "singleSelect":
      return singleSelectOperators
    default:
      return stringOperators
  }
}

export const operatorByName = (
  type: ColumnType,
  name: string,
): FilterOperator<unknown> | undefined => operatorsFor(type).find((op) => op.name === name)

// --- Row predicate ----------------------------------------------------------

const indexColumns = <TRow>(
  columns: readonly ColumnDef<TRow>[],
): ReadonlyMap<ColId, ColumnDef<TRow>> => {
  const by = new Map<ColId, ColumnDef<TRow>>()
  for (const col of columns) by.set(col.id, col)
  return by
}

/** A column ships its own operator list to override a shared name, so it is consulted first. */
const resolveOperator = <TRow>(
  col: ColumnDef<TRow>,
  name: string,
): FilterOperator<unknown> | undefined =>
  col.filterOperators?.find((op) => op.name === name) ?? operatorByName(col.type ?? "string", name)

const TRUE = (): boolean => true

export const buildRowPredicate = <TRow>(
  model: FilterModel,
  columns: readonly ColumnDef<TRow>[],
  getValue: (row: TRow, col: ColId) => unknown,
): ((row: TRow) => boolean) => {
  const by = indexColumns(columns)

  const compiled: { readonly field: ColId; readonly test: (value: unknown) => boolean }[] = []
  for (const item of model.items) {
    const col = by.get(item.field)
    if (col === undefined) continue
    const op = resolveOperator(col, item.operator)
    if (op === undefined) continue
    const test = op.build(item)
    // A null build is the incomplete case: drop the item instead of failing every row.
    if (test === null) continue
    compiled.push({ field: item.field, test })
  }

  const terms = model.quick.map((it) => it.trim().toLowerCase()).filter((it) => it !== "")
  const searched = columns.filter((col) => col.filterable !== false).map((col) => col.id)

  if (compiled.length === 0 && terms.length === 0) return TRUE

  const itemsOr = model.logic === "or"
  const quickOr = model.quickLogic === "or"

  return (row: TRow) => {
    if (compiled.length > 0) {
      let hit = !itemsOr
      for (const entry of compiled) {
        const ok = entry.test(getValue(row, entry.field))
        if (itemsOr) {
          if (ok) {
            hit = true
            break
          }
        } else if (!ok) {
          hit = false
          break
        }
      }
      if (!hit) return false
    }

    if (terms.length === 0) return true

    let quickHit = !quickOr
    for (const quickTerm of terms) {
      const ok = searched.some((field) => fold(getValue(row, field)).includes(quickTerm))
      if (quickOr) {
        if (ok) {
          quickHit = true
          break
        }
      } else if (!ok) {
        quickHit = false
        break
      }
    }
    return quickHit
  }
}

// --- Comparators ------------------------------------------------------------

/**
 * Blanks sink to the bottom of an ascending sort, which is what MUI does and what a reader expects.
 * Descending is a plain negation of the whole comparator, so blanks rise to the top there.
 */
const nilOrder = (a: unknown, b: unknown): number | null => {
  const na = isNil(a)
  const nb = isNil(b)
  if (na && nb) return 0
  if (na) return 1
  if (nb) return -1
  return null
}

export const compareString = (a: unknown, b: unknown): number => {
  const nil = nilOrder(a, b)
  if (nil !== null) return nil
  return String(a).localeCompare(String(b))
}

export const compareNumber = (a: unknown, b: unknown): number => {
  const na = numberOf(a)
  const nb = numberOf(b)
  if (na === null) return nb === null ? 0 : 1
  if (nb === null) return -1
  return na - nb
}

export const compareBoolean = (a: unknown, b: unknown): number => {
  const nil = nilOrder(a, b)
  if (nil !== null) return nil
  return Number(Boolean(a)) - Number(Boolean(b))
}

export const compareDate = (a: unknown, b: unknown): number => {
  const da = dateOf(a)
  const db = dateOf(b)
  if (da === null) return db === null ? 0 : 1
  if (db === null) return -1
  return da.getTime() - db.getTime()
}

export const comparatorFor = (type: ColumnType): ((a: unknown, b: unknown) => number) => {
  switch (type) {
    case "number":
      return compareNumber
    case "boolean":
      return compareBoolean
    case "date":
    case "dateTime":
      return compareDate
    default:
      return compareString
  }
}

/** @feature row.sort.multi */
export const buildComparator = <TRow>(
  model: SortModel,
  columns: readonly ColumnDef<TRow>[],
  getValue: (row: TRow, col: ColId) => unknown,
): ((a: TRow, b: TRow) => number) | null => {
  const by = indexColumns(columns)
  const fields: {
    readonly field: ColId
    readonly sign: number
    readonly cmp: (a: unknown, b: unknown) => number
  }[] = []
  for (const item of model) {
    const col = by.get(item.field)
    if (col === undefined) continue
    fields.push({
      field: item.field,
      sign: item.sort === "desc" ? -1 : 1,
      cmp: col.sortComparator ?? comparatorFor(col.type ?? "string"),
    })
  }
  if (fields.length === 0) return null
  return (a: TRow, b: TRow) => {
    for (const entry of fields) {
      const order = entry.cmp(getValue(a, entry.field), getValue(b, entry.field))
      if (order !== 0) return entry.sign * order
    }
    return 0
  }
}
