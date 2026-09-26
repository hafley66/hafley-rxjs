import { of } from "rxjs";
import { describe, expect, it } from "vitest";
import { createBoopXtermPane } from "./7_pane.js";
import { testPorts } from "./test/0_endpointTransport.js";
import { openRealTerminal, waitFor, writeTerminal } from "./test/1_realTerminal.js";

describe("createBoopXtermPane with a real Terminal", () => {
  it("stays cold until observed and releases transport and xterm listeners after the last reader", async () => {
    const { term, host } = openRealTerminal();
    const calls: string[] = [];
    const ports = testPorts((request) => {
      calls.push(request.url);
      return of({ status: 200, body: request.url === "boop_mux_session" ? null : [] });
    });
    const pane = createBoopXtermPane(term, host, { id: "p", target: "tmux:1", socket: null }, ports);
    expect(calls).toEqual([]);
    expect(host.querySelector(".term-pinned-root")).toBeNull();
    const subscription = pane.effects.subscribe();
    await waitFor(() => calls.includes("boop_mux_session"));
    expect(host.querySelector(".term-pinned-root")).not.toBeNull();
    await writeTerminal(term, "active write");
    const revision = pane.runtime.viewportRevision.$();
    expect(revision).toBeGreaterThan(0);
    subscription.unsubscribe();
    expect(host.querySelector(".term-pinned-root")).toBeNull();
    const before = { calls: calls.length, revision: pane.runtime.viewportRevision.$() };
    await writeTerminal(term, " after release");
    expect({ calls: calls.length, revision: pane.runtime.viewportRevision.$() }).toEqual(before);
  });
});
