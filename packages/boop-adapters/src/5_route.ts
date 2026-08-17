import * as z from "zod"
import { route, StringPathParam } from "@hafley66/path"

export const boopAgentRoute = route(
  `/agents/${StringPathParam("harness")}/${StringPathParam("sessionId")}`,
  z.object({}),
  z.object({}),
)
