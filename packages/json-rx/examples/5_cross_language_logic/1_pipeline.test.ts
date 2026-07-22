import { Subject } from "rxjs";
import { describe, expect, test } from "vitest";
import { compileLogicExpression } from "../../src/7_logicExpressions/2_compile";
import timeline from "./0_timeline.json";

describe("RxJS JSONLogic marble fixture", () => {
  test("matches the shared latest-value timeline", () => {
    const price = new Subject<number>();
    const quantity = new Subject<number>();
    const values: number[] = [];
    const subscription = compileLogicExpression<number>({ logic: timeline.logic }, { price, quantity })
      .subscribe((value) => values.push(value));

    for (const event of timeline.events) {
      if (event.source === "price") price.next(event.value);
      if (event.source === "quantity") quantity.next(event.value);
    }

    expect(values).toEqual(timeline.outputs);
    subscription.unsubscribe();
  });
});
