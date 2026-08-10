import { concat, Observable, of, switchMap } from "rxjs"
import { Action } from "history"
import type { Action as ActionType, History, Location, To, Update } from "history"
import { Signal } from "./2_Signal.js"
import type { Signal as SignalType } from "./0_types.js"

export { Action, createBrowserHistory, createMemoryHistory, createHashHistory } from "history"
export type { History, Location, To, Update } from "history"

export interface SignalHistory {
  location: SignalType<Location>
  action: SignalType<ActionType>
}

const locationOf = (h: History): Observable<Location> =>
  concat(of(h.location), new Observable<Location>((s) => h.listen((u) => s.next(u.location))))
const actionOf = (h: History): Observable<ActionType> =>
  concat(of(h.action), new Observable<ActionType>((s) => h.listen((u) => s.next(u.action))))

// location/action are Signals whose observable def is history$ -> switchMap each
// history into its listen stream. Signal(obs, initial) scopes the subscription.
export function signalHistory(
  history$: Observable<History>,
  initial: { location: Location; action: ActionType } = {
    location: { pathname: "/", search: "", hash: "", state: null, key: "default" },
    action: Action.Pop,
  },
): SignalHistory {
  return {
    location: Signal<Location>(history$.pipe(switchMap(locationOf)), initial.location),
    action: Signal<ActionType>(history$.pipe(switchMap(actionOf)), initial.action),
  }
}
