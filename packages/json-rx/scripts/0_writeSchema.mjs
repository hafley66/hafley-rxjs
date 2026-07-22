import { writeFile } from 'node:fs/promises'
import { AutomationJsonSchema } from '../dist/1_schema.js'

await writeFile(new URL('../automation.schema.json', import.meta.url), `${JSON.stringify(AutomationJsonSchema, null, 2)}\n`)
