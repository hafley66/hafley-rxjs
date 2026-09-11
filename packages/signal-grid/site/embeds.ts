// What a demo edited in the browser may import. Each specifier is answered with the copy of the
// module this page already loaded, so the editor's text stays the file you would commit.
import * as docsKit from "@hafley66/docs-kit"
import { Signal } from "@hafley66/signals"
import { createEmbeds } from "@hafley66/docs-kit"
import * as rxjs from "rxjs"
import * as signalGrid from "../src/index.js"

export const EMBEDS = createEmbeds({
  "../src/index.js": signalGrid,
  "@hafley66/docs-kit": docsKit,
  "@hafley66/signals": { Signal },
  rxjs,
})
