import { createTypeSpecLibrary } from '@typespec/compiler'

export const $lib = createTypeSpecLibrary({
  name: '@hafley66/json-rx',
  diagnostics: {
    duplicate: {
      severity: 'error',
      messages: { default: 'Duplicate JSON-RX address: {address}' },
    },
    missing: {
      severity: 'error',
      messages: { default: 'Missing JSON-RX metadata: {name}' },
    },
  },
  state: {
    automations: { description: 'JSON-RX automation metadata' },
    sources: { description: 'JSON-RX source metadata' },
    flows: { description: 'JSON-RX flow metadata' },
    outputs: { description: 'JSON-RX output metadata' },
  },
})

export const { createStateSymbol, reportDiagnostic } = $lib
