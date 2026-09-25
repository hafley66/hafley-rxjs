import type { MouseEvent } from "react";
import { resolveMdLink } from "../model.js";
import { setPendingFrag } from "../open.js";
import { getMdviewHost } from "../ports.js";
import type { MdLinkProps } from "./0_types.js";

// `#id` jumps within the document, a markdown file navigates the panel in place,
// anything else goes to the host's openHref.
export function MdLink({ href, children, doc }: MdLinkProps) {
  const host = getMdviewHost();
  const path = doc.path;
  const onClick = (e: MouseEvent) => {
    if (!href) return;
    e.preventDefault();
    if (href.startsWith("#")) {
      doc.jumpTo(decodeURIComponent(href.slice(1)));
      return;
    }
    const md = resolveMdLink(path, href);
    if (md) {
      // In-place navigation (docs-browser style): the explorer follows
      // the new doc's folder; external opens still get their own tabs.
      setPendingFrag(md.path, md.frag);
      doc.onNavigate(md.path);
      return;
    }
    void host.openHref(href, path).catch(console.error);
  };
  return (
    <a href={href} onClick={onClick}>
      {children}
    </a>
  );
}
