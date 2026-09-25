import { useMemo } from "react";
import { Pre, type RawCode } from "codehike/code";
import { Signal } from "@hafley66/signals";
import { useSignal } from "@hafley66/signals/react";
import { mark, tokenTransitions, useHighlightedAll } from "./0_handlers.js";

export const TRANSITION_STEPS: readonly RawCode[] = [
  `const total = items.length`,
  `const total = items
  .filter((item) => item.done)
  .length`,
  `// !mark(2:3)
const total = items
  .filter((item) => item.done)
  .reduce((sum, item) => sum + item.cost, 0)`,
].map((value) => ({ value, lang: "ts", meta: "" }));

export function TransitionsDemo() {
  const step = useMemo(() => Signal(0), []);
  const index = useSignal(step.$);
  const codes = useHighlightedAll(TRANSITION_STEPS);
  const last = TRANSITION_STEPS.length - 1;
  return (
    <section data-demo="transitions">
      <h2>2. Token transitions between steps (codehike/utils/token-transitions)</h2>
      <div className="ch-controls">
        <button type="button" disabled={index === 0} onClick={() => step.$(index - 1)}>prev</button>
        <span data-step-label>{`${index + 1} / ${TRANSITION_STEPS.length}`}</span>
        <button type="button" disabled={index === last} onClick={() => step.$(index + 1)}>next</button>
      </div>
      {codes ? <Pre code={codes[index]} handlers={[tokenTransitions, mark]} className="ch-pre" /> : null}
    </section>
  );
}
