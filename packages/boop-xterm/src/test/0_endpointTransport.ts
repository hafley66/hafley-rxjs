import { Endpoint, Signal, type EndpointRequest, type EndpointResponse, type EndpointTransport, type Serializable } from "@hafley66/signals";
import { of, type Observable } from "rxjs";
import type { BoopXtermPorts } from "../3_ports.js";
import type { HarnessId } from "../0_types.js";

export type Script = (request: EndpointRequest) => Observable<EndpointResponse>;

export function testPorts(script: Script): BoopXtermPorts {
  const transport: EndpointTransport = script;
  const endpoint = <I, O>(url: string) => new Endpoint<I, O>({
    request: (input) => ({ url, method: "POST", body: input as Serializable }),
    decode: (response) => response.body as O,
  }, transport);
  return {
    boop_mux_session: endpoint("boop_mux_session"),
    boop_mux_capture: endpoint("boop_mux_capture"),
    boop_turns: endpoint("boop_turns"),
    boop_turns_recent: endpoint("boop_turns_recent"),
    boop_sync_session: endpoint("boop_sync_session"),
    boop_locate_turns: endpoint("boop_locate_turns"),
    scroll_session: endpoint("scroll_session"),
    paneVisible: Signal(true),
    paneClosed: Signal(false),
    harness: Signal<HarnessId | null>("omp"),
    clipboardEnabled: Signal(true),
    tabSessionIds: Signal<string[]>([]),
    scanRequested: Signal<void>(),
    selectionClear: Signal<void>(),
    inlineDiagrams: Signal(true),
    diagramInference: Signal<"explicit" | "labels" | "inferred">("labels"),
  };
}

export const emptyTransport: Script = () => of({ status: 200, body: null });
