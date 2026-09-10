import DefaultTheme from "vitepress/theme"
import { h } from "vue"
import type { Theme } from "vitepress"
import "../../../src/theme.css"
import "./site.css"
import FpsMeter from "./FpsMeter.vue"
import GridDemo from "./GridDemo.vue"
import ParityMatrix from "./ParityMatrix.vue"
import ReceiptsFooter from "./ReceiptsFooter.vue"
import ReceiptsSection from "./ReceiptsSection.vue"

const theme: Theme = {
  extends: DefaultTheme,
  Layout: () =>
    h(DefaultTheme.Layout, null, {
      "doc-after": () => h(ParityMatrix),
      "layout-bottom": () => [h(ReceiptsFooter), h(FpsMeter)],
    }),
  enhanceApp({ app }) {
    app.component("ReceiptsSection", ReceiptsSection)
    app.component("GridDemo", GridDemo)
  },
}

export default theme
