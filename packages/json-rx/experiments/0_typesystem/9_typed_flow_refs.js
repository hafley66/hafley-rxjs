import { $ } from "@typespec/compiler/typekit";

function host(context, value) {
  const kit = $(context.program);
  return kit.model.create({
    properties: {
      value: kit.modelProperty.create({ name: "value", type: value }),
    },
  });
}

function field(context, input, property) {
  return property.type ?? input;
}

function multiply(context, left) {
  return left;
}

function logic(context) {
  return $(context.program).model.create({ properties: {} });
}

export const $functions = { JsonRxExperiment: { host, field, multiply, logic } };
