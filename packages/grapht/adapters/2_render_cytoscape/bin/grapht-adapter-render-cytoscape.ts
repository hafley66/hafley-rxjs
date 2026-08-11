#!/usr/bin/env node
import { createInterface } from "node:readline"
import { runJsonLine } from "../4_adapter.ts"
const input = createInterface({ input: process.stdin, crlfDelay: Infinity })
for await (const line of input) { if (!line.trim()) continue; for (const output of await runJsonLine(line)) process.stdout.write(`${output}\n`) }
