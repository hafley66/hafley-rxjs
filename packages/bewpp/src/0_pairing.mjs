import { randomBytes } from "node:crypto"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

export function pairingToken(dataDir) {
  const path = join(dataDir, "extension-token")
  mkdirSync(dataDir, { recursive: true })
  try {
    return readFileSync(path, "utf8").trim()
  } catch (error) {
    if (error.code !== "ENOENT") throw error
    const token = randomBytes(32).toString("hex")
    try {
      writeFileSync(path, token, { mode: 0o600, flag: "wx" })
      return token
    } catch (error) {
      if (error.code !== "EEXIST") throw error
      return readFileSync(path, "utf8").trim()
    }
  }
}
