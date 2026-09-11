// The five recordings from `tests/2_visual.e2e.test.ts`, as data a docs page can list.
//
// `src` is relative and carries no leading slash, so it resolves against whatever base a built site
// is served from. The files themselves are written by the visual run into `out/visual/mp4/`, which
// is outside any site root, so a site build has to copy that directory to `videos/` beside its own
// index. `sourcePath` names what to copy from, and `scripts/examples.mjs` fails the run when an
// entry marked present has no file there.
import type { FeatureId } from "../src/features.js"

export interface Recording {
  readonly id: string
  readonly title: string
  /** What watching it establishes, in one line. */
  readonly proves: string
  readonly features: readonly FeatureId[]
  /** Relative to the site root. Copy `sourcePath` here at build time. */
  readonly src: string
  readonly sourcePath: string
  readonly seconds: number
  readonly kilobytes: number
  /** The assertions in `tests/2_visual.e2e.test.ts` that gate the clip. */
  readonly assertions: readonly string[]
  /** Measured numbers, from `docs/4_proof.md`. */
  readonly measured: readonly string[]
  /** True when the mp4 was absent at the time this entry was written. */
  readonly missing: boolean
}

const CLIP = "tests-2-visual-e2e-test__"

const clip = (slug: string): { src: string; sourcePath: string } => ({
  src: `videos/${CLIP}${slug}.mp4`,
  sourcePath: `out/visual/mp4/${CLIP}${slug}.mp4`,
})

export const VIDEOS: readonly Recording[] = [
  {
    id: "css-customization",
    title: "CSS customization",
    proves: "A retheme is a custom property write on the grid root, and light-dark pairs re-resolve with no re-render.",
    features: ["view.theme", "view.density"],
    ...clip("css-custom-properties-on-the-grid-root-retheme-live-rows-and-light-dark-flips-wi"),
    seconds: 5.64,
    kilobytes: 53,
    assertions: [
      "boxOf(row).height === 36, then 52 after --sg-row-h: 52px",
      'computed margin-inline-start on .sg-expander === "16px", then "40px" after --sg-indent: 40px',
      'selected row background-color === "rgb(255, 64, 129)" and its sibling === "rgb(255, 255, 255)"',
      'dark scheme: grid root background "rgb(20, 22, 26)", color "rgb(230, 232, 234)", unselected row flips too',
      'light scheme: background "rgb(255, 255, 255)", color "rgb(26, 28, 31)"',
      'density "compact": row height 28 and --sg-row-h reads "28px", so the renderer reclaims the override',
    ],
    measured: [
      "tree data, 3 folders by 4 leaves, expanded: { p0: true }",
      "row 36 px at standard, 52 px overridden, 28 px compact",
      "indent 16 px, then 40 px",
    ],
    missing: false,
  },
  {
    id: "column-resize",
    title: "Column resize by dragging",
    proves: "A resize is one state write that the header band and every row band read, and it touches exactly one column.",
    features: ["col.resize", "col.size"],
    ...clip("dragging-the-resize-handle-with-a-real-pointer-widens-one-column-and-leaves-its-"),
    seconds: 2.96,
    kilobytes: 76,
    assertions: [
      "during the drag, the size cell width equals [140, 160, 180, 200, 220, 240]",
      "after release, the size row cell and the size header cell are both 240",
      "the model agrees: widths().size === 240",
      'getComputedStyle(root).getPropertyValue("--sg-inline-tracks") === "220px 240px 140px 160px"',
      "neighbour name keeps width 220 and its x across the whole drag",
      "neighbour kind keeps width 140",
    ],
    measured: [
      "40 flat rows, columns Name 220 / Size 120 / Kind 140 / Owner 160, all resizable",
      "six mouse.move calls of +20 px each with a dwell between",
    ],
    missing: false,
  },
  {
    id: "virtualization",
    title: "Virtualization",
    proves: "The model holds 5000 rows and the document holds around 25, and the two stay in agreement while the list scrolls.",
    features: ["view.virtualize.row", "view.scroll"],
    ...clip("5000-rows-recycle-through-a-bounded-dom-and-turning-virtualization-off-renders-t"),
    seconds: 9.32,
    kilobytes: 168,
    assertions: [
      "flatCount() === 5000 at every step",
      "every windowed DOM count is greater than 0 and under 60",
      "planned() equals the DOM count at each step, so the plan and the document never disagree",
      "the five first-row keys are all distinct, which is the recycling claim",
      'the clamped end window contains "r4999" and scrollTop clears 170,000',
      "virtualize.vertical: false puts 5000 rows in the document and 5000 in plan.center, first r0 and last r4999",
      "virtualize.vertical: true rebounds to under 60 rows, starting at the key it left from",
    ],
    measured: [
      "5000 flat rows, scroll box 620 px tall, overscan 4",
      "mounted 22 rows, mid-scroll 26, clamped end 21",
      "peak ratio 5000 model rows to 26 DOM rows, 192 to 1",
    ],
    missing: false,
  },
  {
    id: "column-order",
    title: "Column order model",
    proves: "One array orders the header band and all twelve row bands; a header-only reorder would fail this.",
    features: ["col.order"],
    ...clip("state-colorder-drives-the-header-band-and-every-row-band-from-one-model"),
    seconds: 3.16,
    kilobytes: 64,
    assertions: [
      "headerOrder() equals the written colOrder after each of the three writes",
      "cellOrder() has 12 rows and every one equals the header sequence",
      "__grid.order(), read off g.view.cols, matches the document in the same tick",
    ],
    measured: [
      "12 flat rows, columns Name / Size / Kind / Owner",
      'writes: ["name","size","kind","owner"], ["kind","owner","name","size"], ["owner","name","size","kind"]',
    ],
    missing: false,
  },
  {
    id: "column-visibility",
    title: "Column visibility",
    proves: "Hiding is a model operation: the cells leave the document, the remaining flex columns take the freed width, and unhiding restores rank.",
    features: ["col.visible", "col.size"],
    ...clip("hiding-a-column-removes-it-from-both-bands-and-reflows-the-rest-and-unhiding-ret"),
    seconds: 3.12,
    kilobytes: 61,
    assertions: [
      "the hidden header cell and its 12 row cells both reach toHaveCount(0)",
      'every row cell sequence equals ["name", "size", "owner"] while kind is hidden',
      "both remaining widths are strictly greater than before the hide",
      "round(name / size) === 2, so the 2:1:1 flex ratio survived the reflow",
      'on unhide, headerOrder().indexOf("kind") === 2, its rank in colOrder rather than the end',
      "both widths round back to their pre-hide values",
    ],
    measured: [
      "12 flat rows, Name flex 2 minWidth 120, Size / Kind / Owner flex 1 minWidth 80, available width 1344 px",
      "all visible: Name 536.80, Size 268.39",
      "kind hidden: Name 671.00, Size 335.50",
    ],
    missing: false,
  },
]

export const videoById = (id: string): Recording | undefined => VIDEOS.find((v) => v.id === id)
