// pwp:pw-video-noreuse: video on disables context reuse (PW/index.js:364,423), so the pair only holds
// when reuse itself exists. Two sequential child runs: the pw-reuse fixture (contextScope "worker",
// video off) must share one context, the pw-video-noreuse fixture (same scope, video on) must not.
// The video half already holds because every test gets its own context; the reuse baseline is red.
import { expect, test } from "vitest"
import { runChild } from "./helpers.js"

test("video opts out of a shared worker context", async () => {
  const video = await runChild("pw-video-noreuse")
  expect(video.code, `pw-video-noreuse: video "on" must give each test its own context\n${video.stdout}`).toBe(0)
  const baseline = await runChild("pw-reuse")
  expect(
    baseline.code,
    `pw-video-noreuse: the video opt-out is unobservable while contextScope "worker" shares no context at all; the video-off baseline run failed\n${baseline.stdout}`,
  ).toBe(0)
})
