// @vitest-environment jsdom
import { of } from "rxjs";
import { TestScheduler } from "rxjs/testing";
import { describe, expect, it } from "vitest";
import { createBoopXtermPane } from "./7_pane.js";
import { testPorts } from "./test/0_endpointTransport.js";
import { testTerminal } from "./test/1_terminal.js";

describe("createBoopXtermPane", () => {
  it("stays cold until observed and releases transport and xterm listeners after the last reader", () => {
    const scheduler = new TestScheduler((actual, expected) => expect(actual).toEqual(expected));
    scheduler.run(({ animate }) => {
      animate("x".repeat(20));
      const terminal = testTerminal();
      const host = document.createElement("div");
      document.body.appendChild(host);
      const calls: Array<{ frame: number; url: string }> = [];
      const ports = testPorts((request) => {
        calls.push({ frame: scheduler.frame, url: request.url });
        return of({ status: 200, body: request.url === "boop_mux_session" ? null : [] });
      });
      const pane = createBoopXtermPane(terminal.term, host, { id: "p", target: "tmux:1", socket: null }, ports);
      expect(calls).toEqual([]);
      expect([terminal.listeners("write"), terminal.listeners("scroll"), terminal.listeners("resize")]).toEqual([0, 0, 0]);
      let subscription: ReturnType<typeof pane.effects.subscribe>;
      scheduler.schedule(() => {
        subscription = pane.effects.subscribe();
        expect(terminal.listeners("write")).toBeGreaterThan(0);
      }, 2);
      scheduler.schedule(() => {
        subscription.unsubscribe();
        expect([terminal.listeners("write"), terminal.listeners("scroll"), terminal.listeners("resize"), terminal.listeners("render")]).toEqual([0, 0, 0, 0]);
        expect(host.querySelector(".term-pinned-root")).toBeNull();
      }, 6);
      scheduler.flush();
      expect(calls.filter((call) => call.url === "boop_mux_session").map((call) => call.frame)).toEqual([2]);
      host.remove();
    });
  });
});
