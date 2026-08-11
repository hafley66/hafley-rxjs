import { createHash } from "node:crypto"
import type { Dirent } from "node:fs"
import { readdir, readFile, stat } from "node:fs/promises"
import { resolve } from "node:path"

export function sha256Hex(data: string | Uint8Array): string {
  return createHash("sha256")
    .update(data as Uint8Array)
    .digest("hex")
}

export async function hashFile(path: string): Promise<string> {
  const bytes = await readFile(path)
  return sha256Hex(bytes)
}

export async function hashFileIfExists(path: string): Promise<string | null> {
  try {
    await stat(path)
  } catch {
    return null
  }
  return hashFile(path)
}

export async function directoryBytes(dir: string): Promise<{ bytes: number; files: string[] }> {
  let total = 0
  const files: string[] = []
  const walk = async (current: string): Promise<void> => {
    let entries: Dirent[]
    try {
      entries = await readdir(current, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = resolve(current, entry.name)
      if (entry.isDirectory()) {
        await walk(full)
      } else {
        const info = await stat(full)
        total += info.size
        files.push(full)
      }
    }
  }
  await walk(dir)
  files.sort()
  return { bytes: total, files }
}
