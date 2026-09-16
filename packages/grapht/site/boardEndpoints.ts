// The board's file endpoint, live in the dev server. The page that documents the board is also the
// page you drag it on, and a page whose drags only reach localStorage is a demo of localStorage, not
// of a board: this middleware is what makes the sibling `.board.json` artefact that `boardPathFor`
// names the store the gesture writes to.
//
// Dev-only surface (`apply: "serve"`): a static build has no server to write a file with, so this is
// not a production route. It installs above Vite's base middleware, so `req.url` still carries the
// site's base path — hence the prefix match rather than a mount path.
//
// The endpoint never re-implements the artefact: `boardPathFor` names the file, `parseBoard` and
// `validateBoard` decide what a board is, `writeBoardFile` writes it whole or not at all.
import { mkdirSync, readFileSync } from "node:fs"
import type { IncomingMessage, ServerResponse } from "node:http"
import { dirname, resolve } from "node:path"
import type { Plugin } from "vite"
import { type Board, parseBoard, validateBoard } from "../src/4_board/0_board.js"
import { boardPathFor, readBoardFile, writeBoardFile } from "../src/4_board/2_boardFile.js"

/** The document this site's demos describe; its board is that document's sibling artefact. */
const DOCUMENT = "notes.md"
/**
 * The one board this site serves: `__board/demo` is the board of the notes document, the artefact
 * beside it under the package's `out/board-demo/`. The directory is spelled here rather than built
 * from the URL, so no request can name a path this endpoint writes to.
 */
const BOARD = { name: "demo", directory: "board-demo" }
/** A PUT body is one person's JSON board, and a board is small. Past a megabyte it is not a board. */
const BODY_LIMIT = 1024 * 1024
/** Every response is JSON, and none is worth caching: a PUT changes what the next GET says. */
const HEADERS = { "content-type": "application/json", "cache-control": "no-store" }
const ALLOW = "GET, HEAD, PUT, OPTIONS"

export function boardEndpoints(): Plugin {
  return {
    name: "grapht-board-endpoints",
    apply: "serve",
    configureServer(server) {
      // `root` is the site directory (`vitepress dev site`), and the board lives in the package's
      // `out/` beside it. `boardPathFor` puts the artefact beside its document, inside that tree.
      const boards = resolve(server.config.root, "..", "out")
      const base = server.config.base
      server.middlewares.use((request, response, next) => {
        const name = boardNameOf(request.url ?? "", base)
        if (name === null) return next()
        if (name !== BOARD.name) {
          return send(response, 404, { ok: false, anomalies: [`no board named ${JSON.stringify(name)}`] })
        }
        void handle(request, response, boardPathFor(resolve(boards, BOARD.directory, DOCUMENT)))
      })
    },
  }
}

async function handle(request: IncomingMessage, response: ServerResponse, path: string): Promise<void> {
  try {
    switch (request.method) {
      // A HEAD is a GET without the body, and Node drops that body for us.
      case "GET":
      case "HEAD": {
        const { board, anomalies } = boardAt(path)
        if (anomalies.length > 0) return send(response, 422, { path, board: null, anomalies })
        return send(response, 200, { path, board, anomalies: [] })
      }
      // Vite's cors middleware is installed above plugin middleware and answers a CORS preflight
      // itself (204); this is the endpoint's own OPTIONS answer for a request that reaches it.
      case "OPTIONS":
        response.writeHead(204, { ...HEADERS, allow: ALLOW })
        return response.end()
      case "PUT":
        return await putBoard(request, response, path)
      default:
        return send(response, 405, { ok: false, anomalies: [`${request.method ?? ""} is not a board method`] }, ALLOW)
    }
  } catch (error) {
    send(response, 500, { ok: false, anomalies: [message(error)] })
  }
}

/**
 * The board at `path`, or the anomalies that stopped it. A board nobody has written yet is not an
 * error — it is a board nobody has written yet — so a missing file is a null board and no anomalies.
 */
function boardAt(path: string): { board: Board | null; anomalies: string[] } {
  try {
    return { board: readBoardFile(path), anomalies: [] }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { board: null, anomalies: [] }
    const anomalies = refusalsAt(path)
    return { board: null, anomalies: anomalies.length > 0 ? anomalies : [message(error)] }
  }
}

/** The anomalies behind a refusal, named one by one: a read that refuses throws one summary line. */
function refusalsAt(path: string): string[] {
  let text: string
  try {
    text = readFileSync(path, "utf8")
  } catch (error) {
    return [`unreadable ${path}: ${message(error)}`]
  }
  try {
    return refusalsOf(parseBoard(text))
  } catch (error) {
    return [`parse ${message(error)}`]
  }
}

/** What the package says is wrong with `board` — and a body whose own shape is not a board refuses too. */
function refusalsOf(board: Board): string[] {
  try {
    return validateBoard(board).map((anomaly) => `${anomaly.kind} ${anomaly.detail}`)
  } catch (error) {
    return [`validate ${message(error)}`]
  }
}

/** Validates before it writes, because a board the reader would refuse must never reach the disk. */
async function putBoard(request: IncomingMessage, response: ServerResponse, path: string): Promise<void> {
  const type = request.headers["content-type"] ?? ""
  if (!type.includes("application/json")) {
    return send(response, 400, { ok: false, anomalies: [`a board arrives as application/json, not ${type || "nothing"}`] })
  }

  let body: string | null
  try {
    body = await readBody(request)
  } catch (error) {
    return send(response, 400, { ok: false, anomalies: [`the body did not arrive: ${message(error)}`] })
  }
  if (body === null) return send(response, 413, { ok: false, anomalies: [`a board is capped at ${BODY_LIMIT} bytes`] })

  let board: Board
  try {
    board = parseBoard(body)
  } catch (error) {
    return send(response, 400, { ok: false, anomalies: [`parse ${message(error)}`] })
  }

  const anomalies = refusalsOf(board)
  if (anomalies.length > 0) return send(response, 400, { ok: false, anomalies })

  // The first PUT into a fresh checkout has nothing to write beside yet, and only ever creates.
  try {
    mkdirSync(dirname(path), { recursive: true })
    writeBoardFile(path, board)
  } catch (error) {
    return send(response, 500, { ok: false, anomalies: [`could not write ${path}: ${message(error)}`] })
  }
  return send(response, 200, { ok: true, path, items: board.items.length, placements: board.placements.length })
}

/** The body, or null once it runs past the cap. Overflow stops the read rather than buffering it. */
async function readBody(request: IncomingMessage): Promise<string | null> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request as AsyncIterable<Buffer>) {
    size += chunk.length
    if (size > BODY_LIMIT) return null
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString("utf8")
}

/** The `<name>` of `<base>__board/<name>`, or null when this URL is somebody else's route. */
function boardNameOf(url: string, base: string): string | null {
  const path = url.split(/[?#]/)[0] ?? ""
  const root = base.endsWith("/") ? base : `${base}/`
  const rest = path.startsWith(root) ? path.slice(root.length) : path.replace(/^\//, "")
  return rest.startsWith("__board/") ? rest.slice("__board/".length) : null
}

function send(response: ServerResponse, status: number, body: unknown, allow?: string): void {
  const text = JSON.stringify(body)
  const headers: Record<string, string | number> = { ...HEADERS, "content-length": Buffer.byteLength(text) }
  if (allow !== undefined) headers.allow = allow
  response.writeHead(status, headers)
  response.end(text)
}

const message = (error: unknown): string => (error instanceof Error ? error.message : String(error))
