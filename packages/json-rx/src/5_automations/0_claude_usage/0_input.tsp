import "../../4_typespec/4a_aliasFunctions.tsp";

using JsonRx;

namespace Automations.Claude;

alias claude = automation("claude.usage", "claude.ai");
alias responses = source(claude, "claude.responses", "/api/organizations/*/usage", #["GET"]);
alias usage = map(responses, "usage", "$.body", #{
  fiveHour: "five_hour.utilization",
  sevenDay: "seven_day.utilization",
});
alias dashboard = output(usage, "claude.usage");
