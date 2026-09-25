import { Pre } from "codehike/code";
import { callout, focus, mark, useHighlighted } from "./0_handlers.js";

const SOURCE = `import { interval } from "rxjs"
import { map, take } from "rxjs/operators"

// !focus(1:5)
const ticks$ = interval(250).pipe(
  // !mark
  map((n) => n * 2),
  // !callout[/take/] completes after three values
  take(3),
)

export default ticks$`;

const RAW = { value: SOURCE, lang: "ts", meta: "" };

export function AnnotatedDemo() {
  const code = useHighlighted(RAW);
  return (
    <section data-demo="annotated">
      <h2>1. Annotations: mark, focus, callout (codehike/code, no MDX)</h2>
      {code ? <Pre code={code} handlers={[mark, focus, callout]} className="ch-pre" /> : <pre>{SOURCE}</pre>}
    </section>
  );
}
