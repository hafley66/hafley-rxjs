import { existsSync } from "node:fs";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { searchForWorkspaceRoot } from "vite";
import { defineConfig } from "vitest/config";

// instant checks out beside hafley-rxjs (`~/projects/instant`, or the sibling in a paired
// worktree). The host-cascade table test links its real stylesheets from there.
const instantRoot = resolve(import.meta.dirname, "../../../instant");

export default defineConfig({
  plugins: [react()],
  optimizeDeps: { include: ["dockview", "@hafley66/signal-grid", "@hafley66/signal-grid/react", "@hafley66/signals/react", "@hafley66/xdom", "@hafley66/signals"] },
  // streamdown and md resolve react through pnpm isolation; one copy or hooks read null dispatchers
  resolve: { dedupe: ["react", "react-dom"] },
  server: { fs: { allow: [searchForWorkspaceRoot(process.cwd()), instantRoot] } },
  test: {
    maxWorkers: 1,
    fileParallelism: false,
    browser: {
      enabled: true,
      // Headless Chromium launches with --hide-scrollbars, which also drops `::-webkit-scrollbar`
      // styling; the classic-scrollbar table test needs bars that take layout width.
      provider: playwright({ launchOptions: { ignoreDefaultArgs: ["--hide-scrollbars"] } }),
      instances: [{ browser: "chromium", viewport: { width: 1280, height: 800 }, provide: { instantRoot: existsSync(instantRoot) ? instantRoot : "" } }],
      headless: true,
      screenshotFailures: true,
    },
    include: [
      "src/0_Streamdown.render.test.tsx",
      "src/1_reading.render.test.tsx",
      "src/**/*.browser.test.tsx",
      "src/lib/0_panelActivation.render.test.tsx",
      "src/0b_SequenceDiagram.render.test.tsx",
      "src/0b_sequenceSource.test.ts",
      "src/0_DiagramLightbox.render.test.tsx",
    ],
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
