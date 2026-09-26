import "./theme.css";
import { Signal } from "@hafley66/signals";
import { of, Subject, type Subscription } from "rxjs";
import { afterEach, expect, it } from "vitest";
import { page } from "vitest/browser";
import type { HarnessId } from "./0_types.js";
import type { Strip } from "./1_agentSquaresFeed.js";
import { createBoopXtermView } from "./9_view.js";
import { testPorts } from "./test/0_endpointTransport.js";
import { nextFrame, openRealTerminal, waitFor, writeTerminal } from "./test/1_realTerminal.js";
import live from "./test/3_liveClaudePane.json";

// A real Claude Code pane (tmux %397) and the frame instant's Rust squares watcher
// projected from it, recorded by instant's `record_live_pane` test.
type LivePane = { cols: number; height: number; rows: string[]; strip: Strip };
const pane = live as unknown as LivePane;

const connected: Subscription[] = [];
afterEach(() => { for (const subscription of connected.splice(0)) subscription.unsubscribe(); });

async function rig() {
  const { term, host } = openRealTerminal({ fontSize: 10 });
  host.style.cssText = "position:relative;width:1240px;height:680px;background:#111";
  term.resize(pane.cols, pane.height);
  await writeTerminal(term, pane.rows.join("\r\n"));
  const ports = testPorts((request) => {
    if (request.url === "boop_mux_session") return of({ status: 200, body: { session: pane.strip.session, harness: "claude" } });
    if (request.url === "boop_mux_capture") return of({ status: 200, body: "" });
    if (["boop_turns", "boop_turns_recent", "boop_locate_turns", "boop_turn_comments",
      "boop_turn_annotations", "boop_turn_comment_forks"].includes(request.url)) return of({ status: 200, body: [] });
    return of({ status: 200, body: null });
  });
  const frames = new Subject<Strip>();
  ports["squares-update"] = frames;
  ports.harness = Signal<HarnessId | null>("claude");
  ports.agentSquaresEnabled = Signal(true);
  ports.turnDebugEnabled = Signal(true);
  const view = createBoopXtermView(term, host, { id: "p1", target: "%397", socket: null, graphics: false }, ports);
  connected.push(view.effects.subscribe());
  await waitFor(() => view.pane.paneSession.data.$()?.session === pane.strip.session);
  return { term, host, frames, view };
}

function squares(host: HTMLElement) {
  return [...host.querySelectorAll<HTMLElement>(".asq")].map((el) =>
    `${el.dataset.turn?.split(":")[1]} ${el.dataset.kind} y=${Math.round(Number.parseFloat(el.style.getPropertyValue("--asq-y")))}`);
}

it("draws the live frame's squares on the rows their turns occupy", async () => {
  const { host, frames } = await rig();
  frames.next(pane.strip);
  await waitFor(() => host.querySelectorAll(".asq").length === pane.strip.layout!.squares.length);
  await nextFrame();
  const cell = host.querySelector<HTMLElement>(".xterm-screen")!.clientHeight / pane.height;
  expect({ cell: Math.round(cell * 100) / 100, squares: squares(host) }).toMatchInlineSnapshot(`
    {
      "cell": 12,
      "squares": [
        "23 user y=0",
        "29 user y=17",
        "31 agent y=24",
        "32 user y=120",
        "33 agent y=144",
        "34 user y=276",
        "40 tool y=300",
        "42 agent y=360",
      ],
    }
  `);
  await page.screenshot({ path: "../artifacts/live-claude-01-strip.png" });
});

it("keeps the squares on their rows when the pane resizes after the frame", async () => {
  const { host, frames, view } = await rig();
  const paints: unknown[] = [];
  connected.push(view.agentSquares.painted.$.subscribe((sample) => paints.push(sample)));
  frames.next(pane.strip);
  await waitFor(() => host.querySelectorAll(".asq").length === pane.strip.layout!.squares.length);
  const before = squares(host);
  host.style.width = "1100px";
  host.style.height = "600px";
  await waitFor(() => paints.length === 2);
  expect(squares(host)).toEqual(before);
});
