import { compile, NodeHost } from '@typespec/compiler'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { collectPipelines } from '../../src/6_codegen/3_collect'
import { generateRxjs } from '../../src/6_codegen/4_rxjs'
import { generateRust } from '../../src/6_codegen/5_rust'

const directory = import.meta.dirname
const program = await compile(NodeHost, resolve(directory, '0_pipeline.tsp'), { noEmit: true })
const errors = program.diagnostics.filter(({ severity }) => severity === 'error')
if (errors.length > 0) throw new Error(errors.map(({ message }) => message).join('\n'))

const [pipeline] = collectPipelines(program)
if (!pipeline) throw new Error('No @algorithm declaration found')

const files = new Map([
  [resolve(directory, '2_pipeline.auto.ts'), generateRxjs(pipeline)],
  [resolve(directory, 'rust/src/2_pipeline.auto.rs'), generateRust(pipeline)],
])
const check = process.argv.includes('--check')
const stale: string[] = []
for (const [path, contents] of files) {
  const previous = await readFile(path, 'utf8').catch(() => '')
  if (previous === contents) continue
  if (check) stale.push(path)
  else await writeFile(path, contents)
}
if (stale.length > 0) throw new Error(`Generated cross-language files are stale:\n${stale.join('\n')}`)
