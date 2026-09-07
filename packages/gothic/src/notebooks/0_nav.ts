import type { Link } from "../kit/3_section.js"

// legacy entries are single-file notebooks outside the kit (listed in AGENTS.md)
export const LINKS: readonly Link[] = [
  { id: "eye", href: "eye.html", sections: ["eye"] },
  { id: "slice", href: "slice.html", sections: ["slice"] },
  { id: "icons", href: "icons.html", sections: ["icons", "seal"] },
  { id: "border", href: "border.html", sections: ["border"] },
  { id: "fractal", href: "fractal.html", sections: ["apollonian", "foils", "lsys", "cusping", "hilbert"] },
  { id: "index", href: "index.html", legacy: true },
  { id: "arches", href: "arches.html", legacy: true },
  { id: "circles", href: "circles.html", legacy: true },
]
