import type { IChangeEvent } from '@rjsf/core'
import Form from '@rjsf/mui'
import type { UiSchema } from '@rjsf/utils'
import validator from '@rjsf/validator-ajv8'
import { AutomationSchema, type Automation } from '../1_schema'
import { automationFormSchema } from './0_formSchema'
import { JsonRxObjectFieldTemplate } from './1_formRoot'

const AutomationUiSchema: UiSchema = {
  $schema: { 'ui:readonly': true },
  version: { 'ui:readonly': true },
  profile: { 'ui:readonly': true },
  'ui:submitButtonOptions': { norender: true },
}

export type JsonRxFormProps = {
  value: unknown
  onChange: (value: unknown) => void
  onSubmit: (value: Automation) => void
}

export function JsonRxForm({ value, onChange, onSubmit }: JsonRxFormProps) {
  const validation = AutomationSchema.safeParse(value)
  const formSchema = automationFormSchema(value)
  const diagnostics = validation.success ? [] : validation.error.issues.map((issue) => `${issue.path.join('.') || '$'}: ${issue.message}`)
  return <div data-testid="json-rx-form" style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
    <Form
      schema={formSchema}
      uiSchema={AutomationUiSchema}
      validator={validator}
      formData={value}
      templates={{ ObjectFieldTemplate: JsonRxObjectFieldTemplate }}
      noValidate
      omitExtraData
      liveOmit
      experimental_defaultFormStateBehavior={{
        emptyObjectFields: 'skipEmptyDefaults',
        constAsDefaults: 'skipOneOf',
      }}
      onChange={(event: IChangeEvent) => onChange(event.formData)}
      onSubmit={() => { if (validation.success) onSubmit(validation.data) }}
      showErrorList={false}
    >
      <button type="submit" disabled={!validation.success}>save document</button>
      <pre>{diagnostics.join('\n')}</pre>
    </Form>
  </div>
}
