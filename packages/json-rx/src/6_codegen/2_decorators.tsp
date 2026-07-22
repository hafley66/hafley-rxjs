import "./1_decorators.ts";

using TypeSpec.Reflection;

namespace JsonRx.Codegen;

extern dec algorithm(target: Interface, name: valueof string);
extern dec mergeByKey(target: Operation, inputs: Model);
extern dec snapshotPatch(
  target: Operation,
  events: Operation,
  cases: valueof Record<"replace" | "patch">,
  valueField: valueof string,
);
extern dec map(target: Operation, input: Operation, operator: "*", right: valueof numeric);
extern dec filter(target: Operation, input: Operation, operator: ">=", right: valueof numeric);
extern dec scan(target: Operation, input: Operation, reducer: "sum", seed: valueof numeric);
extern dec switchMap(target: Operation, input: Operation, delayField: valueof string, outputField: valueof string);
extern dec reactiveState(target: Operation, next: Model, failure: Model);
