# Reading this site

Every concept page carries a grid you can drive and a source file you can edit. The panel is the
documentation; the prose around it says what to look at.

<GridDemo id="multi-sort" />

## The panel, part by part

| part | what it shows |
| --- | --- |
| title and summary | the one sentence the example itself declares |
| the stage | a real grid, mounted from the same file that ships in `examples/` |
| the timing strip | milliseconds for the stages that ran, plus a live frame rate |
| the tabs | `Preview` shows the grid, `Edit` shows the source in an editor |
| `Reset` | restores the shipped source and remounts it |

## Editing one

Open `Edit`, change a value, and stop typing. Three hundred milliseconds later the previous grid is
torn down and a new one is built from your text. A syntax error prints beside the stage and leaves
the running grid alone, so a half-typed line never blanks the page.

Try it on the panel above: change the seeded sort to a single descending key on `size`, and the
header band and the row order both move.

An edit that takes longer than two seconds stops re-running on its own and offers a `Run` button, so
a slow edit cannot repeat itself into a stall.

## Where the source comes from

No page copies an example's text. Each example imports its own file as a string, so the panel shows
the file you would commit, and an edit to `examples/2_multi_sort.ts` changes the page with no doc
edit at all.

The registry is `examples/index.ts`. A page names an example by its id, and an id that does not
exist renders a visible error rather than an empty box.

## Pages with no panel

Reference, Why, and Receipts pages carry no grid. A leaf under a concept group with no panel says in
one sentence that the feature is not built, and names what is missing.

## The full-screen routes

Four larger applications live under [Showcase](/showcase-everything). Each one mounts a grid over
real data volumes with a control panel and a readout, which is where scale and interaction are
easier to judge than in a page-sized panel.
