import { lazy, Suspense } from "react";
import type { MdFenceProps, MdPlugin } from "./0_types.js";

// The renderer chunk loads when the first d2 fence renders; the d2 wasm loads inside it.
const D2Fence = lazy(() => import("./1_D2Fence.js"));

function LazyD2Fence(props: MdFenceProps) {
  return (
    <Suspense fallback={<pre><code>{props.code}</code></pre>}>
      <D2Fence {...props} />
    </Suspense>
  );
}

export function d2Plugin(): MdPlugin {
  return { name: "d2", fence: { languages: ["d2"], component: LazyD2Fence } };
}
