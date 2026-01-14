import {
  BehaviorSubject,
  Subject,
  Observable,
  of,
  from,
  defer,
  merge,
  combineLatest,
} from "rxjs"
import {
  map,
  filter,
  switchMap,
  share,
  startWith,
} from "rxjs/operators"

// Kitchen sink test - exercises all common RxJS patterns

// === Subjects ===
const behaviorSubject$ = new BehaviorSubject<number>(1)
const subject$ = new Subject<string>()

// === Cold Observable ===
const cold$ = new Observable<number>(subscriber => {
  subscriber.next(100)
  subscriber.next(200)
  subscriber.complete()
})

// === Creation functions ===
const of$ = of(1, 2, 3)
const from$ = from([4, 5, 6])
const deferredValue = "deferred"
const defer$ = defer(() => of(deferredValue))

// === Pipe chains ===
const piped$ = behaviorSubject$.pipe(
  map(x => x * 10),
  filter(x => x > 0),
)

// === Operators that create observables ===
const switched$ = of(1, 2).pipe(
  switchMap(x => of(x * 100)),
)

// === Multicasting ===
const shared$ = cold$.pipe(share())

// === Combiners ===
const a = "a"
const b = "b"
const c = "c"
const merged$ = merge(of(a), of(b), of(c))
const combined$ = combineLatest([of(1), of(2), of(3)])

// === Nested pipes ===
const nested$ = behaviorSubject$.pipe(
  map(x => x + 1),
  switchMap(x =>
    of(x).pipe(
      map(y => y * 2),
      startWith(0),
    ),
  ),
)

// Expose tracking state to window
declare global {
  interface Window {
    __kitchen_sink__: {
      // Observables for interaction
      behaviorSubject$: typeof behaviorSubject$
      subject$: typeof subject$
      // Collected values
      values: Record<string, any[]>
      // Tracking state (will be populated by test)
      debugState: any
    }
  }
}

// Initialize test state
window.__kitchen_sink__ = {
  behaviorSubject$,
  subject$,
  values: {
    piped: [],
    switched: [],
    shared: [],
    merged: [],
    combined: [],
    nested: [],
    cold: [],
    of: [],
    from: [],
    defer: [],
  },
  debugState: null,
}

// Subscribe to everything and collect values
piped$.subscribe(v => window.__kitchen_sink__.values.piped.push(v))
switched$.subscribe(v => window.__kitchen_sink__.values.switched.push(v))
shared$.subscribe(v => window.__kitchen_sink__.values.shared.push(v))
merged$.subscribe(v => window.__kitchen_sink__.values.merged.push(v))
combined$.subscribe(v => window.__kitchen_sink__.values.combined.push(v))
nested$.subscribe(v => window.__kitchen_sink__.values.nested.push(v))
cold$.subscribe(v => window.__kitchen_sink__.values.cold.push(v))
of$.subscribe(v => window.__kitchen_sink__.values.of.push(v))
from$.subscribe(v => window.__kitchen_sink__.values.from.push(v))
defer$.subscribe(v => window.__kitchen_sink__.values.defer.push(v))

// Debug: check patching and IDs
console.log("[kitchen-sink] Patching status:", {
  patched: (globalThis as any).__rxjs_debugger_patched__,
})
console.log("[kitchen-sink] Observable IDs:", {
  behaviorSubject: (behaviorSubject$ as any).__id__,
  piped: (piped$ as any).__id__,
  cold: (cold$ as any).__id__,
  of: (of$ as any).__id__,
})

console.log("[kitchen-sink] loaded")
