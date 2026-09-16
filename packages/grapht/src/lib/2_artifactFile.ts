// Artefacts that live beside the thing they describe — a board beside its document, a message log
// beside either — are committed, so a reader must never meet half of one: a partial file shows up as
// a diff somebody has to review and as a board that will not parse.
//
// One place, because the discipline is the point: bytes land in a sibling temp file that carries the
// pid (two writers cannot share one name), and a rename puts them in place. A reader sees the
// previous artefact or the new one, never a mixture.
import { renameSync, rmSync, writeFileSync } from "node:fs"

export function writeArtifactFile(path: string, text: string): void {
  const temporary = `${path}.${process.pid}.tmp`
  try {
    writeFileSync(temporary, text, "utf8")
    renameSync(temporary, path)
  } catch (error) {
    // The leftover would be committed beside the artefact, so it goes before the failure does.
    rmSync(temporary, { force: true })
    throw error
  }
}