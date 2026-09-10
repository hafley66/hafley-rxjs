<script setup lang="ts">
import { useData } from "vitepress"
import { onBeforeUnmount, onMounted, watch } from "vue"
import { PAGES, targetOf } from "../../content.js"

const { page } = useData()

const parityPage = PAGES.find((it) => it.slug === "parity")

// `relativePath` is the rewritten path, `parity.md`, the same string `targetOf` spells.
const isParity = (): boolean => parityPage !== undefined && page.value.relativePath === targetOf(parityPage)

let teardown: (() => void) | null = null

const stop = (): void => {
  teardown?.()
  teardown = null
}

const start = async (): Promise<void> => {
  stop()
  if (!isParity()) return
  const doc = document.querySelector(".vp-doc")
  if (!(doc instanceof HTMLElement)) return
  const { mountParity } = await import("../../parity.js")
  const mounted = mountParity(doc)
  if (mounted !== null) teardown = mounted.teardown
}

onMounted(start)
watch(() => page.value.relativePath, start)
onBeforeUnmount(stop)
</script>

<template><span hidden /></template>
