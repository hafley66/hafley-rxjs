import { legacyPage } from "../kit/index.js"
import { LINKS } from "./0_nav.js"

// loaded by the legacy single-file notebooks: shared header + scroll-driven section anchors, nothing else
const id =
  location.pathname
    .split("/")
    .pop()
    ?.replace(/\.html$/, "") || "index"
legacyPage({ id, title: document.title, links: LINKS })
