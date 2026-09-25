import { lazy, Suspense } from "react";
import type { MdFenceProps, MdPlugin } from "./0_types.js";

// The renderer chunk (signal-marbles' parser, player, and surface) loads when the first marbles
// fence renders.
const MarblesFence = lazy(() => import("./1_MarblesFence.js"));

function LazyMarblesFence(props: MdFenceProps) {
  return (
    <Suspense fallback={<pre><code>{props.code}</code></pre>}>
      <MarblesFence {...props} />
    </Suspense>
  );
}

export function marblesPlugin(): MdPlugin {
  return { name: "marbles", fence: { languages: ["marbles"], component: LazyMarblesFence } };
}
