import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import {
  BehaviorSubject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  from,
  map,
  of,
  repeat,
  retry,
  share,
  switchMap,
  tap,
  timer,
} from "rxjs"
import { take } from "rxjs/operators"
import { isEnabled$, state$ } from "./tracking/v2/00.types"
import "./tracking/v2/03_scan-accumulator"
import { DebuggerGrid } from "./tracking/v2/ui/0_DebuggerGrid"

// === Mock API ===
type User = { id: number; name: string; email: string }
type ApiResponse<T> = { data: T; timestamp: number }

let mockUsers: User[] = [
  { id: 1, name: "Alice", email: "alice@example.com" },
  { id: 2, name: "Bob", email: "bob@example.com" },
  { id: 3, name: "Charlie", email: "charlie@example.com" },
]

let requestCount = 0

// Simulated API with random latency and occasional failures
function mockFetch<T>(data: T, failRate = 0.1): Promise<ApiResponse<T>> {
  requestCount++
  const latency = 200 + Math.random() * 800
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (Math.random() < failRate) {
        reject(new Error(`Request #${requestCount} failed`))
      } else {
        resolve({ data, timestamp: Date.now() })
      }
    }, latency)
  })
}

// === RxJS Patterns Demo ===

// Pattern 1: Polling with repeat + delay returning observable
const pollUsers$ = from(mockFetch(mockUsers, 0)).pipe(
  map(res => res.data),
  repeat({
    delay: () => timer(3000), // This is the dynamic observable we want to visualize
  }),
  tap({
    next: users => console.log("Polled users:", users.length),
    error: err => console.error("Poll error:", err),
  }),
  share(),
)

// Pattern 2: Search with debounce + switchMap
const searchTerm$ = new BehaviorSubject("")
const searchResults$ = from(searchTerm$).pipe(
  debounceTime(300),
  distinctUntilChanged(),
  switchMap(term => {
    if (!term) return of([])
    const filtered = mockUsers.filter(
      u => u.name.toLowerCase().includes(term.toLowerCase()) || u.email.toLowerCase().includes(term.toLowerCase()),
    )
    return from(mockFetch(filtered, 0.05)).pipe(map(res => res.data))
  }),
  tap(results => console.log("Search results:", results.length)),
)

// Pattern 3: Create user with retry on failure
function createUser(name: string, email: string) {
  const newUser = { id: Date.now(), name, email }
  return from(mockFetch(newUser, 0.3)).pipe(
    retry({ count: 2, delay: () => timer(500) }), // retry with delay observable
    tap({
      next: res => {
        mockUsers = [...mockUsers, res.data]
        console.log("Created user:", res.data)
      },
      error: err => console.error("Create failed after retries:", err),
    }),
    catchError(() => of(null)),
  )
}

// Pattern 4: Delete with optimistic update + rollback
function deleteUser(id: number) {
  const backup = [...mockUsers]
  mockUsers = mockUsers.filter(u => u.id !== id)

  return from(mockFetch({ deleted: id }, 0.2)).pipe(
    tap({
      next: () => console.log("Deleted user:", id),
      error: () => {
        mockUsers = backup // rollback
        console.error("Delete failed, rolled back")
      },
    }),
    catchError(() => of(null)),
  )
}

// === React Components ===

function App() {
  state$.use$()

  return (
    <div style={{ fontFamily: "system-ui", padding: 20, display: "flex", gap: 20 }}>
      <div style={{ flex: 1, maxWidth: 400 }}>
        <h2>Mock CRUD Demo</h2>

        <section style={{ marginBottom: 20 }}>
          <h3>Polling (repeat + delay)</h3>
          <button
            type="button"
            onClick={() => {
              isEnabled$.next(true)
              const sub = pollUsers$.pipe(take(3)).subscribe()
              setTimeout(() => sub.unsubscribe(), 10000)
            }}
          >
            Start Polling (3 cycles)
          </button>
        </section>

        <section style={{ marginBottom: 20 }}>
          <h3>Search (debounce + switchMap)</h3>
          <input
            type="text"
            placeholder="Search users..."
            onChange={e => searchTerm$.next(e.target.value)}
            style={{ padding: 8, width: "100%" }}
          />
          <button
            type="button"
            onClick={() => {
              isEnabled$.next(true)
              searchResults$.pipe(take(5)).subscribe()
            }}
          >
            Enable Search Tracking
          </button>
        </section>

        <section style={{ marginBottom: 20 }}>
          <h3>Create (retry + delay)</h3>
          <button
            type="button"
            onClick={() => {
              createUser(`User${Date.now()}`, `user${Date.now()}@test.com`).subscribe()
            }}
          >
            Create User (may retry)
          </button>
        </section>

        <section style={{ marginBottom: 20 }}>
          <h3>Delete (optimistic + rollback)</h3>
          <button
            type="button"
            onClick={() => {
              if (mockUsers.length === 0) return
              deleteUser(mockUsers[0]!.id).subscribe()
            }}
          >
            Delete First User
          </button>
        </section>

        <section>
          <h3>Controls</h3>
          <button
            type="button"
            onClick={() => {
              state$.reset()
              isEnabled$.next(true)
            }}
          >
            Clear & Disable
          </button>
        </section>
      </div>

      <div style={{ flex: 2, borderLeft: "1px solid #ccc", paddingLeft: 20 }}>
        <h2>Debugger</h2>
        <DebuggerGrid />
      </div>
    </div>
  )
}

// Mount
const root = createRoot(document.getElementById("root")!)
root.render(
  <StrictMode>
    <App />
  </StrictMode>,
)
