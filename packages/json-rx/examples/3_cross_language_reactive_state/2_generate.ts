import { compile, NodeHost } from '@typespec/compiler'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { collectReactiveStates } from '../../src/6_codegen/3_collect'
import { generateReactiveStateRust, generateReactiveStateTs } from '../../src/6_codegen/6_reactiveState'
const directory = import.meta.dirname
const program = await compile(NodeHost, resolve(directory, '1_pipeline.tsp'), { noEmit: true })
const errors = program.diagnostics.filter(({ severity }) => severity === 'error')
if (errors.length) throw new Error(errors.map(({ message }) => message).join('\n'))
const [state] = collectReactiveStates(program)
if (!state) throw new Error('No @reactiveState declaration found')
const files = new Map([[resolve(directory, '4_reducer.auto.ts'), generateReactiveStateTs(state)], [resolve(directory, 'rust/src/1_reducer.auto.rs'), generateReactiveStateRust(state)]])
const check = process.argv.includes('--check'); const stale: string[] = []
for (const [path, contents] of files) { const previous = await readFile(path, 'utf8').catch(() => ''); if (previous !== contents) { if (check) stale.push(path); else await writeFile(path, contents) } }
if (stale.length) throw new Error(`Generated files are stale:\n${stale.join('\n')}`)
