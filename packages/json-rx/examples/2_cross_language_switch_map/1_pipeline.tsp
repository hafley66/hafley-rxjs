import "../../src/6_codegen/2_decorators.tsp";

using JsonRx.Codegen;

namespace Examples.SwitchMap;

scalar ResultId extends string;

model DelayedRequest {
  id: string;
  delayTicks: int32;
}

model RequestEvent {
  type: "request";
  value: DelayedRequest;
}

union RequestEvents {
  request: RequestEvent,
}

model RequestInputs {
  request: DelayedRequest;
}

@algorithm("latestResult")
interface LatestResultAlgorithm {
  @mergeByKey(RequestInputs)
  op events(): RequestEvents;

  @switchMap(LatestResultAlgorithm.events, "delayTicks", "id")
  op result(): ResultId;
}
