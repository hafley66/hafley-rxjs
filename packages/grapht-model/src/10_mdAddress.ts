// An address names a markdown block by where it is and by what it says. The two are separate hashes on purpose: `locatorHash` is the join key, `contentHash` answers whether the quoted text is still the quoted text, and `docHash` pins the revision the address was read from. Persisted records use sha256, so this lane carries its own WebCrypto twin instead of the node:crypto helpers the board keeps.
//
// `locatorHash` derives from the landed `${section}/${ordinal}` block id, so an
// in-place edit above the block leaves it untouched, while an *inserted* block
// above shifts the ordinal and takes the locator with it. Relocation carries
// that case: `relocateAddress` falls through to `contentHash` and reanchors, or
// orphans when two blocks read the same. A structural id that survives
// insertion is phase 6 work, not a change to this scheme.
import type { SourceSpan } from "./0_sourceSpan.js"
import type { MdBlock, MdDocument } from "./9_mdDocument.js"

export type MdAddress = {
  path: string
  section: string
  /** Ordinal of the block inside its section. */
  block: number
  blockId: string
  /** Absolute offsets in this revision. */
  span: SourceSpan
  /** sha256("path#blockId"): identity, untouched by an in-place edit above the block. */
  locatorHash: string
  /** sha256 of the slice at `span`: drift detector. */
  contentHash: string
  /** sha256 of the whole file: names the revision. */
  docHash: string
}

export type MdAddressIndex = {
  path: string
  docHash: string
  byBlockId: Map<string, MdAddress>
  byLocator: Map<string, MdAddress>
}

export type MdRelocation =
  | { state: "anchored"; address: MdAddress }
  | { state: "reanchored"; address: MdAddress; previousSpan: SourceSpan }
  | { state: "orphaned"; previousSpan: SourceSpan; reason: "missing" | "ambiguous" }

// WebCrypto only: this package is a leaf the browser lanes import, so it never
// reaches for node:crypto. A runtime without crypto.subtle is a hard error, not
// a silent fallback to an unhashed address.
export async function sha256Hex(text: string): Promise<string> {
  const subtle: SubtleCrypto | undefined = globalThis.crypto?.subtle
  if (!subtle) throw new Error("md addresses need WebCrypto (crypto.subtle), which this runtime does not provide")
  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

async function addressOf(document: MdDocument, block: MdBlock, docHash: string): Promise<MdAddress> {
  const [locatorHash, contentHash] = await Promise.all([
    sha256Hex(`${document.path}#${block.id}`),
    sha256Hex(document.text.slice(block.span.start, block.span.end)),
  ])
  return {
    path: document.path,
    section: block.section,
    block: block.ordinal,
    blockId: block.id,
    span: block.span,
    locatorHash,
    contentHash,
    docHash,
  }
}

// The document text is hashed once for the whole index, not once per block.
export async function mdAddressIndex(document: MdDocument): Promise<MdAddressIndex> {
  const docHash = await sha256Hex(document.text)
  const addresses = await Promise.all(document.blocks.map((block) => addressOf(document, block, docHash)))
  const byBlockId = new Map<string, MdAddress>()
  const byLocator = new Map<string, MdAddress>()
  for (const address of addresses) {
    byBlockId.set(address.blockId, address)
    byLocator.set(address.locatorHash, address)
  }
  return { path: document.path, docHash, byBlockId, byLocator }
}

export async function mdAddressOf(document: MdDocument, blockId: string): Promise<MdAddress | undefined> {
  const block = document.blocks.find((candidate) => candidate.id === blockId)
  if (!block) return undefined
  return addressOf(document, block, await sha256Hex(document.text))
}

// Relocation, frozen for this phase: the block at the previous id wins when its
// text still hashes the same; otherwise a unique block carrying the previous
// text reanchors and keeps the old span; anything else orphans, because two
// candidates are as unusable as none. Orphans are shown, never silently moved.
export async function relocateAddress(previous: MdAddress, next: MdDocument): Promise<MdRelocation> {
  const index = await mdAddressIndex(next)
  const anchored = index.byBlockId.get(previous.blockId)
  if (anchored && anchored.contentHash === previous.contentHash) return { state: "anchored", address: anchored }

  const matches: MdAddress[] = []
  for (const address of index.byBlockId.values()) {
    if (address.contentHash === previous.contentHash) matches.push(address)
  }
  if (matches.length === 1) return { state: "reanchored", address: matches[0]!, previousSpan: previous.span }
  return { state: "orphaned", previousSpan: previous.span, reason: matches.length ? "ambiguous" : "missing" }
}
