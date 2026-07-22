import { Accordion, AccordionDetails, AccordionSummary, Box, Typography } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { Templates } from '@rjsf/mui'
import type { ObjectFieldTemplateProps } from '@rjsf/utils'

const DefaultObjectFieldTemplate = Templates.ObjectFieldTemplate

const sections = [
  { id: 'metadata', title: 'Document', fields: ['$schema', 'version', 'profile', 'id', 'enabled'] },
  { id: 'bindings', title: 'Bindings', fields: ['bindings'] },
  { id: 'circuit', title: 'Circuit', fields: ['circuit'] },
  { id: 'outputs', title: 'Outputs', fields: ['outputs'] },
]

export function JsonRxObjectFieldTemplate(props: ObjectFieldTemplateProps) {
  const path = props.fieldPathId.path
  if (path.length === 3 && path[0] === 'circuit' && path[1] === 'flows') {
    return <Box sx={{ display: 'grid', gap: 1 }} data-testid="json-rx-flow-editor">
      {props.properties.map((property) => <Accordion key={property.name} defaultExpanded={property.name === 'pipe'} data-testid={`json-rx-flow-${property.name}`}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography component="h4" variant="subtitle2">{property.name === 'expression' ? 'Nested expression' : property.name}</Typography>
        </AccordionSummary>
        <AccordionDetails>{property.content}</AccordionDetails>
      </Accordion>)}
    </Box>
  }

  if (path.length === 1 && path[0] === 'circuit') {
    return <Box sx={{ display: 'grid', gap: 1 }}>
      {props.properties.map((property) => <Accordion key={property.name} defaultExpanded={property.name === 'flows'} data-testid={`json-rx-circuit-${property.name}`}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography component="h3" variant="subtitle1">{property.name}</Typography>
        </AccordionSummary>
        <AccordionDetails>{property.content}</AccordionDetails>
      </Accordion>)}
    </Box>
  }

  if (path.length !== 0) {
    if (!DefaultObjectFieldTemplate) throw new Error('RJSF MUI ObjectFieldTemplate is unavailable')
    return <DefaultObjectFieldTemplate {...props} />
  }

  return <Box sx={{ display: 'grid', gap: 1.5 }}>
    {sections.map((section) => {
      const properties = props.properties.filter((property) => section.fields.includes(property.name))
      if (!properties.length) return null
      return <Accordion key={section.id} defaultExpanded={section.id === 'circuit'} data-testid={`json-rx-section-${section.id}`}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography component="h2" variant="h6">{section.title}</Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ display: 'grid', gap: 2 }}>
          {properties.map((property) => <div key={property.name}>{property.content}</div>)}
        </AccordionDetails>
      </Accordion>
    })}
  </Box>
}
