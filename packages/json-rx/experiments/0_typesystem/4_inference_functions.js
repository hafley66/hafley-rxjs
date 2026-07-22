function streamValue(_context, target) {
  if (target.returnType.kind !== 'Model') return target.returnType
  return target.returnType.properties.get('value')?.type ?? target.returnType
}

export const $functions = {
  JsonRxExperiment: { streamValue },
}
