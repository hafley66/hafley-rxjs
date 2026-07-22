import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'
import { AutomationSchema } from '../1_schema'
import { JsonRxForm } from './2_form'

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const source = 'jsonrx://test/source'
const document = {
  $schema: './node_modules/@hafley66/json-rx/automation.schema.json',
  version: 'automation.v1',
  profile: 'rxjs-7.8',
  id: 'jsonrx://test/automation',
  enabled: true,
  bindings: { sources: { [source]: { kind: 'host.event', operation: 'test/read' } } },
  circuit: {
    sources: { [source]: {} },
    reducers: {},
    flows: { 'jsonrx://test/flow': { pipe: [{ node: 'source', source: { $ref: source } }] } },
  },
  outputs: [{ kind: 'host.emit', flow: 'jsonrx://test/flow', stream: 'test', schema: { type: 'object' } }],
} as const

describe('JsonRxForm', () => {
  it('renders the generated schema form and submits a typed document', async () => {
    const host = globalThis.document.createElement('div')
    const change = vi.fn()
    const submit = vi.fn()
    const root = createRoot(host)
    globalThis.document.body.append(host)
    await act(async () => root.render(<JsonRxForm value={document} onChange={change} onSubmit={submit} />))

    expect({
      fields: [...host.querySelectorAll('input, select')].length,
      version: (host.querySelector('input[value="automation.v1"]') as HTMLInputElement | null)?.value,
      saveDisabled: (host.querySelector('button[type="submit"]') as HTMLButtonElement).disabled,
      diagnostics: host.querySelector('pre')?.textContent,
      pipeChoices: [...host.querySelectorAll('[data-testid="json-rx-flow-pipe"] [role="combobox"]')].map((choice) => choice.textContent),
    }).toMatchInlineSnapshot(`
      {
        "diagnostics": "",
        "fields": 22,
        "pipeChoices": [
          "Source",
          "jsonrx://test/source",
        ],
        "saveDisabled": false,
        "version": "automation.v1",
      }
    `)

    await expect(page.getByTestId('json-rx-form')).toMatchScreenshot('json-rx-form')

    const pipe = host.querySelector('[data-testid="json-rx-flow-pipe"]') as HTMLElement
    const addPipeItem = pipe.querySelector('button[title="Add Item"]') as HTMLButtonElement
    await act(async () => addPipeItem.click())
    await act(async () => {
      await page.getByTestId('json-rx-flow-pipe').getByRole('combobox').nth(2).click()
      await new Promise((resolve) => setTimeout(resolve, 250))
    })
    await act(async () => {
      await page.getByRole('option', { name: 'JSONata map' }).click()
      await new Promise((resolve) => setTimeout(resolve, 250))
    })
    const fillPipeInput = async (idSuffix: string, value: string) => {
      const input = pipe.querySelector(`input[id$="${idSuffix}"]`)
      expect(input).not.toBeNull()
      await act(async () => page.elementLocator(input as HTMLInputElement).fill(value))
    }
    await fillPipeInput('pipe_1_node', 'map')
    await fillPipeInput('pipe_1_map_from', 'body')
    await fillPipeInput('pipe_1_map_language', 'jsonata')
    const edited = change.mock.lastCall?.[0]
    expect(AutomationSchema.parse(edited)).toMatchSnapshot()
    await expect(page.getByTestId('json-rx-flow-pipe')).toMatchScreenshot('json-rx-pipe-with-map')

    await act(async () => (host.querySelector('form') as HTMLFormElement).dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true })))
    expect(submit.mock.calls[0][0]).toMatchObject({ version: 'automation.v1', id: 'jsonrx://test/automation' })
    await act(async () => root.unmount())
    host.remove()
  })
})
