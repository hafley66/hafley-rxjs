// What a demo edited in the browser may import. Each specifier is answered with the copy of the
// module this page already loaded, so the editor's text stays the file you would commit.
import * as docsKit from "@hafley66/docs-kit"
import { createEmbeds } from "@hafley66/docs-kit"
import * as rxjs from "rxjs"
import * as signals from "../src/index.js"
import * as dom from "../examples/0_dom.js"

export const EMBEDS = createEmbeds({
  "../src/index.js": signals,
  "./0_dom.js": dom,
  "@hafley66/docs-kit": docsKit,
  rxjs,
})
