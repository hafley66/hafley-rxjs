import "../../src/6_codegen/2_decorators.tsp";

using JsonRx.Codegen;

namespace Examples.Usage;

model UsageSnapshot {
  fiveHour: float64;
  sevenDay: float64;
}

model UsageUpdate {
  fiveHour?: float64;
  sevenDay?: float64;
}

model SnapshotEvent {
  type: "snapshot";
  value: UsageSnapshot;
}

model UpdateEvent {
  type: "update";
  value: UsageUpdate;
}

union UsageEvent {
  snapshot: SnapshotEvent,
  update: UpdateEvent,
}

model UsageInputs {
  snapshot: UsageSnapshot;
  update: UsageUpdate;
}

@algorithm("usageState")
interface UsageStateAlgorithm {
  @mergeByKey(UsageInputs)
  op events(): UsageEvent;

  @snapshotPatch(
    UsageStateAlgorithm.events,
    #{ snapshot: "replace", update: "patch" },
    "value",
  )
  op state(): UsageSnapshot;
}
