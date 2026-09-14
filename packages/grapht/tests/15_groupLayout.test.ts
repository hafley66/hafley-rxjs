import { expect, it } from "vitest"
import { groupAllowsAutoLayout, groupPositionsOf, reduceGroupLayout, type GroupLayoutState } from "../src/2_graph/15_groupLayout.js"
it("keeps group-local manual placement while the expansion toggle changes automatic ownership", () => {
  let state: GroupLayoutState = { autoOnExpand: false, groups: {} }
  const automatic = { a: { x: 0, y: 0 } }
  const moved = { a: { x: 80, y: 20 } }
  const samples: unknown[] = []
  const record = () => samples.push({ auto: groupAllowsAutoLayout(state, "g"), otherAuto: groupAllowsAutoLayout(state, "other"), positions: groupPositionsOf(state, "g", automatic) })
  record()
  state = reduceGroupLayout(state, { type: "manual-move", groupId: "g", positions: moved })
  moved.a.x = 999
  record()
  state = reduceGroupLayout(state, { type: "collapse", groupId: "g" }); record()
  state = reduceGroupLayout(state, { type: "expand", groupId: "g" }); record()
  state = reduceGroupLayout(state, { type: "auto-on-expand", enabled: true })
  state = reduceGroupLayout(state, { type: "collapse", groupId: "g" })
  state = reduceGroupLayout(state, { type: "expand", groupId: "g" }); record()
  state = reduceGroupLayout(state, { type: "auto-on-expand", enabled: false })
  state = reduceGroupLayout(state, { type: "collapse", groupId: "g" })
  state = reduceGroupLayout(state, { type: "expand", groupId: "g" }); record()
  expect(samples).toEqual([
    { auto: true, otherAuto: true, positions: automatic },
    { auto: false, otherAuto: true, positions: { a: { x: 80, y: 20 } } },
    { auto: true, otherAuto: true, positions: automatic },
    { auto: false, otherAuto: true, positions: { a: { x: 80, y: 20 } } },
    { auto: true, otherAuto: true, positions: automatic },
    { auto: false, otherAuto: true, positions: { a: { x: 80, y: 20 } } },
  ])
})
