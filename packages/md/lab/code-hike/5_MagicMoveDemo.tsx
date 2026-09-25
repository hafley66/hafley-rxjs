import { useMemo } from "react";
import { from } from "rxjs";
import { ShikiMagicMove } from "@shikijs/magic-move/react";
import "@shikijs/magic-move/style.css";
import { createHighlighterCore, type HighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import { Signal } from "@hafley66/signals";
import { useSignal } from "@hafley66/signals/react";
import { TRANSITION_STEPS } from "./2_TransitionsDemo.js";

const highlighter = () => createHighlighterCore({
  engine: createJavaScriptRegexEngine(),
  themes: [import("shiki/themes/github-dark.mjs")],
  langs: [import("shiki/langs/typescript.mjs")],
});

const STRIPPED = TRANSITION_STEPS.map((step) => step.value.replace(/^\s*\/\/ !.*\n/gm, ""));

export function MagicMoveDemo() {
  const step = useMemo(() => Signal(0), []);
  const index = useSignal(step.$);
  const hl = useMemo(() => Signal<HighlighterCore | null>(from(highlighter()), null), []);
  const core = useSignal(hl.$);
  const last = STRIPPED.length - 1;
  return (
    <section data-demo="magic-move">
      <h2>5. Same steps through @shikijs/magic-move (comparison)</h2>
      <div className="ch-controls">
        <button type="button" disabled={index === 0} onClick={() => step.$(index - 1)}>prev</button>
        <span>{`${index + 1} / ${STRIPPED.length}`}</span>
        <button type="button" disabled={index === last} onClick={() => step.$(index + 1)}>next</button>
      </div>
      {core ? <ShikiMagicMove highlighter={core} lang="ts" theme="github-dark" code={STRIPPED[index]} className="ch-pre" /> : null}
    </section>
  );
}
