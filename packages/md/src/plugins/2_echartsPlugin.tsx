import { lazy, Suspense } from "react";
import type { MdFenceProps, MdPlugin } from "./0_types.js";

// The renderer chunk (echarts/core plus the line chart, grid, tooltip, legend, dataZoom, title
// and canvas renderer) loads when the first echarts fence renders.
const EchartsFence = lazy(() => import("./1_EchartsFence.js"));

function LazyEchartsFence(props: MdFenceProps) {
  return (
    <Suspense fallback={<pre><code>{props.code}</code></pre>}>
      <EchartsFence {...props} />
    </Suspense>
  );
}

export function echartsPlugin(): MdPlugin {
  return { name: "echarts", fence: { languages: ["echarts"], component: LazyEchartsFence } };
}
