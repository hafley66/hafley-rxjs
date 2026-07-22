import "./8_observable_constructor.js";

namespace JsonRxExperiment;

model Flow<T> {
  value: T;
}

model SignalConstructor {
  input: unknown;
  output: unknown;
}

extern fn host(value: unknown, address: valueof string): Flow<unknown>;
extern fn signal(input: unknown, output: unknown, logic: valueof Record<string>): SignalConstructor;
extern fn close(constructor: SignalConstructor, input: Flow<unknown>): Flow<unknown>;
extern fn emit(input: Flow<unknown>, stream: valueof string): Flow<unknown>;

model RateLimits {
  limit: int32;
  usage: int32;
}

alias rateLimits = host(RateLimits, "account/rateLimits/read");
alias remaining = signal(RateLimits, int32, #{
  remaining: "limit - usage",
});
alias remainingValue = close(remaining, rateLimits);
alias dashboard = emit(remainingValue, "codex.remaining");
