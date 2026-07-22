import type { LogicExpression } from "./0_types";

function visit(value: unknown, roots: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) visit(item, roots);
    return;
  }
  if (typeof value !== "object" || value === null) return;
  for (const [operator, argument] of Object.entries(value)) {
    if (operator === "var") {
      const path = Array.isArray(argument) ? argument[0] : argument;
      if (typeof path === "string" && path.length > 0) roots.add(path.split(".")[0]);
      continue;
    }
    visit(argument, roots);
  }
}

export function logicReferences(expression: LogicExpression): string[] {
  const roots = new Set<string>();
  visit(expression.logic, roots);
  return [...roots].sort();
}
