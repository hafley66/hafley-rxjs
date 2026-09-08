// pkg:setup (vitest:setupFiles, once per worker per file): matchers, $page, the aroundEach boundary.
import { expect } from "vitest"
import { playwrightMatchers } from "./3_matchers.js"
import { installPageGlobals } from "./7_page-global.js"

export type { PageGlobals } from "./7_page-global.js"

import { registerAround } from "./8_around.js"

expect.extend(playwrightMatchers)
installPageGlobals()
registerAround()
