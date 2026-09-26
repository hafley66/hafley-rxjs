#!/usr/bin/env node
import { dispatch } from "./7_dispatch.js"

const message = (error: unknown): string => {
  if (error instanceof Error) return error.message
  try {
    return JSON.stringify(error) ?? String(error)
  } catch {
    return String(error)
  }
}

try {
  await dispatch(process.argv.slice(2))
} catch (error) {
  process.stderr.write(`bew: ${message(error)}\n`)
  process.exit(1)
}
