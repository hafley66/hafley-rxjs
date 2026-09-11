<script setup lang="ts">
// An edited demo keeps its `import` lines and the site's embed table answers them from the copy of
// the library this page already loaded, so the editor's text stays the file you would commit.
import { javascript } from "@codemirror/lang-javascript"
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language"
import { tags } from "@lezer/highlight"
import { EditorView, basicSetup } from "codemirror"
import { transform } from "sucrase"
import { onMounted, onUnmounted, ref, shallowRef, watch } from "vue"
import type { AltRenderer, Example } from "../src/0_types.ts"
import type { Evaluated } from "../src/2_embeds.ts"
import { exampleOf } from "../src/2_embeds.ts"
import { fps, retainMeters, type Meters, type Timing } from "../src/3_meters.ts"
import { demoHost } from "./0_site.ts"

const props = defineProps<{ id: string; height?: number }>()

const host = demoHost()
const example = host?.byId(props.id)

const stage = ref<HTMLElement | null>(null)
const editorHost = ref<HTMLElement | null>(null)
const tab = ref<"preview" | "edit">("preview")
const renderer = ref<"dom" | "alternate">("dom")
const error = ref<string | null>(null)
const overBudget = ref<number | null>(null)
const edited = ref(false)

/** The file behind whichever button the strip is on. A panel printing the other one would make the
 * button a claim about code the reader cannot see. */
const sourceFor = (which: "dom" | "alternate"): string =>
  (which === "alternate" ? example?.alternate?.source : undefined) ?? example?.source ?? ""

const text = ref(sourceFor("dom"))

let view: EditorView | null = null
let meters: Meters | null = null
let mountTeardown: (() => void) | null = null
let sandbox: Evaluated | null = null
let debounce = 0
let quiet = false

const timings = shallowRef<readonly Timing[]>([])

/** An edit that takes longer than this stops re-running on its own, so a slow one cannot repeat. */
const BUDGET_MS = 2000

const messageOf = (thrown: unknown): string => (thrown instanceof Error ? thrown.message : String(thrown))

const teardown = (): void => {
  try {
    mountTeardown?.()
  } catch (thrown) {
    error.value = `Teardown threw: ${messageOf(thrown)}`
  }
  mountTeardown = null
  sandbox?.close()
  sandbox = null
}

// An edit can delete the second rendering the strip is currently on, and the fallback is what keeps
// that keystroke from leaving a blank stage until the reader notices the button.
function mountExample(into: HTMLElement, subject: Example): () => void {
  meters?.reset()
  const chosen = renderer.value === "alternate" ? subject.alternate : undefined
  return (chosen ?? subject).mount(into)
}

const isAlternate = (value: unknown): value is AltRenderer =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as AltRenderer).label === "string" &&
  typeof (value as AltRenderer).mount === "function"

/** The editor holds the file for the button the strip is on, so an edited second rendering exports a
 * label and a mount with no `id`, and `exampleOf` would find nothing to run. */
function mountEdited(into: HTMLElement, exports: Readonly<Record<string, unknown>>): (() => void) | null {
  if (renderer.value === "alternate") {
    const alternate = Object.values(exports).find(isAlternate)
    if (alternate !== undefined) {
      meters?.reset()
      return alternate.mount(into)
    }
  }
  const found = exampleOf(exports)
  return found === undefined ? null : mountExample(into, found)
}

// `jsx` is on for every demo rather than only for a second rendering: a package may write one in a
// syntax the TypeScript parser alone rejects, and the transform is inert on a file holding none.
function transpile(source: string): { code: string } | { error: string } {
  const options = { transforms: ["jsx", "typescript", "imports"], jsxRuntime: "automatic" } as const
  try {
    return { code: transform(source, { ...options, filePath: `${props.id}.tsx` }).code }
  } catch (thrown) {
    return { error: messageOf(thrown) }
  }
}

function runEdited(code: string): void {
  const into = stage.value
  if (into === null || host === null) return
  error.value = null
  teardown()
  into.replaceChildren()
  const started = performance.now()
  try {
    const evaluated = host.evaluate(code, text.value)
    sandbox = evaluated
    mountTeardown = mountEdited(into, evaluated.exports)
    if (mountTeardown === null) {
      error.value =
        renderer.value === "alternate"
          ? "No rendering is exported. Export a value with a `label` and a `mount`."
          : "No example is exported. Export a value with an `id` and a `mount`."
    }
  } catch (thrown) {
    error.value = messageOf(thrown)
  }
  const spent = performance.now() - started
  overBudget.value = spent > BUDGET_MS ? Math.round(spent) : null
}

const runOriginal = (): void => {
  const into = stage.value
  if (into === null || example === undefined) return
  error.value = null
  overBudget.value = null
  edited.value = false
  teardown()
  into.replaceChildren()
  try {
    mountTeardown = mountExample(into, example)
  } catch (thrown) {
    error.value = messageOf(thrown)
  }
}

const runFromEditor = (): void => {
  const result = transpile(text.value)
  if ("error" in result) {
    error.value = result.error
    return
  }
  runEdited(result.code)
}

const runNow = (): void => {
  overBudget.value = null
  runFromEditor()
}

/** Puts a committed file in the editor without the listener reading it as the reader's keystroke. */
function load(insert: string): void {
  text.value = insert
  if (view === null) return
  quiet = true
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert } })
  quiet = false
}

// An edit is the reader's, so it survives the switch and their own change is what gets drawn twice.
// An unedited panel follows the button, since one file printed under both answers with the wrong one.
const pick = (next: "dom" | "alternate"): void => {
  if (renderer.value === next) return
  renderer.value = next
  if (edited.value) {
    runFromEditor()
    return
  }
  load(sourceFor(next))
  runOriginal()
}

// A half-typed line fails to parse, so what is on screen keeps running until the next edit parses.
const schedule = (): void => {
  window.clearTimeout(debounce)
  if (overBudget.value !== null) return
  debounce = window.setTimeout(runFromEditor, 300)
}

function reset(): void {
  load(sourceFor(renderer.value))
  window.clearTimeout(debounce)
  runOriginal()
}

/** Every colour is a VitePress variable rather than a literal, which is what makes the editor follow
 * the site's light and dark toggle with nothing in JavaScript watching for the class to change. */
const siteTheme = EditorView.theme({
  "&": { color: "var(--vp-c-text-1)", backgroundColor: "var(--vp-code-block-bg)" },
  ".cm-content": { caretColor: "var(--vp-c-brand-1)" },
  ".cm-cursor, .cm-dropCursor": { borderInlineStartColor: "var(--vp-c-brand-1)" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
    backgroundColor: "var(--vp-c-brand-soft)",
  },
  ".cm-activeLine": { backgroundColor: "var(--vp-c-default-soft)" },
  ".cm-gutters": {
    backgroundColor: "var(--vp-code-block-bg)",
    color: "var(--vp-c-text-3)",
    borderInlineEnd: "1px solid var(--vp-c-divider)",
  },
  ".cm-activeLineGutter": { backgroundColor: "transparent", color: "var(--vp-c-brand-1)" },
  ".cm-foldPlaceholder": { backgroundColor: "transparent", border: "none", color: "var(--vp-c-text-3)" },
  ".cm-panels, .cm-tooltip": {
    backgroundColor: "var(--vp-c-bg-elv)",
    color: "var(--vp-c-text-1)",
    border: "1px solid var(--vp-c-divider)",
  },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
    backgroundColor: "var(--vp-c-brand-soft)",
    color: "var(--vp-c-text-1)",
  },
  ".cm-searchMatch": { backgroundColor: "var(--vp-c-yellow-soft)" },
  ".cm-selectionMatch": { backgroundColor: "var(--vp-c-default-soft)" },
})

/** Six hues VitePress redefines on both sides of the toggle, so a token keeps its role in either. */
const siteHighlight = HighlightStyle.define([
  { tag: [tags.comment, tags.lineComment, tags.blockComment, tags.docComment], color: "var(--vp-c-text-3)", fontStyle: "italic" },
  {
    tag: [tags.keyword, tags.modifier, tags.operatorKeyword, tags.controlKeyword, tags.moduleKeyword, tags.self],
    color: "var(--vp-c-purple-1)",
  },
  { tag: [tags.string, tags.special(tags.string), tags.regexp, tags.escape], color: "var(--vp-c-green-1)" },
  { tag: [tags.number, tags.bool, tags.null, tags.atom, tags.unit], color: "var(--vp-c-orange-1)" },
  { tag: [tags.typeName, tags.className, tags.namespace, tags.typeOperator], color: "var(--vp-c-yellow-1)" },
  {
    tag: [tags.function(tags.variableName), tags.function(tags.definition(tags.variableName)), tags.labelName, tags.macroName],
    color: "var(--vp-c-brand-1)",
  },
  {
    tag: [tags.propertyName, tags.attributeName, tags.variableName, tags.definition(tags.variableName)],
    color: "var(--vp-c-text-1)",
  },
  { tag: [tags.operator, tags.punctuation, tags.separator, tags.bracket, tags.derefOperator], color: "var(--vp-c-text-2)" },
  { tag: tags.invalid, color: "var(--vp-c-red-1)" },
])

const openEditor = (): void => {
  tab.value = "edit"
  const into = editorHost.value
  if (view !== null || into === null || example === undefined) return
  view = new EditorView({
    doc: text.value,
    parent: into,
    extensions: [
      basicSetup,
      siteTheme,
      syntaxHighlighting(siteHighlight),
      javascript({ typescript: true }),
      EditorView.updateListener.of((update) => {
        if (!update.docChanged || quiet) return
        text.value = update.state.doc.toString()
        edited.value = true
        schedule()
      }),
    ],
  })
}

onMounted(() => {
  if (example === undefined) return
  meters = retainMeters()
  watch(meters.timings, (next) => {
    timings.value = next
  })
  runOriginal()
})

onUnmounted(() => {
  window.clearTimeout(debounce)
  teardown()
  view?.destroy()
  view = null
  meters?.release()
  meters = null
})
</script>

<template>
  <div v-if="example" class="demo">
    <div class="demo-head">
      <span class="demo-title">{{ example.title }}</span>
      <span class="demo-summary">{{ example.summary }}</span>
    </div>

    <div ref="stage" class="demo-stage" :style="{ blockSize: `${props.height ?? 340}px` }" />

    <p v-if="error" class="demo-error">{{ error }}</p>
    <p v-if="overBudget !== null" class="demo-error">
      That edit took {{ overBudget }}ms to run, so typing no longer re-runs it. Press Run when ready.
    </p>

    <div class="demo-strip">
      <span v-for="timing in timings" :key="timing.label" class="demo-timing">
        <b>{{ timing.label }}</b>
        {{ timing.last.toFixed(1) }}ms
        <i>avg {{ timing.mean.toFixed(1) }}ms over {{ timing.count }}</i>
      </span>
      <span v-if="timings.length === 0" class="demo-timing demo-quiet">
        no timings recorded
      </span>
      <span class="demo-fps">fps {{ fps }}</span>
    </div>

    <div v-if="example.alternate" class="demo-tabs">
      <button type="button" :aria-pressed="renderer === 'dom'" @click="pick('dom')">DOM</button>
      <button type="button" :aria-pressed="renderer === 'alternate'" @click="pick('alternate')">
        {{ example.alternate.label }}
      </button>
    </div>

    <div class="demo-tabs">
      <button type="button" :aria-pressed="tab === 'preview'" @click="tab = 'preview'">Preview</button>
      <button type="button" :aria-pressed="tab === 'edit'" @click="openEditor">Edit</button>
      <button v-if="overBudget !== null" type="button" class="demo-run" @click="runNow">Run</button>
      <button type="button" class="demo-reset" :disabled="!edited" @click="reset">Reset</button>
    </div>

    <div v-show="tab === 'edit'" ref="editorHost" class="demo-editor" />
  </div>

  <p v-else class="demo-missing">
    No example is registered under the id <code>{{ props.id }}</code>. Check
    <code>{{ host?.registry ?? "the site theme, which named no demo registry" }}</code>.
  </p>
</template>
