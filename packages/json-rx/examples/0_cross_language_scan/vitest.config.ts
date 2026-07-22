import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: [
      'examples/0_cross_language_scan/3_pipeline.test.ts',
      'examples/1_cross_language_map_filter_scan/5_pipeline.test.ts',
      'examples/2_cross_language_switch_map/5_pipeline.test.ts',
      'examples/3_cross_language_reactive_state/5_reducer.test.ts',
      'examples/4_cross_process_frame/4_frames.test.ts',
    ],
  },
})
