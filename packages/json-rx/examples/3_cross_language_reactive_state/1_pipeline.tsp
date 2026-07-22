import "../../src/6_codegen/2_decorators.tsp";
using JsonRx.Codegen;
namespace Examples.ReactiveState;
model Value { label: string; }
model Failure { message: string; }
model LifecycleState {}
@algorithm("lifecycleState") interface LifecycleStateAlgorithm { @reactiveState(Value, Failure) op state(): LifecycleState; }
