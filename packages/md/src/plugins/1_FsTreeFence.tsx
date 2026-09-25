import { useMemo } from "react";
import { FsTreeView } from "@hafley66/signal-grid/react";
import "@hafley66/signal-grid/theme.css";
import "@hafley66/signal-grid/tree.css";
import { parseFsTree } from "../lib/0_fsTree.js";
import type { MdFenceProps } from "./0_types.js";
import "./1_fsTree.css";

export default function FsTreeFence({ code }: MdFenceProps) {
  const model = useMemo(() => parseFsTree(code), [code]);
  return (
    <section className="mdview-fs-tree" aria-label="File tree" data-format={model.format}>
      <FsTreeView rows={model.roots} />
    </section>
  );
}
