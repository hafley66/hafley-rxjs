import { describe, expect, it } from "vitest"
import { formatBytes } from "./bytes"

describe("formatBytes", () => {
  it("picks the unit and one decimal under ten of it", () => {
    expect(formatBytes(0)).toBe("0 B")
    expect(formatBytes(512)).toBe("512 B")
    expect(formatBytes(1536)).toBe("1.5 KB")
    expect(formatBytes(12 * 1024 * 1024)).toBe("12 MB")
    expect(formatBytes(3.2 * 1024 ** 4)).toBe("3.2 TB")
  })
  it("prints nothing for missing or negative sizes", () => {
    expect(formatBytes(undefined)).toBe("")
    expect(formatBytes(-1)).toBe("")
  })
})
