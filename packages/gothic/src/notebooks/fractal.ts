import { FRACTALS } from "../algos/1_fractal.js"
import { algoSection, page } from "../kit/index.js"
import { LINKS, hrefFor } from "./0_nav.js"

page({ id: "fractal", title: "gothic: fractal generators", links: LINKS, href: hrefFor })
const SIZES = [48, 96, 160, 320] as const
for (const algo of FRACTALS) algoSection(algo as never, SIZES)
