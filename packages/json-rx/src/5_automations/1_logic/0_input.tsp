import "../../4_typespec/4a_aliasFunctions.tsp";

using JsonRx;

namespace Automations.Logic;

alias app = automation("logic.total", "example.test");
alias price = source(app, "catalog.price", "/price", #["GET"]);
alias quantity = source(app, "catalog.quantity", "/quantity", #["GET"]);
alias total = logic("""
{ "*": [{ "var": "price" }, { "var": "quantity" }] }
""");
alias dashboard = output(total, "logic.total");
