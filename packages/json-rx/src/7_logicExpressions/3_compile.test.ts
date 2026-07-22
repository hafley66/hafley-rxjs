import { BehaviorSubject } from "rxjs";
import { describe, expect, test } from "vitest";
import { compileLogicExpression } from "./2_compile";
import { logicReferences } from "./1_references";

describe("JSONLogic Observable expressions", () => {
  test("infers lexical flow references and combines their latest values", () => {
    const price = new BehaviorSubject(3);
    const quantity = new BehaviorSubject(2);
    const expression = { logic: { "*": [{ var: "price" }, { var: "quantity" }] } };
    const values: number[] = [];
    const subscription = compileLogicExpression<number>(expression, { price, quantity }).subscribe((value) => values.push(value));

    price.next(4);
    quantity.next(5);

    expect({ references: logicReferences(expression), values }).toMatchInlineSnapshot(`
      {
        "references": [
          "price",
          "quantity",
        ],
        "values": [
          6,
          8,
          20,
        ],
      }
    `);
    subscription.unsubscribe();
  });

  test("resolves nested JSONLogic paths against inferred flow aliases", () => {
    const rateLimits = new BehaviorSubject({ limit: 100, usage: 40 });
    const values: number[] = [];
    const subscription = compileLogicExpression<number>({
      logic: { "-": [{ var: "rateLimits.limit" }, { var: "rateLimits.usage" }] },
    }, { rateLimits }).subscribe((value) => values.push(value));

    rateLimits.next({ limit: 100, usage: 55 });

    expect(values).toMatchInlineSnapshot(`
      [
        60,
        45,
      ]
    `);
    subscription.unsubscribe();
  });

  test("uses the syntactic reference set for a conditional expression", () => {
    const useLeft = new BehaviorSubject(true);
    const left = new BehaviorSubject(1);
    const right = new BehaviorSubject(10);
    const expression = {
      logic: { if: [{ var: "useLeft" }, { var: "left" }, { var: "right" }] },
    };
    const values: number[] = [];
    const subscription = compileLogicExpression<number>(expression, { useLeft, left, right }).subscribe((value) => values.push(value));

    right.next(11);
    useLeft.next(false);

    expect({ references: logicReferences(expression), values }).toMatchInlineSnapshot(`
      {
        "references": [
          "left",
          "right",
          "useLeft",
        ],
        "values": [
          1,
          1,
          11,
        ],
      }
    `);
    subscription.unsubscribe();
  });

  test("rejects a variable root without a lexical flow binding", () => {
    expect(() => compileLogicExpression({ logic: { var: "missing.value" } }, {})).toThrowErrorMatchingInlineSnapshot(
      `[Error: Unknown logic flow reference: missing]`,
    );
  });
});
