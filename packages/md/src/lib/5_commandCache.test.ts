import { firstValueFrom, Observable, of, Subject } from "rxjs";
import { expect, it } from "vitest";
import type { MdFenceCommandRequest, MdFenceCommandResult, MdFenceCommandRunner } from "../plugins/0_types.js";
import { cachedFenceCommandRunner } from "./5_commandCache.js";

const request = (overrides: Partial<MdFenceCommandRequest> = {}): MdFenceCommandRequest => ({
  command: "prettier --print-width $WIDTH",
  language: "ts",
  text: "const a={b:1}\n",
  columns: 72,
  ...overrides,
});

const answer: MdFenceCommandResult = { stdout: "const a = { b: 1 };\n", stderr: "", code: 0 };

it("replays a settled result without rerunning the host", async () => {
  let calls = 0;
  const gate = new Subject<MdFenceCommandResult>();
  const run: MdFenceCommandRunner = () => {
    calls += 1;
    return gate;
  };
  const cached = cachedFenceCommandRunner(run);
  const first = firstValueFrom(cached(request()));
  gate.next(answer);
  gate.complete();
  await expect(first).resolves.toEqual(answer);
  await expect(firstValueFrom(cached(request()))).resolves.toEqual(answer);
  expect(calls).toBe(1);
});

it("shares one in-flight run across consumers", async () => {
  // lib ES2022: no Promise.withResolvers, so the resolver is stored by hand.
  let resolve: (() => void) | undefined;
  const promise = new Promise<void>((settle) => {
    resolve = settle;
  });
  let subscriptions = 0;
  const run: MdFenceCommandRunner = () => new Observable((subscriber) => {
    subscriptions += 1;
    void promise.then(() => {
      subscriber.next(answer);
      subscriber.complete();
    });
  });
  const cached = cachedFenceCommandRunner(run);
  const ask = request({ text: "const b={c:2}\n" });
  const received: MdFenceCommandResult[] = [];
  const first = cached(ask).subscribe((result) => received.push(result));
  const second = cached(ask).subscribe((result) => received.push(result));
  expect(subscriptions).toBe(1);
  resolve?.();
  await promise;
  expect(received).toEqual([answer, answer]);
  expect(subscriptions).toBe(1);
  first.unsubscribe();
  second.unsubscribe();
});

it("cancels the host only when the last consumer walks away", () => {
  let subscriptions = 0;
  let tornDown = 0;
  const run: MdFenceCommandRunner = () => new Observable(() => {
    subscriptions += 1;
    return () => {
      tornDown += 1;
    };
  });
  const cached = cachedFenceCommandRunner(run);
  const ask = request({ text: "const d={e:3}\n" });
  const first = cached(ask).subscribe();
  const second = cached(ask).subscribe();
  expect(subscriptions).toBe(1);
  first.unsubscribe();
  expect(tornDown).toBe(0);
  second.unsubscribe();
  expect(tornDown).toBe(1);
  cached(ask).subscribe().unsubscribe();
});

it("forgets the least recently used entry beyond the bound", () => {
  const calls = new Map<string, number>();
  const run: MdFenceCommandRunner = (ask) => {
    calls.set(ask.text, (calls.get(ask.text) ?? 0) + 1);
    return new Observable((subscriber) => {
      subscriber.next(answer);
      subscriber.complete();
    });
  };
  const cached = cachedFenceCommandRunner(run);
  const warm = (text: string): void => {
    cached(request({ text })).subscribe().unsubscribe();
  };
  for (let index = 0; index < 200; index += 1) warm(`const v${index}=1;\n`);
  warm("const a4={b:1}\n");
  for (let index = 0; index < 199; index += 1) warm(`const w${index}=2;\n`);
  warm("const z=3;\n");
  warm("const a4={b:1}\n");
  expect(calls.get("const a4={b:1}\n")).toBe(2);
});

it("keeps runs apart when the request differs", () => {
  let calls = 0;
  const run: MdFenceCommandRunner = () => new Observable((subscriber) => {
    calls += 1;
    subscriber.next(answer);
    subscriber.complete();
  });
  const cached = cachedFenceCommandRunner(run);
  cached(request({ text: "const f={g:4}\n" })).subscribe().unsubscribe();
  cached(request({ text: "const h={i:5}\n", columns: 64 })).subscribe().unsubscribe();
  cached(request({ text: "const j={k:6}\n", language: "tsx" })).subscribe().unsubscribe();
  cached(request({ text: "const l={m:7}\n", command: "other" })).subscribe().unsubscribe();
  expect(calls).toBe(4);
});

it("delivers a run that answers synchronously on subscribe", async () => {
  const run: MdFenceCommandRunner = () => of(answer);
  const cached = cachedFenceCommandRunner(run);
  await expect(firstValueFrom(cached(request({ text: "const sync=1;\n" })))).resolves.toEqual(answer);
});

it("does not serve one fence's answer for another on a key collision", async () => {
  // These two texts collide under the cache's FNV-1a 32-bit text hash
  // (computed offline); the stored answer must still be checked against the
  // full text instead of trusting the bucket key.
  const collide = ["const x=10536;\n", "const x=105100;\n"];
  const run: MdFenceCommandRunner = (ask) => of({ stdout: `formatted:${ask.text.trim()}`, stderr: "", code: 0 });
  const cached = cachedFenceCommandRunner(run);
  await expect(firstValueFrom(cached(request({ text: collide[0] })))).resolves.toEqual({ stdout: "formatted:const x=10536;", stderr: "", code: 0 });
  await expect(firstValueFrom(cached(request({ text: collide[1] })))).resolves.toEqual({ stdout: "formatted:const x=105100;", stderr: "", code: 0 });
});
