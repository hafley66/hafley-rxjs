import { $ } from "@typespec/compiler/typekit";

function multiply(context, left) {
  return left;
}

function logic(context) {
  return $(context.program).model.create({ properties: {} });
}

export const $functions = { JsonRxExperiment: { multiply, logic } };
