import Ajv2020 from 'ajv/dist/2020'
import { firstValueFrom, of } from 'rxjs'
import { describe, expect, test } from 'vitest'
import automationJsonSchema from '../../../automation.schema.json'
import { AutomationSchema } from '../../1_schema'
import { compileAutomation } from '../../2_runtime'
import { claudeUsageAutomation, claudeUsageCatalog } from './1_document.auto'
import documentSnapshot from './2_document.snapshot.json'

describe('TypeSpec-authored Claude usage automation', () => {
  test('generates one schema-valid document and reference catalog', async () => {
    const validate = new Ajv2020({ strict: false }).compile(automationJsonSchema)
    const parsed = AutomationSchema.parse(claudeUsageAutomation)
    const runtime = compileAutomation(parsed, {
      'claude.responses': of({
        method: 'GET',
        pageUrl: 'https://claude.ai/settings/usage',
        requestUrl: 'https://claude.ai/api/organizations/example/usage',
        status: 200,
        ts: 42,
        body: {
          five_hour: { utilization: 12 },
          seven_day: { utilization: 34 },
        },
      }),
    })
    expect(claudeUsageAutomation).toEqual(documentSnapshot)

    expect({
      jsonSchemaValid: validate(documentSnapshot),
      jsonSchemaErrors: validate.errors,
      catalog: claudeUsageCatalog,
      emission: await firstValueFrom(runtime.roots['claude.usage']),
    }).toMatchInlineSnapshot(`
      {
        "catalog": {
          "flows": [
            "usage",
          ],
          "sources": [
            "claude.responses",
          ],
        },
        "emission": {
          "automationId": "claude.usage",
          "origin": {
            "ts": 42,
            "url": "https://claude.ai/settings/usage",
          },
          "output": "usage",
          "schema": {
            "additionalProperties": true,
            "type": "object",
          },
          "stream": "claude.usage",
          "value": {
            "fiveHour": 12,
            "sevenDay": 34,
          },
        },
        "jsonSchemaErrors": null,
        "jsonSchemaValid": true,
      }
    `)
  })
})
