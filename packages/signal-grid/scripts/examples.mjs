// The chromium pass lives in `@hafley66/docs-kit`. This adds the two grid-specific parts: what a
// peak figure can and cannot be trusted to mean, and the recordings the site lists beside it.
import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { runExampleCheck } from "@hafley66/docs-kit/scripts/examples"

const root = fileURLToPath(new URL("..", import.meta.url))

const NOTE =
  "Two limits on how far a peak can be trusted: a peak near 0.5 MB is the measurement floor, and an example whose rows are built at module scope has a peak that depends on what the previous example left allocated, which is why virtualization-50k moves by more than 100 per cent between runs while the four stress examples, which build their rows inside mount, repeat to within 1 per cent."

/** The recordings `examples/videos.ts` lists, checked against what is on disk. */
async function videos(page) {
  const listed = await page.evaluate(async () => {
    const module = await import("/examples/videos.ts")
    return module.VIDEOS.map((it) => ({ id: it.id, sourcePath: it.sourcePath, missing: it.missing }))
  })
  const problems = []
  for (const video of listed) {
    const present = existsSync(new URL(video.sourcePath, new URL("../", import.meta.url)))
    if (video.missing && present) problems.push(`${video.id}: marked missing but the mp4 is there`)
    if (!video.missing && !present) problems.push(`${video.id}: ${video.sourcePath} is not on disk`)
  }
  console.log(`\nvideos: ${listed.length} listed, ${problems.length} mismatched`)
  return problems
}

runExampleCheck({ root, paintedLabel: "rows", note: NOTE, audit: videos }).catch((error) => {
  console.error(error)
  process.exitCode = 1
})
