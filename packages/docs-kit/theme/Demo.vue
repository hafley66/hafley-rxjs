<script setup lang="ts">
// An edited demo keeps its `import` lines and the site's embed table answers them from the copy of
// the library this page already loaded, so the editor's text stays the file you would commit.
import { javascript } from "@codemirror/lang-javascript"
import { EditorView, basicSetup } from "codemirror"
import { transform } from "sucrase"
import { onMounted, onUnmounted, ref, shallowRef, watch } from "vue"
import type { Example } from "../src/0_types.ts"
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
const text = ref(example?.source ?? "")

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

function transpile(source: string): { code: string } | { error: string } {
  try {
    return { code: transform(source, { transforms: ["typescript", "imports"], filePath: `${props.id}.ts` }).code }
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
    const found = exampleOf(evaluated.exports)
    if (found === undefined) error.value = "No example is exported. Export a value with an `id` and a `mount`."
    else mountTeardown = mountExample(into, found)
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

// The editor's text survives the switch, so a reader who changed a column and then asked for the
// other renderer sees their own change drawn twice rather than the committed file drawn twice.
const pick = (next: "dom" | "alternate"): void => {
  if (renderer.value === next) return
  renderer.value = next
  if (edited.value) runFromEditor()
  else runOriginal()
}

// A half-typed line fails to parse, so what is on screen keeps running until the next edit parses.
const schedule = (): void => {
  window.clearTimeout(debounce)
  if (overBudget.value !== null) return
  debounce = window.setTimeout(runFromEditor, 300)
}

function reset(): void {
  if (example === undefined || view === null) {
    runOriginal()
    return
  }
  quiet = true
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: example.source } })
  quiet = false
  text.value = example.source
  window.clearTimeout(debounce)
  runOriginal()
}

const openEditor = (): void => {
  tab.value = "edit"
  const into = editorHost.value
  if (view !== null || into === null || example === undefined) return
  view = new EditorView({
    doc: text.value,
    parent: into,
    extensions: [
      basicSetup,
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
