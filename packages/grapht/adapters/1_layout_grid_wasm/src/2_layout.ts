export type LayoutParameters = { spacing: number; margin: number; columns?: number }
export function parseLayoutParameters(parameters: Record<string, string | number | boolean>): LayoutParameters {
  const numberParameter = (name: string, fallback: number): number => { const value = parameters[name]; if (value === undefined) return fallback; const parsed = typeof value === "number" ? value : Number(value); if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`parameter ${name} must be a finite non-negative number`); return parsed }
  const parsedColumns = parameters.columns === undefined ? undefined : numberParameter("columns", 0)
  return { spacing: numberParameter("spacing", 100), margin: numberParameter("margin", 0), columns: parsedColumns === undefined || parsedColumns === 0 ? undefined : Math.floor(parsedColumns) }
}
