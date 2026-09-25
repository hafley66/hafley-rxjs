import { isCodeRef } from "../lib/0_codeRef.js";
import { getMdviewHost } from "../ports.js";
import type { MdInlineCodeProps } from "./0_types.js";

// Streamdown's own inline code markup, plus a ⌘-click that hands a
// file-citing span to the host with this document's path.
export function CodeRef({ node: _node, doc, className, children, ...rest }: MdInlineCodeProps) {
  const host = getMdviewHost();
  const path = doc.path;
  const text = typeof children === "string" ? children : "";
  const openCodeRef = host.openCodeRef;
  const ref = openCodeRef !== undefined && isCodeRef(text);
  // Native, on the element: a table's grid delegates from its own root, which
  // a React stopPropagation reaches only after the grid selected the cell.
  const own = (element: HTMLElement | null) => {
    if (element === null || !ref) return;
    const swallow = (e: globalThis.MouseEvent) => {
      if (!e.metaKey) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.type === "click") void openCodeRef.call(host, text, path).catch(console.error);
    };
    const types = ["pointerdown", "mousedown", "pointerup", "mouseup", "click"] as const;
    types.forEach((type) => element.addEventListener(type, swallow));
    return () => types.forEach((type) => element.removeEventListener(type, swallow));
  };
  return (
    <code
      {...rest}
      ref={own}
      className={["rounded bg-muted px-1.5 py-0.5 font-mono text-sm", className].filter(Boolean).join(" ")}
      data-streamdown="inline-code"
      data-md-ref={ref ? "" : undefined}
    >
      {children}
    </code>
  );
}
