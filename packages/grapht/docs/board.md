# The board

A graph is topology. A board is topology plus placed items: a section, a fence, a sticky, an SVG —
each one an item with a position, an item whose identity is the `locatorHash` of the address it came
from. Drag the cards below. Then press *Insert a block above the fence* and watch what does not move.

<BoardDemo />

## What you are looking at

Each card is a block of a markdown document, projected into items by `boardFromDocuments`, exactly as
`markdownGraph` projects the same document into nodes. The card's `itemId` is its address's
`locatorHash`; `blockId` under it is `section/ordinal`.

Dragging writes a placement. Press *Insert a block above the fence* and the document is re-read: the
fence's ordinal shifts, so its `blockId` shifts, so its `locatorHash` shifts — and the card is still
in the same place, because `reconcileBoard` re-anchors the item and carries the placement onto the
new id. An item it cannot find is reported as an orphan and dropped, never silently moved.

## What this page is not

Positions here live in this browser's storage, because a static page cannot write a file. The board
the repository writes is `<document>.board.json` beside its document, written through a temp file and
a rename so a reader never meets half of one, and read only when `validateBoard` accepts it —
`pnpm --filter @hafley66/grapht run smoke:board` runs that end to end, and
`packages/grapht/tests/4_board` holds it to account.

An item with no placement is a young board, not a broken one: it draws at the stack position
`boardFrame` gives it.

## What is still missing

The item renderers and the file write/read are landed. The *live* surface — a host that turns pointer
gestures into a movement journal and reloads the board from its file — is the phase this page
anticipates: see [Feature status](./roadmap.md).
