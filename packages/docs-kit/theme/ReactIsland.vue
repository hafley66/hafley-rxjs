<script setup lang="ts">
// A React root living inside a Vue page: the one seam between the documentation's Vue and a
// package's React components. VitePress owns the page and this SFC owns the div; neither reaches
// into the other's tree. `@vitejs/plugin-react` (wired in `src/6_config.ts`) is what compiles the
// component handed in.
//
// What it does not do: the tree is client-only, so the server HTML for this div is empty and the
// React component appears on mount. `props.props` is compared by identity, not deeply — hand over a
// new object for a change, or keep the state inside React. An error thrown by the React component
// propagates as React's own; there is no error boundary here.
import { createElement, isValidElement, type ReactElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { onBeforeUnmount, onMounted, ref, watch } from "vue"

/** A React component, or an element already built from one — in which case `props` is ignored. */
type IslandComponent = ReactElement | ((props: Record<string, unknown>) => unknown) | null | undefined

const props = defineProps<{
  readonly component: IslandComponent
  readonly props?: Record<string, unknown>
}>()

const host = ref<HTMLElement | null>(null)
let root: Root | null = null
/** The component the live root was created for. A different one is a new root, not a re-render. */
let mounted: IslandComponent = null

const element = (): ReactElement =>
  isValidElement(props.component)
    ? props.component
    : createElement(props.component as (props: Record<string, unknown>) => unknown, props.props)

const unmount = (): void => {
  root?.unmount()
  root = null
  mounted = null
}

const sync = (): void => {
  const container = host.value
  if (container === null) return
  if (props.component === null || props.component === undefined) {
    unmount()
    return
  }
  // Same component, new props: one ordinary React render. Its state, effects and DOM survive, which
  // is what keeps a parent's re-render from resetting the island.
  if (root !== null && props.component === mounted) {
    root.render(element())
    return
  }
  unmount()
  mounted = props.component
  root = createRoot(container)
  root.render(element())
}

// The component by identity, the props object by identity: a parent that re-renders with the same
// component updates the island, and a parent that swaps components gets a fresh tree.
watch([() => props.component, () => props.props], sync)
onMounted(sync)
onBeforeUnmount(unmount)
</script>

<template>
  <div ref="host" class="react-island" />
</template>
