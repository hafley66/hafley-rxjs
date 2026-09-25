import { useMemo } from "react";
import { parseMarbles } from "@hafley66/signal-marbles";
import { MarbleDiagram, useMarblePlayer } from "@hafley66/signal-marbles/react";
import "@hafley66/signal-marbles/marbles.css";
import type { MdFenceProps } from "./0_types.js";

// The notation reader and the surface are signal-marbles' own; md adds the fence frame, the
// diagnostics, and the theme attribute its stylesheet keys the `--mb-*` palette on.
export default function MarblesFence({ code, dark }: MdFenceProps) {
  const { doc, diagnostics } = useMemo(() => parseMarbles(code), [code]);
  const player = useMarblePlayer(doc);
  return (
    <div className="mdview-marbles" data-diagram-theme={dark ? "dark" : "light"}>
      {diagnostics.length > 0 && (
        <pre className="mdview-marbles-error">
          {diagnostics.map((diagnostic) => `line ${diagnostic.line}: ${diagnostic.message}`).join("\n")}
        </pre>
      )}
      <MarbleDiagram player={player} />
    </div>
  );
}
