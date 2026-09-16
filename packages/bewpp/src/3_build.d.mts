/** Serializes a paired unpacked MV3 extension and returns the directory it wrote. */
export function buildExtension(options: {
  outDir: string
  token: string
  url: string
  matches: string[]
  name?: string
  version?: string
}): Promise<string>
