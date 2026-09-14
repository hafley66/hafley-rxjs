// Resident OS process memory for external Node harnesses. Browser entry points do not import this module.
import { execFile } from "node:child_process"
import { promisify } from "node:util"
const execFileAsync = promisify(execFile)

export interface ProcessMemory {
  readonly pid: number
  readonly rssBytes: number
}

/**
 * Read resident set size from ps on macOS/Linux. No shell, no retained process, no polling lifetime.
 * Missing/exited PIDs are omitted. RSS includes resident JS and native pages; shared pages can appear
 * in more than one PID, so summing records is not a unique physical-memory measurement.
 */
export async function processMemory(pids: readonly number[]): Promise<ProcessMemory[]> {
  if (process.platform !== "darwin" && process.platform !== "linux") throw new Error("processMemory requires macOS or Linux ps")
  if (pids.some(pid => !Number.isSafeInteger(pid) || pid <= 0)) throw new Error("processMemory requires positive integer PIDs")
  if (pids.length === 0) return []
  const { stdout } = await execFileAsync("ps", ["-p", [...new Set(pids)].join(","), "-o", "pid=,rss="], { encoding: "utf8" }).catch(error => {
    if (error.code === 1 && error.stdout.trim() === "" && error.stderr.trim() === "") return { stdout: "" }
    throw error
  })
  return stdout.trim().split("\n").filter(Boolean).map(line => {
    const [pid, kib] = line.trim().split(/\s+/).map(Number)
    if (!Number.isSafeInteger(pid) || !Number.isFinite(kib) || kib! < 0) throw new Error("Unexpected ps memory output")
    return { pid: pid!, rssBytes: kib! * 1024 }
  })
}
