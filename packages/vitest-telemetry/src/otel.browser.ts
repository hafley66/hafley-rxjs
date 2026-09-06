// Loaded by vitest's experimental.openTelemetry browserSdkPath. This file is bundled into the
// browser page by vite, so the `__TELEMETRY__` define is available directly.
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { BatchSpanProcessor, WebTracerProvider } from '@opentelemetry/sdk-trace-web'
import type { TelemetryDefine } from './index.js'

declare const __TELEMETRY__: TelemetryDefine

const provider = new WebTracerProvider({
  resource: resourceFromAttributes({
    'service.name': `${__TELEMETRY__.root}-browser`,
    [`${__TELEMETRY__.root}.shard`]: __TELEMETRY__.shard,
  }),
  spanProcessors: [
    new BatchSpanProcessor(new OTLPTraceExporter({ url: `${__TELEMETRY__.otlp}/v1/traces` }), { scheduledDelayMillis: 200 }),
  ],
})
provider.register()
export default provider
