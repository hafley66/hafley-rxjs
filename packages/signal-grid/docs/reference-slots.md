# Slots

The full slot surface: which slots exist, which ones the renderer reads, and what each one is handed.

`Slots<TRow>` and `Slot<Ctx>` are declared in `src/0_types.ts`. A slot is a function returning
anything renderable, or a signal of one.

## What the renderer reads

| slot | drawn at | beaten by |
| --- | --- | --- |
| `cell` | every data cell | `ColumnDef.cell` |
| `editor` | a cell while `state.editing` names it | nothing |
| `header` | every header cell | `ColumnDef.headerCell` |
| `expander` | the disclosure glyph | nothing |
| `detail` | an open detail panel row | nothing |

The pick order resolves in one line inside `src/10_render.ts`: an editor wins while the cell is
editing, the column beats the schema, and absent means the built-in text path.

## Declared and unread

`headerGroup`, `row`, `checkbox`, `resizeHandle`, `dragPreview`, `empty`, `loading`, and `footer`
are declared on `Slots` and render nothing today. A grid needing an empty state or a footer places
that node beside the grid rather than inside it.

## The three contexts

| ctx | fields | handed to |
| --- | --- | --- |
| `CellCtx` | `row`, `col`, `data`, `value`, `node`, `editing` | `cell`, `editor` |
| `HeaderCtx` | `col`, `node`, `sort`, `pinned` | `header` |
| `RowCtx` | `row`, `data`, `node`, `selected`, `open` | `expander`, `detail` |

The shapes are fixed. A slot needing more closes over it, because a slot is an ordinary function in
your own scope.

## Returning a signal

`mount` in `src/10_render.ts` subscribes a returned signal into the row's own `Subscription` and
replaces only what the previous emission inserted, so one cell updates and the row around it never
rebuilds. Worked through on [Slots that are signals](/cells-signal-slots).

## No value and onChange pairs

There is no controlled and uncontrolled distinction anywhere in the package, because a signal is
both halves in one object. The argument is on
[Signals instead of value and onChange](/why-signals).

## The reference live slot

`checkboxColumn` in `src/5_columns.ts` builds a header slot returning a signal that reads the flat
view and the selection record and answers one of three glyphs, counting neither group headings nor
detail panels. It is the select-all toggle, and it is the shape to copy for any header that has to
watch the body.
