import { combineLatest, map, of, type Observable } from "rxjs";
import jsonLogic from "json-logic-js";
import type { RulesLogic } from "json-logic-js";
import type { LogicExpression, LogicInputs } from "./0_types";
import { logicReferences } from "./1_references";

export function compileLogicExpression<Result>(
  expression: LogicExpression,
  inputs: LogicInputs,
): Observable<Result> {
  const references = logicReferences(expression);
  const missing = references.filter((reference) => inputs[reference] === undefined);
  if (missing.length) throw new Error(`Unknown logic flow reference: ${missing.join(", ")}`);
  if (!references.length) return of(jsonLogic.apply(expression.logic as RulesLogic, {}) as Result);

  const sources = references.map((reference) => inputs[reference]);
  return combineLatest(sources).pipe(
    map((values) => jsonLogic.apply(
      expression.logic as RulesLogic,
      Object.fromEntries(references.map((reference, index) => [reference, values[index]])),
    ) as Result),
  );
}
