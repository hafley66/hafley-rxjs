// Off unless SIGNALS_LOG is set: 94 tests emitting every write would bury the failures.
// Sink names and the ["signals", ...] category tree match @hafley66/vitest-telemetry's setup.
import { afterAll } from "vitest"
import { configure, dispose, getConsoleSink, type LogRecord } from "@logtape/logtape"
import { enableSignalLogTape, disableSignalLogging } from "./src/0_log.js"

const raw = process.env.SIGNALS_LOG
const LEVELS = ["trace", "debug", "info", "warning", "error", "fatal"] as const
type Level = (typeof LEVELS)[number]

const level: Level | null =
  !raw || raw === "0" || raw === "false"
    ? null
    : (LEVELS as readonly string[]).includes(raw)
      ? (raw as Level)
      : "debug"

// One line per record, fields as JSON. The default console formatter inspects each value and turns
// a `path` array into multi-line noise.
const oneLine = (record: LogRecord): readonly unknown[] => [
  `${record.category.join(".")} ${JSON.stringify(record.properties)}`,
]

if (level) {
  await configure({
    sinks: { console: getConsoleSink({ formatter: oneLine }) },
    loggers: [
      { category: "signals", lowestLevel: level, sinks: ["console"] },
      { category: ["logtape", "meta"], lowestLevel: "warning", sinks: ["console"] },
    ],
    reset: true,
  })
  await enableSignalLogTape()

  afterAll(async () => {
    disableSignalLogging()
    await dispose()
  })
}
