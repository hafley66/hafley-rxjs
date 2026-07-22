import "./1_decorators.ts";

using TypeSpec.Reflection;

namespace JsonRx;

extern dec automation(target: Interface, id: valueof string, pageHost: valueof string);
extern dec source(target: Operation, id: valueof string, requestUrl: valueof string, methods: valueof string[]);
extern dec flow(target: Operation, id: valueof string, source: valueof string, from: valueof string, fields: valueof Record<string>);
extern dec output(target: Operation, flow: valueof string, stream: valueof string);
