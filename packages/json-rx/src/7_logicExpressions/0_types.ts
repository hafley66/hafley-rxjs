import type { Observable } from "rxjs";

export type JsonLogicValue = null | boolean | number | string | JsonLogicValue[] | { [operator: string]: JsonLogicValue };

export type LogicExpression = {
  logic: JsonLogicValue;
};

export type LogicInputs = Record<string, Observable<unknown>>;
