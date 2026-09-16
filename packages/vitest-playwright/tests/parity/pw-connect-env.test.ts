// pwp:pw-connect-env: PW_TEST_CONNECT_WS_ENDPOINT must switch every worker to connect, so a child run
// pointed at a launchServer endpoint launches 0 local browsers (PW/index.js:197-199,540). The package
// does not read the env today, so the child launches one local browser and this is red.
import { chromium } from "playwright"
import { expect, test } from "vitest"
import { countLaunches, runChild } from "./helpers.js"

test("connect env endpoint means no local browser launch", async () => {
  const server = await chromium.launchServer()
  try {
    const wsEndpoint = server.wsEndpoint()
    const r = await runChild("pw-connect-env", {
      env: { PW_TEST_CONNECT_WS_ENDPOINT: wsEndpoint, DEBUG: "pw:browser" },
    })
    expect(r.code, r.stderr).toBe(0)
    expect(
      countLaunches(r),
      "pw-connect-env: a local browser launched; PW_TEST_CONNECT_WS_ENDPOINT must be honored",
    ).toBe(0)
  } finally {
    await server.close()
  }
})