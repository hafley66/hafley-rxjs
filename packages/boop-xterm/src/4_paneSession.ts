import { createQuery, toSignal, type Query } from "@hafley66/signals";
import { combineLatest, map } from "rxjs";
import type { BoopXtermPorts, PaneIdentity, PaneSessionBinding } from "./3_ports.js";

export function paneSessionStream(
  identity: PaneIdentity, ports: BoopXtermPorts,
): Query<{ target: string; socket: string | null }, PaneSessionBinding | null> {
  const paneVisible = toSignal(ports.paneVisible);
  const paneClosed = toSignal(ports.paneClosed);
  return createQuery(ports.boop_mux_session, {
    target: identity.target, socket: identity.socket,
  }, {
    cacheTime: 0,
    staleTime: 0,
    refetchInterval: (state) => state.isError ||
      !state.data || typeof state.data !== "object" || !("session" in state.data) || !state.data.session
      ? 1_000 : 5_000,
    pauseWhen: combineLatest([paneVisible.$, paneClosed.$]).pipe(map(([visible, closed]) => !visible || closed)),
  });
}
