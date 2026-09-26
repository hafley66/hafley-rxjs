import { describe, expect, it, vi } from "vitest";
import { TestScheduler } from "rxjs/testing";
import { of } from "rxjs";
import { paneSessionStream } from "./4_paneSession.js";
import { testPorts } from "./test/0_endpointTransport.js";
import { Signal } from "@hafley66/signals";

describe("paneSessionStream", () => {
  it("null then known changes the poll interval from 1s to 5s", async () => {
    vi.useFakeTimers();
    try {
      const calls: number[] = [];
      const ports = testPorts((request) => {
        if (request.url === "boop_mux_session") {
          calls.push(Date.now());
          return of({ status: 200, body: calls.length === 1 ? null : { session: "s1", harness: "omp" } });
        }
        return of({ status: 200, body: null });
      });
      const query = paneSessionStream({ id: "p", target: "tmux:1", socket: null }, ports);
      const seen: Array<string | null> = [];
      const subscription = query.$.subscribe((state) => {
        if (state.isSuccess) seen.push(state.data?.session ?? null);
      });
      const start = calls[0];
      await vi.advanceTimersByTimeAsync(6_100);
      subscription.unsubscribe();
      expect(calls.slice(0, 3).map((time) => time - start)).toEqual([0, 1_000, 6_000]);
      expect(seen).toContain(null);
      expect(seen).toContain("s1");
    } finally {
      vi.useRealTimers();
    }
  });

  it("hidden and resume pauses polling then refetches", () => {
    const scheduler = new TestScheduler((actual, expected) => expect(actual).toEqual(expected));
    scheduler.run(() => {
      const calls: number[] = [];
      const ports = testPorts((request) => {
        if (request.url === "boop_mux_session") calls.push(scheduler.frame);
        return of({ status: 200, body: { session: "s1", harness: "omp" } });
      });
      const visible = Signal(true);
      ports.paneVisible = visible;
      const query = paneSessionStream({ id: "p", target: "tmux:1", socket: null }, ports);
      const subscription = query.$.subscribe();
      scheduler.schedule(() => visible.$(false), 100);
      scheduler.schedule(() => visible.$(true), 3_000);
      scheduler.schedule(() => subscription.unsubscribe(), 3_100);
      scheduler.flush();
      expect(calls).toEqual([0, 3_000]);
    });
  });
});
