import "./4a_aliasFunctions.ts";

namespace JsonRx;

model Automation {}
model Source {}
model Flow {}
model Output {}

extern fn automation(id: valueof string, pageHost: valueof string): Automation;
extern fn source(automation: Automation, id: valueof string, requestUrl: valueof string, methods: valueof string[]): Source;
extern fn map(source: Source, id: valueof string, from: valueof string, fields: valueof Record<string>): Flow;
extern fn output(flow: Flow, stream: valueof string): Output;
