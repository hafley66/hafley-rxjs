import { spawn } from "node:child_process"
import parseArgsStringToArgv from "string-argv"

export type ProcessResult = {
  wallMs: number
  cpuUserMs: number
  cpuSysMs: number
  peakRssKb: number
  exitCode: number | null
  signal: string | null
  stdout: string
  stderr: string
}

const BSD_TIME_RE = /^\s*([\d.]+)\s+real\s+([\d.]+)\s+user\s+([\d.]+)\s+sys\s*$/m
const GNU_TIME_RE = /^\s*User time \(seconds\):\s+([\d.]+)\s*$/m
const GNU_SYS_RE = /^\s*System time \(seconds\):\s+([\d.]+)\s*$/m
const RSS_RE = /^\s*(\d+)\s+maximum resident set size\s*$/m
const GNU_RSS_RE = /^\s*Maximum resident set size \(kbytes\):\s+(\d+)\s*$/m

export function diagnosticsOnly(stderr: string): string {
  if (process.platform !== "darwin") return stderr
  const m = stderr.match(BSD_TIME_RE)
  if (m && m.index !== undefined) {
    return stderr.slice(0, m.index)
  }
  return stderr
}

export function measureCommand(
  command: string,
  input: string,
  { timeoutMs = 120_000 }: { timeoutMs?: number } = {},
): Promise<ProcessResult> {
  return new Promise((resolvePromise, reject) => {
    const isDarwin = process.platform === "darwin"
    const isLinux = process.platform === "linux"

    const args = parseArgsStringToArgv(command)
    if (args.length === 0) {
      reject(new Error("empty adapter command"))
      return
    }

    let argv: string[]
    if (isDarwin) {
      argv = ["/usr/bin/time", "-l", ...args]
    } else if (isLinux) {
      argv = ["/usr/bin/time", "-v", ...args]
    } else {
      argv = args
    }

    const started = process.hrtime.bigint()
    const useGroup = process.platform !== "win32"
    const child = spawn(argv[0], argv.slice(1), {
      stdio: ["pipe", "pipe", "pipe"],
      shell: false,
      detached: useGroup,
    })

    const stdoutChunks: Buffer[] = []
    const stderrChunks: Buffer[] = []
    child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk))
    child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk))

    const timer = setTimeout(() => {
      if (useGroup && child.pid) {
        try {
          process.kill(-child.pid, "SIGKILL")
        } catch {
          child.kill("SIGKILL")
        }
      } else {
        child.kill("SIGKILL")
      }
    }, timeoutMs)

    child.on("error", error => {
      clearTimeout(timer)
      reject(error)
    })

    child.on("close", (code, signal) => {
      clearTimeout(timer)
      const wallNs = process.hrtime.bigint() - started
      const wallMs = Number(wallNs / 1_000_000n)

      const stdout = Buffer.concat(stdoutChunks).toString("utf8")
      const stderr = Buffer.concat(stderrChunks).toString("utf8")

      let cpuUserMs = 0
      let cpuSysMs = 0
      let peakRssKb = 0

      if (isDarwin) {
        const m = stderr.match(BSD_TIME_RE)
        if (m) {
          cpuUserMs = Math.round(Number(m[2]) * 1000)
          cpuSysMs = Math.round(Number(m[3]) * 1000)
        }
        const rss = stderr.match(RSS_RE)
        if (rss) {
          peakRssKb = Math.round(Number(rss[1]) / 1024)
        }
      } else if (isLinux) {
        const u = stderr.match(GNU_TIME_RE)
        const s = stderr.match(GNU_SYS_RE)
        const rss = stderr.match(GNU_RSS_RE)
        if (u) cpuUserMs = Math.round(Number(u[1]) * 1000)
        if (s) cpuSysMs = Math.round(Number(s[1]) * 1000)
        if (rss) peakRssKb = Number(rss[1])
      }

      resolvePromise({
        wallMs,
        cpuUserMs,
        cpuSysMs,
        peakRssKb,
        exitCode: code,
        signal,
        stdout,
        stderr,
      })
    })

    child.stdin.on("error", () => {})
    child.stdin.write(input, "utf8")
    child.stdin.end()
  })
}
