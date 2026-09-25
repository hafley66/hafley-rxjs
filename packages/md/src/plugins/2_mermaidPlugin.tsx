import { lazy, Suspense } from "react";
import type { MdFenceProps, MdPlugin } from "./0_types.js";

// The renderer chunk (mermaid itself) loads when the first mermaid fence renders.
const MermaidFence = lazy(() => import("./1_MermaidFence.js"));

function LazyMermaidFence(props: MdFenceProps) {
  return (
    <Suspense fallback={<pre><code>{props.code}</code></pre>}>
      <MermaidFence {...props} />
    </Suspense>
  );
}

export function mermaidPlugin(): MdPlugin {
  return { name: "mermaid", fence: { languages: ["mermaid"], component: LazyMermaidFence } };
}
