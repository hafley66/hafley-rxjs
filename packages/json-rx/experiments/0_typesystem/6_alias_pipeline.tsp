import "@typespec/http";
import "./6_alias_pipeline.js";

using Http;
using TypeSpec.Reflection;

namespace JsonRxExperiment;

model Flow<T> { value: T; }

extern fn http(source: Operation): Flow<unknown>;
extern fn map(input: Flow<unknown>, output: unknown, fields: valueof Record<string>): Flow<unknown>;
extern fn shareReplay(input: Flow<unknown>, bufferSize: valueof int32): Flow<unknown>;
extern fn emit(input: Flow<unknown>, stream: valueof string): Flow<unknown>;
extern fn expectValue(input: Flow<unknown>, expected: unknown): Flow<unknown>;

model UsageSnapshot {
  fiveHour: float64;
  sevenDay: float64;
}

model UsageView {
  fiveHourPercent: float64;
  sevenDayPercent: float64;
}

model ReadUsageOk {
  @statusCode statusCode: 200;
  @body body: UsageSnapshot;
}

model ReadUsageNotFound {
  @statusCode statusCode: 404;
  @body body: { message: string };
}

@route("/usage")
interface Api {
  @get op readUsage(): ReadUsageOk | ReadUsageNotFound;
}

alias response = http(Api.readUsage);
alias projected = map(response, UsageView, #{
  fiveHourPercent: "fiveHour",
  sevenDayPercent: "sevenDay",
});
alias shared = shareReplay(projected, 1);
alias output = emit(shared, "usage");
