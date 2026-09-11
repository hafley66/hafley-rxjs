// The registry. Adding an example is one import and one array entry. The stylesheet is imported
// once here, so no example's displayed source carries a line about styling.
import "./demo.css"
import type { Example, SignalForm } from "./0_types.js"
import { state } from "./1_state.js"
import { nested } from "./2_nested.js"
import { sourced } from "./3_source.js"
import { computed } from "./4_computed.js"
import { event } from "./5_event.js"
import { piped } from "./6_pipe.js"
import { mapped } from "./7_signal_map.js"
import { stored } from "./8_storage.js"
import { routed } from "./9_route.js"
import { sliced } from "./10_slice.js"

export type { Example, ExampleCheck, SignalForm } from "./0_types.js"

export const EXAMPLES: readonly Example[] = [
  state,
  nested,
  sourced,
  computed,
  event,
  piped,
  mapped,
  stored,
  routed,
  sliced,
]

export const byId = (id: string): Example | undefined => EXAMPLES.find((it) => it.id === id)

export const byForm = (form: SignalForm): readonly Example[] => EXAMPLES.filter((it) => it.form === form)
