import { Signal, createMutation, toSignal, type Endpoint } from "@hafley66/signals";
import type { Terminal } from "@xterm/xterm";
import { EMPTY, Observable, catchError, concatMap, defer, exhaustMap, filter, finalize, map, merge, of, take, tap, throwError } from "rxjs";
import { bracketedPaste } from "./0_bracketedPaste.js";
import { turnHue } from "./0_turnHue.js";
import { formatQueuedContext, turnsAcrossRange, type PromptContextItem, type TerminalSelectionSnapshot } from "./1_contextQueuePure.js";
import type { StructuredSelectable } from "./1_contextGutterPure.js";
import type { BoopXtermPorts, LineAnchorModel, PaneIdentity, TurnVisibilityModel } from "./3_ports.js";

export type ContextQueueModel = {
  state: Signal<{ items: PromptContextItem[]; sendError: string | null }>;
  sending: Signal<boolean>;
  add: Signal<(Pick<TerminalSelectionSnapshot, "text" | "turnIds"> & { id?: string; kind?: PromptContextItem["kind"]; note?: string }) | undefined>;
  hydrate: Signal<PromptContextItem[] | undefined>;
  remove: Signal<string | undefined>;
  sent: Signal<{ ids: string[]; items: PromptContextItem[] } | undefined>;
  focusNote: Signal<string | undefined>;
  structuredToggle: Signal<{ selectable: StructuredSelectable; checked: boolean } | undefined>;
  gutter: HTMLElement;
  enabled: Signal<boolean>;
  effects: Observable<void>;
};

function completed<I, O>(endpoint: Endpoint<I, O>, input: I): Observable<O> {
  return createMutation(endpoint, of(input)).$.pipe(
    filter((result) => result.isSuccess || result.isError), take(1),
    concatMap((result) => result.isError ? throwError(() => result.error) : of(result.data as O)),
  );
}

export function contextQueueStream(
  term: Terminal, host: HTMLElement, visibility: TurnVisibilityModel, _anchors: LineAnchorModel,
  identity: PaneIdentity, ports: BoopXtermPorts,
): ContextQueueModel {
  const state = Signal({ items: [] as PromptContextItem[], sendError: null as string | null });
  const sending = Signal(false);
  const add = Signal<Pick<TerminalSelectionSnapshot, "text" | "turnIds"> & { id?: string; kind?: PromptContextItem["kind"]; note?: string }>();
  const hydrate = Signal<PromptContextItem[]>();
  const remove = Signal<string>();
  const sent = Signal<{ ids: string[]; items: PromptContextItem[] }>();
  const focusNote = Signal<string>();
  const structuredToggle = Signal<{ selectable: StructuredSelectable; checked: boolean }>();
  const enabled = toSignal(ports.inlineStructuredSelectors);
  const root = document.createElement("div");
  root.className = "term-context-root";
  const gutter = document.createElement("div");
  gutter.className = "term-context-gutter";
  const panel = document.createElement("section");
  panel.className = "term-context-queue";
  root.append(gutter, panel);

  const setItems = (items: PromptContextItem[], sendError = state.sendError.$()) => state.$({ items, sendError });
  const add$ = add.$.pipe(filter((snapshot) => snapshot !== undefined), tap((snapshot) => {
    if (!snapshot.text) return;
    const id = snapshot.id ?? `selection:${crypto.randomUUID()}`;
    const item: PromptContextItem = { id, kind: snapshot.kind ?? "selection", text: snapshot.text,
      note: snapshot.note, turnIds: snapshot.turnIds, enabled: true };
    setItems([...state.items.$().filter((prior) => prior.id !== id), item]);
    term.clearSelection();
  }));
  const hydrate$ = hydrate.$.pipe(filter((rows) => rows !== undefined), tap((rows) => {
    const current = state.items.$();
    const ids = new Set(current.map((item) => item.id));
    const incoming = rows.filter((item) => !ids.has(item.id));
    if (incoming.length) setItems([...current, ...incoming]);
  }));
  const remove$ = remove.$.pipe(filter((id) => id !== undefined), tap((id) => setItems(state.items.$().filter((item) => item.id !== id))));
  const toggle$ = structuredToggle.$.pipe(filter((value) => value !== undefined), tap(({ selectable, checked }) => {
    const items = state.items.$().filter((item) => item.id !== selectable.id);
    if (checked) items.push({ id: selectable.id, kind: selectable.kind, text: selectable.text,
      turnIds: [selectable.turnId], enabled: true });
    setItems(items);
  }));

  const effects = defer(() => {
    host.appendChild(root);
    const sendClicked = Signal<void>();
    const dom$ = new Observable<void>((subscriber) => {
      const onClick = (event: MouseEvent) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        if (target.closest("[data-context-send]")) { sendClicked.$(undefined); subscriber.next(); return; }
        const remove = target.closest<HTMLElement>("[data-context-remove]");
        const id = remove?.closest<HTMLElement>("[data-context-id]")?.dataset.contextId;
        if (id) { setItems(state.items.$().filter((item) => item.id !== id)); subscriber.next(); }
      };
      const onInput = (event: Event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
        const id = target.closest<HTMLElement>("[data-context-id]")?.dataset.contextId;
        if (!id) return;
        const items = state.items.$().map((item) => item.id !== id ? item : target instanceof HTMLTextAreaElement
          ? { ...item, note: target.value } : { ...item, enabled: target.checked });
        setItems(items);
        subscriber.next();
      };
      panel.addEventListener("click", onClick);
      panel.addEventListener("input", onInput);
      return function unsubscribe() {
        panel.removeEventListener("click", onClick);
        panel.removeEventListener("input", onInput);
      };
    });
    const send$ = sendClicked.$.pipe(exhaustMap(() => defer(() => {
      const items = state.items.$();
      const text = formatQueuedContext(items);
      if (!text) return EMPTY;
      sending.$(true);
      state.sendError.$(null);
      const exit$ = identity.graphics ? of(false) : completed(ports.boop_mux_exit_copy_mode,
        { target: identity.target, socket: identity.socket }).pipe(catchError(() => of(false)));
      return exit$.pipe(
        concatMap(() => completed(ports.write_pty, { id: identity.id, data: bracketedPaste(text) })),
        tap(() => {
          term.focus();
          sent.$({ ids: items.map((item) => item.id), items });
          setItems(state.items.$().filter((item) => !items.some((sentItem) => sentItem.id === item.id)), null);
        }),
        catchError((error: unknown) => { state.sendError.$(error instanceof Error ? error.message : String(error)); return EMPTY; }),
        finalize(() => sending.$(false)),
      );
    })));
    const render$ = merge(state.$, sending.$, visibility.state.visible.$).pipe(tap(() => {
      const items = state.items.$();
      const active = document.activeElement;
      const selection = active instanceof HTMLTextAreaElement && panel.contains(active)
        ? { id: active.closest<HTMLElement>("[data-context-id]")?.dataset.contextId,
            start: active.selectionStart, end: active.selectionEnd, direction: active.selectionDirection } : null;
      panel.replaceChildren();
      panel.hidden = items.length === 0;
      if (!items.length) return;
      const header = document.createElement("header");
      const title = document.createElement("span");
      title.className = "term-context-queue-title";
      title.textContent = `NEXT MESSAGE · ${items.length}`;
      header.append(title);
      if (state.sendError.$()) {
        const status = document.createElement("span");
        status.className = "term-context-queue-status";
        status.textContent = `send failed, kept: ${state.sendError.$()}`;
        header.append(status);
      }
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.contextSend = "";
      button.textContent = sending.$() ? "Sending…" : "Send";
      button.disabled = sending.$();
      header.append(button);
      panel.append(header);
      for (const item of items) {
        const row = document.createElement("div");
        row.className = "term-context-queue-item";
        row.dataset.contextId = item.id;
        row.dataset.disabled = String(!item.enabled);
        const meta = document.createElement("div");
        meta.className = "term-context-queue-meta";
        const check = document.createElement("input");
        check.type = "checkbox";
        check.checked = item.enabled;
        meta.append(check);
        for (const id of item.turnIds.length ? item.turnIds : [""]) {
          const chip = document.createElement("span");
          chip.className = "term-context-queue-turn";
          const turn = visibility.state.visible.$().find((candidate) => candidate.id === id);
          chip.textContent = id ? turn ? `t${turn.turn} ${turn.role}` : `t${id.slice(id.lastIndexOf(":") + 1)}` : "terminal";
          chip.dataset.turnId = id;
          if (id) chip.style.setProperty("--boop-xterm-chip-hue", String(turnHue(id)));
          meta.append(chip);
        }
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "term-context-queue-remove";
        remove.dataset.contextRemove = "";
        remove.textContent = "×";
        meta.append(remove);
        const quote = document.createElement("pre");
        quote.className = "term-context-queue-quote";
        quote.textContent = item.text;
        const note = document.createElement("textarea");
        note.className = "term-context-queue-note";
        note.value = item.note ?? "";
        note.rows = 2;
        note.placeholder = "what you want done with this…";
        row.append(meta, quote, note);
        panel.append(row);
      }
      if (selection?.id) {
        const note = panel.querySelector<HTMLTextAreaElement>(`[data-context-id="${CSS.escape(selection.id)}"] textarea`);
        note?.focus({ preventScroll: true });
        note?.setSelectionRange(selection.start, selection.end, selection.direction);
      }
    }), map(() => void 0));
    const focus$ = focusNote.$.pipe(filter((id) => id !== undefined), concatMap((id) => new Observable<void>((subscriber) => {
      const frame = requestAnimationFrame(() => {
        panel.querySelector<HTMLTextAreaElement>(`[data-context-id="${CSS.escape(id)}"] textarea`)?.focus({ preventScroll: true });
        subscriber.next(); subscriber.complete();
      });
      return function unsubscribe() { cancelAnimationFrame(frame); };
    })));
    return merge(dom$, add$, hydrate$, remove$, toggle$, send$, render$, focus$).pipe(
      map(() => void 0),
      finalize(() => root.remove()),
    );
  });
  return { state, sending, add, hydrate, remove, sent, focusNote, structuredToggle, gutter, enabled, effects };
}
