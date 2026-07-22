import { compile, NodeHost } from '@typespec/compiler'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { programToTypeDefs } from '@hafley/alloy-rs/adapters'
import { emitCrate } from '@hafley/alloy-rs/emitter'

const directory = import.meta.dirname
const output = resolve(directory, 'rust/generated')
const program = await compile(NodeHost, resolve(directory, '0_frames.tsp'), { noEmit: true })
const errors = program.diagnostics.filter(({ severity }) => severity === 'error')
if (errors.length) throw new Error(errors.map(({ message }) => message).join('\n'))
const definitions = programToTypeDefs(program)
const crate = emitCrate(definitions, {
  axumEndpoints: [{
    path: '/activate',
    method: 'post',
    name: 'activate',
    responseModel: 'ActivateResponse',
  }],
})
const files: Array<[string, string]> = []
const collect = (node: any, prefix = '') => { for (const item of node.contents) { const path = prefix ? `${prefix}/${item.path}` : item.path; if (item.kind === 'file') files.push([path.replace(/^\.\/models\/models\//, 'models/'), item.contents]); else collect(item, path) } }
collect(crate)
const scalarType = (name: string) => ({ boolean: 'boolean', int8: 'number', int16: 'number', int32: 'number', int64: 'number', uint8: 'number', uint16: 'number', uint32: 'number', uint64: 'number', float32: 'number', float64: 'number', decimal: 'number' }[name] ?? 'string')
const tsType = (type: any): string => {
  if (type.kind === 'scalar') return scalarType(type.name)
  if (type.kind === 'model' || type.kind === 'enum') return type.name
  if (type.kind === 'array') return `${tsType(type.element)}[]`
  if (type.kind === 'map') return `Record<${tsType(type.key)}, ${tsType(type.value)}>`
  throw new Error(`Unsupported TypeSpec frame type: ${type.kind}`)
}
const pascal = (name: string) => name[0].toUpperCase() + name.slice(1)
const frameModels = definitions.filter((definition: any) => definition.kind === 'model')
const typescriptFrames = frameModels.flatMap((model: any) => {
  const fields = model.properties.map((property: any) => `  ${property.name}${property.optional ? '?' : ''}: ${tsType(property.type)}`).join('\n')
  const name = pascal(model.name)
  return [`export interface ${model.name} {\n${fields}\n}`, `export const encode${name} = (value: ${model.name}): string => JSON.stringify(value)`, `export const decode${name} = (frame: string): ${model.name} => JSON.parse(frame) as ${model.name}`]
}).join('\n\n') + '\n'
files.push([resolve(directory, '2_frames.auto.ts'), typescriptFrames])
const check = process.argv.includes('--check')
const stale: string[] = []
for (const [path, contents] of files) { const target = resolve(output, path); const previous = await readFile(target, 'utf8').catch(() => ''); if (previous !== contents) { if (check) stale.push(target); else { await mkdir(resolve(target, '..'), { recursive: true }); await writeFile(target, contents) } } }
if (stale.length) throw new Error(`Generated Alloy Rust files are stale:\n${stale.join('\n')}`)
