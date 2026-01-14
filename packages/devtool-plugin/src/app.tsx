import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BehaviorSubject, EMPTY, of, Subject, throwError, timer } from "rxjs"
import {
  catchError,
  debounceTime,
  delay,
  distinctUntilChanged,
  finalize,
  map,
  repeat,
  retry,
  share,
  switchMap,
  take,
  tap,
} from "rxjs/operators"
import { state$, track } from "./tracking/v2/00.types"
import "./tracking/v2/03_scan-accumulator"
import { proxy } from "./tracking/v2/04.operators"
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
const pollUsers$ = track(() =>
  proxy.from(mockFetch(mockUsers, 0)).pipe(
    proxy.map(res => res.data),
    proxy.repeat({
      delay: () => proxy.timer(3000), // This is the dynamic observable we want to visualize
    }),
    proxy.tap({
      next: users => console.log("Polled users:", users.length),
      error: err => console.error("Poll error:", err),
    }),
    proxy.share(),
  ),
) as ReturnType<typeof proxy.from>

// Pattern 2: Search with debounce + switchMap
const searchTerm$ = new BehaviorSubject("")
const searchResults$ = track(() =>
  proxy.from(searchTerm$).pipe(
    proxy.debounceTime(300),
    proxy.distinctUntilChanged(),
    proxy.switchMap(term => {
      if (!term) return proxy.of([])
      const filtered = mockUsers.filter(
        u => u.name.toLowerCase().includes(term.toLowerCase()) || u.email.toLowerCase().includes(term.toLowerCase()),
      )
      return proxy.from(mockFetch(filtered, 0.05)).pipe(proxy.map(res => res.data))
    }),
    proxy.tap(results => console.log("Search results:", results.length)),
  ),
) as ReturnType<typeof proxy.from>

// Pattern 3: Create user with retry on failure
function createUser(name: string, email: string) {
  const newUser = { id: Date.now(), name, email }
  return track(() =>
    proxy.from(mockFetch(newUser, 0.3)).pipe(
      proxy.retry({ count: 2, delay: () => proxy.timer(500) }), // retry with delay observable
      proxy.tap({
        next: res => {
          mockUsers = [...mockUsers, res.data]
          console.log("Created user:", res.data)
        },
        error: err => console.error("Create failed after retries:", err),
      }),
      proxy.catchError(() => proxy.of(null)),
    ),
  ) as ReturnType<typeof proxy.from>
}

// Pattern 4: Delete with optimistic update + rollback
function deleteUser(id: number) {
  const backup = [...mockUsers]
  mockUsers = mockUsers.filter(u => u.id !== id)

  return track(() =>
    proxy.from(mockFetch({ deleted: id }, 0.2)).pipe(
      proxy.tap({
        next: () => console.log("Deleted user:", id),
        error: () => {
          mockUsers = backup // rollback
          console.error("Delete failed, rolled back")
        },
      }),
      proxy.catchError(() => proxy.of(null)),
    ),
  ) as ReturnType<typeof proxy.from>
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
              state$.set({ isEnabled: true })
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
              state$.set({ isEnabled: true })
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
              state$.set({ isEnabled: true })
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
