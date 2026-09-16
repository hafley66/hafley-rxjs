<script setup lang="ts">
// A board you can see and move. The document below becomes items; each item's id is its address's
// locator, so the readout on every card is the identity the address lane is built on — and when the
// document gains a block above the fence, those ids change while the cards stay where they were put.
//
// Positions live in localStorage here, because a static page cannot write a file. The file itself
// (`<document>.board.json`, atomic, verified on read) is what `pnpm run smoke:board` and the board
// tests exercise; this page is for looking at.
//
// A fence stays a `block` item here. A `fence` item is the same item once a host hands over the
// frame it rendered — grapht parses neither mermaid nor d2 — and this page has no renderer.
import { computed, onMounted, onUnmounted, ref, shallowRef } from "vue"
import { type MdDocument, mdDocument } from "@hafley66/grapht-model"
// The module, not the barrel: this package's barrel pulls the bench harness and 1_sequence's
// geometry (which imports playwright) into the page's dependency graph, and the optimizer cannot
// bundle the native `fsevents` that drags in.
import { type Board, type BoardItem, boardFromDocuments, placeItem, reconcileBoard, validateBoard } from "../../../src/4_board/0_board.js"

const PATH = "notes.md"
const STORE = "grapht-board-demo"
/** What `boardFrame` would be told to measure; the card is drawn this big. */
const CARD = { width: 260, height: 84, gap: 16 }

const HEAD = [
  "# Release notes",
  "",
  "Everything under this line is a block of the document: a heading, a paragraph, a list, a fence.",
  "",
  "## What shipped",
  "",
  "- the address lane: locator, content, and document hashes",
  "- the projection: blocks as nodes, headings as groups",
  "- the board: items in places, placements keyed to the locator",
  "",
]
const FENCE = ["```mermaid", "sequenceDiagram", "  Alice->>Bob: ship it", "```", ""]
const TAIL = ["## What is next", "", "A pin layer, and messages pinned to this prose.", ""]
const SOURCE = [...HEAD, ...FENCE, ...TAIL].join("\n")
/** The same document with one paragraph inserted above the fence: the case the ids have to survive. */
const INSERTED = [...HEAD, "An interruption, added above everything else.", "", ...FENCE, ...TAIL].join("\n")

const board = shallowRef<Board | null>(null)
const text = ref(SOURCE)
const note = ref("")
const saved = ref<Record<string, { x: number; y: number; z: number }>>({})
const drag = ref<{ itemId: string; dx: number; dy: number } | null>(null)
/** The board's own box: a placement is a board coordinate, not a position on the screen. */
const canvas = ref<HTMLElement | null>(null)

const placedById = computed(() => new Map((board.value?.placements ?? []).map(placement => [placement.itemId, placement])))
/** "Placed" means a person moved it: an item laid out by the stack nobody touched is not placed. */
const placedCount = computed(() => board.value?.placements.filter(placement => saved.value[placement.itemId] !== undefined).length ?? 0)

/** Where a card sits: where it was put, else the stack `boardFrame` uses for an item nobody placed. */
function positionOf(item: BoardItem, index: number): { x: number; y: number; z: number } {
  const placed = placedById.value.get(item.itemId)
  if (placed) return { x: placed.x, y: placed.y, z: placed.z }
  return { x: 0, y: index * (CARD.height + CARD.gap), z: 0 }
}

function excerptOf(item: BoardItem): string {
  if (!("address" in item)) return ""
  const raw = text.value.slice(item.address.span.start, item.address.span.end).replace(/\s+/g, " ").trim()
  return raw.length > 92 ? `${raw.slice(0, 92)}…` : raw
}

function readStorage(): Record<string, { x: number; y: number; z: number }> {
  try {
    return JSON.parse(localStorage.getItem(STORE) ?? "{}") as Record<string, { x: number; y: number; z: number }>
  } catch {
    return {}
  }
}

function remember(): void {
  try {
    localStorage.setItem(STORE, JSON.stringify(saved.value))
  } catch {
    // A page that cannot remember is still a page that can be dragged.
  }
}

/** Builds the board from the document, and lays every item where this browser last left it. */
async function build(source: string): Promise<void> {
  const built = await boardFromDocuments("demo", [mdDocument(PATH, source)])
  board.value = {
    ...built,
    placements: built.items.map((item, index) => {
      const remembered = saved.value[item.itemId]
      const decided = remembered ?? { x: 0, y: index * (CARD.height + CARD.gap), z: 0 }
      return { itemId: item.itemId, ...decided }
    }),
  }
}

onMounted(async () => {
  saved.value = readStorage()
  await build(SOURCE)
  window.addEventListener("pointermove", onPointerMove)
  window.addEventListener("pointerup", onPointerUp)
})

/** Teardown, named the way this repository names teardown. */
function unsubscribe(): void {
  window.removeEventListener("pointermove", onPointerMove)
  window.removeEventListener("pointerup", onPointerUp)
}
onUnmounted(unsubscribe)

function start(item: BoardItem, event: PointerEvent): void {
  const card = (event.currentTarget as HTMLElement).getBoundingClientRect()
  drag.value = { itemId: item.itemId, dx: event.clientX - card.left, dy: event.clientY - card.top }
}

function onPointerMove(event: PointerEvent): void {
  const moving = drag.value
  const current = board.value
  const host = canvas.value
  if (!moving || !current || !host) return
  // Relative to the board, scroll included, or a card jumps by the page's own offset on first move.
  const box = host.getBoundingClientRect()
  const x = Math.max(0, event.clientX - box.left + host.scrollLeft - moving.dx)
  const y = Math.max(0, event.clientY - box.top + host.scrollTop - moving.dy)
  board.value = placeItem(current, moving.itemId, { x, y })
  saved.value = { ...saved.value, [moving.itemId]: { x, y, z: 0 } }
}

function onPointerUp(): void {
  if (!drag.value) return
  drag.value = null
  remember()
  note.value = "positions saved in this browser"
}

async function insertAbove(): Promise<void> {
  const current = board.value
  if (!current) return
  const { board: reconciled, moved, orphaned } = await reconcileBoard(current, [mdDocument(PATH, INSERTED)])
  board.value = reconciled
  text.value = INSERTED
  // Only what a person placed is remembered, carried onto its new id. Writing every placement here
  // would freeze the stack an item nobody touched was drawn at, and call that a decision.
  const kept: Record<string, { x: number; y: number; z: number }> = {}
  for (const [itemId, at] of Object.entries(saved.value)) {
    const key = moved.find(entry => entry.from === itemId)?.to ?? itemId
    const placement = reconciled.placements.find(candidate => candidate.itemId === key)
    if (placement) kept[key] = { x: placement.x, y: placement.y, z: placement.z }
    // No placement under that key means the item is gone from this revision: an orphan, dropped.
  }
  saved.value = kept
  remember()
  note.value = moved.length
    ? `${moved.length} re-anchored, positions kept — ${moved.map(entry => `${entry.blockId}: ${entry.from.slice(0, 6)}→${entry.to.slice(0, 6)}`).join(", ")}${orphaned.length ? `; ${orphaned.length} orphaned` : ""}`
    : "no item changed its address"
}

async function reset(): Promise<void> {
  try {
    localStorage.removeItem(STORE)
  } catch {
    // Nothing to clear.
  }
  saved.value = {}
  text.value = SOURCE
  await build(SOURCE)
  note.value = "positions cleared"
}
</script>

<template>
  <div class="board-demo">
    <div class="board-bar">
      <button type="button" @click="insertAbove">Insert a block above the fence</button>
      <button type="button" @click="reset">Reset positions</button>
      <span class="board-readout">
        {{ board?.items.length ?? 0 }} items · {{ placedCount }} placed ·
        {{ board ? validateBoard(board).length : 0 }} anomalies · drag a card
      </span>
    </div>

    <p v-if="note" class="board-note">{{ note }}</p>

    <div ref="canvas" class="board-canvas">
      <article
        v-for="(item, index) in board?.items ?? []"
        :key="item.itemId"
        :data-item="item.itemId"
        class="board-card"
        :class="{ 'is-dragging': drag?.itemId === item.itemId }"
        :style="{
          left: `${positionOf(item, index).x}px`,
          top: `${positionOf(item, index).y}px`,
          width: `${CARD.width}px`,
          height: `${CARD.height}px`,
        }"
        @pointerdown="start(item, $event)"
      >
        <header>
          <span class="board-kind">{{ item.kind }}</span>
          <code>{{ item.itemId.slice(0, 6) }}</code>
        </header>
        <p class="board-excerpt">{{ excerptOf(item) }}</p>
        <footer>{{ 'blockId' in item ? item.blockId : '' }}</footer>
      </article>
    </div>

    <p class="board-help">
      A card's <code>itemId</code> is its block's address locator, and <code>blockId</code> is
      <code>section/ordinal</code>. Press <em>Insert a block above the fence</em>: the ids change and
      every card stays where you left it. That is why a placement is keyed to an address rather than
      to a position in a list.
    </p>
  </div>
</template>

<style scoped>
.board-demo {
  margin: 1.5rem 0;
}
.board-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.75rem;
}
.board-bar button {
  padding: 0.35rem 0.7rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg-soft);
  cursor: pointer;
  font-size: 13px;
}
.board-bar button:hover {
  border-color: var(--vp-c-brand-1);
}
.board-readout,
.board-note {
  font-size: 13px;
  color: var(--vp-c-text-2);
}
.board-canvas {
  position: relative;
  height: 620px;
  border: 1px dashed var(--vp-c-divider);
  border-radius: 8px;
  background-image: radial-gradient(var(--vp-c-divider) 1px, transparent 1px);
  background-size: 20px 20px;
  overflow: auto;
}
.board-card {
  position: absolute;
  box-sizing: border-box;
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
  box-shadow: 0 2px 8px rgb(0 0 0 / 12%);
  cursor: grab;
  user-select: none;
  overflow: hidden;
}
.board-card.is-dragging {
  cursor: grabbing;
  border-color: var(--vp-c-brand-1);
  box-shadow: 0 8px 20px rgb(0 0 0 / 24%);
}
.board-card header {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 11px;
  color: var(--vp-c-text-3);
}
.board-kind {
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.board-excerpt {
  margin: 0.35rem 0 0;
  font-size: 13px;
  line-height: 1.35;
  color: var(--vp-c-text-1);
}
.board-card footer {
  position: absolute;
  bottom: 0.35rem;
  font-size: 10px;
  color: var(--vp-c-text-3);
}
.board-help {
  font-size: 13px;
  color: var(--vp-c-text-2);
}
</style>
