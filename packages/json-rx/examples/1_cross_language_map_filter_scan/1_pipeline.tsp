import "../../src/6_codegen/2_decorators.tsp";

using JsonRx.Codegen;

namespace Examples.MapFilterScan;

scalar NumberInput extends int32;
scalar Total extends int32;

model ValueEvent {
  type: "value";
  value: NumberInput;
}

union NumberEvent {
  value: ValueEvent,
}

model NumberInputs {
  value: NumberInput;
}

@algorithm("runningTotal")
interface RunningTotalAlgorithm {
  @mergeByKey(NumberInputs)
  op events(): NumberEvent;

  @map(RunningTotalAlgorithm.events, "*", 2)
  op doubled(): NumberInput;

  @filter(RunningTotalAlgorithm.doubled, ">=", 4)
  op eligible(): NumberInput;

  @scan(RunningTotalAlgorithm.eligible, "sum", 0)
  op total(): Total;
}
