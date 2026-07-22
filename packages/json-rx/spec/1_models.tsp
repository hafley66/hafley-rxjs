import "@typespec/json-schema";

using TypeSpec.JsonSchema;

namespace JsonRx;

@jsonSchema
model Reference {
  $ref: string;
}

@jsonSchema
model Parameters {
  path?: Record<unknown>;
  query?: Record<unknown>;
}
