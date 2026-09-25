import { lazy, Suspense } from "react";
import type { MdFenceProps, MdPlugin } from "./0_types.js";

// The chunk (Code Hike's Pre + token transitions, jsdiff) loads when the first steps fence renders.
const StepsFence = lazy(() => import("./1_StepsFence.js"));

function LazyStepsFence(props: MdFenceProps) {
  return (
    <Suspense fallback={<pre><code>{props.code}</code></pre>}>
      <StepsFence {...props} />
    </Suspense>
  );
}

/** ```steps <lang> fences: states split by `--- step <title>`, a segment may be a unified-diff patch. */
export function stepsPlugin(): MdPlugin {
  return { name: "steps", fence: { languages: ["steps"], component: LazyStepsFence } };
}
