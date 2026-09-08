// Public surface. Internals (streams, roots, the around hook) stay behind the subpath entries the plugin wires itself.
export type { ResolvedOptions, ServeOptions, VitestPlaywrightOptions } from "./0_options.js"
export { vitestPlaywright } from "./1_plugin.js"
export { type ExpectedText, type PlaywrightMatchers, playwrightMatchers, serializeExpectedText } from "./3_matchers.js"
export { describe, expect, it, type PwFile, type PwTest, type PwWorker, test } from "./4_test.js"
export type { ApiEvent, AttemptEvent, ConsoleLine, NetEvent, PageError, TestLog, TestLogState } from "./6_roots.js"
export type { PageGlobals } from "./7_page-global.js"
