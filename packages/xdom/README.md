# Keyboard operators

`parseChord`, `chord`, `sequence`, `held` and `typeahead` in `packages/xdom/src/5_chords.ts`
turn a plain `KeyboardEvent` stream into chord interactions. All are pure RxJS operators:
each returns an Observable, effects stay in the pipeline as `tap`, and the caller subscribes
at its own boundary.

| operator | signature | meaning |
| --- | --- | --- |
| `parseChord` | `parseChord(spec: string): ChordSpec` | Parse `"Mod+Shift+K"` into `{ key, alt, ctrl, meta, shift }`; `Mod` is Meta on mac platforms and Control elsewhere |
| `matchesChord` | `matchesChord(event: KeyboardEvent, spec: ChordSpec): boolean` | Exact key and exact modifier match |
| `chord` | `chord(spec: string): MonoTypeOperatorFunction<KeyboardEvent>` | Passes keydowns matching the spec exactly |
| `sequence` | `sequence(specs: string, withinMs = 800): OperatorFunction<KeyboardEvent, readonly KeyboardEvent[]>` | Space-separated chords in order, each within `withinMs` of the previous; emits the matched events or resets |
| `held` | `held(target: EventTarget, spec: string, ms: number): Observable<KeyboardEvent>` | Emits the keydown once the key has been held `ms`; OS auto-repeat does not restart the hold |
| `typeahead` | `typeahead(withinMs = 500): OperatorFunction<KeyboardEvent, string>` | Buffers printable keys into a growing string; a pause past `withinMs` clears it |

```ts
import { fromEvent } from "rxjs"
import { chord, sequence, typeahead, type KeyboardEvent } from "@hafley66/xdom"

const keys$ = fromEvent<KeyboardEvent>(el, "keydown")
const commandK$ = keys$.pipe(chord("Mod+K"))
const goto$ = keys$.pipe(sequence("g g"))
const search$ = keys$.pipe(typeahead(), tap(query => grid.filter(query)))
```
