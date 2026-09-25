import { useMemo } from "react";
import * as runtime from "react/jsx-runtime";
import { from } from "rxjs";
import { evaluate } from "@mdx-js/mdx";
import { parse } from "codehike";
import { Pre, type RawCode } from "codehike/code";
import { recmaCodeHike, remarkCodeHike, type CodeHikeConfig } from "codehike/mdx";
import { Selectable, Selection, SelectionProvider } from "codehike/utils/selection";
import { Signal } from "@hafley66/signals";
import { useSignal } from "@hafley66/signals/react";
import { mark, tokenTransitions, useHighlightedAll } from "./0_handlers.js";

const fence = "```";

export const SCROLLY_MDX = [
  "## !!steps Start with a source",
  "",
  "An interval emits forever.",
  "",
  `${fence}ts ! app.ts`,
  "const ticks$ = interval(1000)",
  fence,
  "",
  "## !!steps Shape the values",
  "",
  "`map` turns each tick into a label.",
  "",
  `${fence}ts ! app.ts`,
  "const ticks$ = interval(1000).pipe(",
  "  // !mark",
  "  map((n) => `tick ${n}`),",
  ")",
  fence,
  "",
  "## !!steps Bound it",
  "",
  "`take(3)` completes the stream.",
  "",
  `${fence}ts ! app.ts`,
  "const ticks$ = interval(1000).pipe(",
  "  map((n) => `tick ${n}`),",
  "  // !mark",
  "  take(3),",
  ")",
  fence,
].join("\n");

const CONFIG: CodeHikeConfig = { components: { code: "Code" } };

interface ScrollyStep {
  title: string;
  children: React.ReactNode;
  code: RawCode;
}

// parse() calls the compiled MDX function with _returnBlocks; recmaCodeHike made it return the block tree.
async function scrollySteps(source: string): Promise<readonly ScrollyStep[]> {
  const mod = await evaluate(source, { ...runtime, remarkPlugins: [[remarkCodeHike, CONFIG]], recmaPlugins: [[recmaCodeHike, CONFIG]] });
  const blocks: { steps: ScrollyStep[] } = parse(mod.default);
  return blocks.steps;
}

function ScrollyCode({ steps }: { steps: readonly ScrollyStep[] }) {
  const raws = useMemo(() => steps.map((step) => step.code), [steps]);
  const codes = useHighlightedAll(raws);
  return codes ? <Selection from={codes.map((code) => <Pre code={code} handlers={[tokenTransitions, mark]} className="ch-pre" />)} /> : null;
}

export function ScrollyDemo() {
  const signal = useMemo(() => Signal<readonly ScrollyStep[] | null>(from(scrollySteps(SCROLLY_MDX)), null), []);
  const steps = useSignal(signal.$);
  return (
    <section data-demo="scrolly">
      <h2>3. Scrollycoding: MDX + remarkCodeHike/recmaCodeHike + parse, prose beside a sticky code panel</h2>
      {steps ? (
        <SelectionProvider className="ch-scrolly">
          <div className="ch-scrolly-steps">
            {steps.map((step, index) => (
              <Selectable key={step.title} index={index} selectOn={["click", "scroll"]} className="ch-scrolly-step">
                <h3>{step.title}</h3>
                {step.children}
              </Selectable>
            ))}
          </div>
          <div>
            <div className="ch-scrolly-sticky">
              <ScrollyCode steps={steps} />
            </div>
          </div>
        </SelectionProvider>
      ) : null}
    </section>
  );
}
