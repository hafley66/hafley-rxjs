import { useMemo } from "react";
import { Pre } from "codehike/code";
import StreamdownBody from "../../src/0_Streamdown.js";
import { codePlugin, type MdFenceProps, type MdPlugin } from "../../src/plugins/index.js";
import { stepsPlugin } from "../../src/plugins/steps.js";
import { MdPluginContext, type MdPluginScope } from "../../src/plugins/4_MdPluginContext.js";
import { callout, focus, mark, useHighlighted } from "./0_handlers.js";

// A plain md fence: ```hike <lang> ... Code Hike comments inside the body. No MDX in this path.
function HikeFence({ code, meta }: MdFenceProps) {
  const lang = meta?.trim().split(/\s+/)[0] || "txt";
  const raw = useMemo(() => ({ value: code, lang, meta: "" }), [code, lang]);
  const highlighted = useHighlighted(raw);
  return highlighted ? <Pre code={highlighted} handlers={[mark, focus, callout]} className="ch-pre" /> : <pre>{code}</pre>;
}

export const hikeLabPlugin = (): MdPlugin => ({ name: "codehike-lab", fence: { languages: ["hike"], component: HikeFence } });

const fence = "```";
export const FENCE_MARKDOWN = [
  "Streamdown renders this paragraph; the fence below goes to the `hike` plugin.",
  "",
  `${fence}hike rust`,
  "fn main() {",
  "    // !mark",
  "    let total: u32 = (1..=10).sum();",
  "    // !callout[/println/] a macro, hence the bang",
  '    println!("{total}");',
  "}",
  fence,
  "",
].join("\n");

const SCOPE: MdPluginScope = { plugins: [hikeLabPlugin(), stepsPlugin(), codePlugin()], columns: 80 };

export function FenceDemo() {
  return (
    <section data-demo="fence">
      <h2>4. Fed by an md fence through StreamdownBody + an MdPlugin</h2>
      <MdPluginContext.Provider value={SCOPE}>
        <StreamdownBody components={{}} dark>{FENCE_MARKDOWN}</StreamdownBody>
      </MdPluginContext.Provider>
    </section>
  );
}

export const STEPS_MARKDOWN = [
  "The shipped `stepsPlugin()`: a ```` ```steps ```` fence whose later states are unified-diff hunks.",
  "",
  `${fence}steps ts`,
  "--- step start",
  "const total = items.length",
  "--- step count done items",
  "@@ -1 +1,3 @@",
  "-const total = items.length",
  "+const total = items",
  "+  .filter((item) => item.done)",
  "+  .length",
  "--- step sum costs",
  "@@ -1,3 +1,3 @@",
  " const total = items",
  "   .filter((item) => item.done)",
  "-  .length",
  "+  .reduce((sum, item) => sum + item.cost, 0)",
  fence,
  "",
].join("\n");

export function StepsPluginDemo() {
  return (
    <section data-demo="steps-plugin">
      <h2>6. stepsPlugin(): Code Hike Pre + token transitions over md's own shiki tokens</h2>
      <MdPluginContext.Provider value={SCOPE}>
        <StreamdownBody components={{}} dark>{STEPS_MARKDOWN}</StreamdownBody>
      </MdPluginContext.Provider>
    </section>
  );
}
