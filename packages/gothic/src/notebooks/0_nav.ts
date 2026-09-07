import type { Link } from "../kit/3_section.js"
import "../../nav.js"

declare global {
  interface Window {
    GOTHIC_LINKS: readonly Link[]
    GOTHIC_HREF: (l: Link) => string
  }
}
// nav.js is the single list of pages; as a module import it only publishes window.GOTHIC_LINKS
export const LINKS: readonly Link[] = window.GOTHIC_LINKS
export const hrefFor = (l: Link): string => window.GOTHIC_HREF(l)
