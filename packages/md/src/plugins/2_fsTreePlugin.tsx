import { lazy, Suspense } from "react";
import type { MdFenceProps, MdPlugin } from "./0_types.js";

// The renderer chunk (signal-grid and the tree stylesheet) loads when the first tree fence renders.
const FsTreeFence = lazy(() => import("./1_FsTreeFence.js"));

function LazyFsTreeFence(props: MdFenceProps) {
  return (
    <Suspense fallback={<pre><code>{props.code}</code></pre>}>
      <FsTreeFence {...props} />
    </Suspense>
  );
}

export function fsTreePlugin(): MdPlugin {
  return { name: "fs-tree", fence: { languages: ["tree", "ls", "fs"], component: LazyFsTreeFence } };
}
