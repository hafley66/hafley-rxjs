import "./6_alias_pipeline.tsp";

namespace JsonRxExperiment;

alias ResponseCarriesUsageSnapshot = expectValue(response, UsageSnapshot);
alias OutputCarriesUsageView = expectValue(output, UsageView);
