// The generator lives in `@hafley66/docs-kit`. This names the barrel it reads for what is public
// and the modules it documents, which is the whole of what is grapht-specific about it.
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { generateApi } from "@hafley66/docs-kit/scripts/api"

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), "..")

const result = generateApi({
  pkg: PKG,
  barrel: "src/index.ts",
  modules: [
    "src/lib/0_graphStyle.ts",
    "src/lib/1_wheelCamera.ts",
    "src/lib/1_graphStylesheet.ts",
    "src/2_graph/15_groupLayout.ts",
    "src/2_graph/16_neighborhood.ts",
    "src/2_graph/17_groupProjection.ts",
    "src/2_graph/18_sequenceCollapse.ts",
    "src/2_graph/19_sequenceNeighborhood.ts",
    "src/2_graph/20_groupActors.ts",
    "src/2_graph/21_svgFrame.ts",
    "src/2_graph/22_d2SvgFrame.ts",
    "src/2_graph/23_manualMovement.ts",
    "src/2_graph/24_svgInfer.ts",
    "src/2_graph/0_frame.ts",
    "src/2_graph/1_fitCamera.ts",
    "src/2_graph/2_geometryScope.ts",
    "src/2_graph/3_sealedSvgArtifact.ts",
    "src/2_graph/4_svgGeometry.ts",
    "src/2_graph/5_translateGeometry.ts",
    "src/2_graph/6_stackGroupHeaders.ts",
    "src/2_graph/9_operators.ts",
    "src/2_graph/10_renderer.ts",
    "src/2_graph/13_foreignObjectText.ts",
    "src/2_graph/14_gestureLegend.ts",
    "src/5_history/0_journal.ts",
    "src/5_history/1_gitWalk.ts",
    "src/5_history/2_cli.ts",
  ],
  out: "docs/reference-api.md",
  title: "Every export",
  intro:
    "The public surface of `@hafley66/grapht` that the pages above this one describe: the graph frame, the sticky headers, the renderer contract, and the history journal. The bench protocol and renderer contracts are omitted, because a page here does not answer a question about them yet.",
})

console.log(`api: ${result.exports} export(s) across ${result.modules} module(s) into ${result.file}`)
