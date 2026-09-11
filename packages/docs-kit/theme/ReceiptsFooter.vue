<script setup lang="ts">
import { withBase } from "vitepress"
import { onMounted, ref } from "vue"
import { statsFooter } from "../src/5_stats.ts"
import { receiptsHost } from "./0_site.ts"

const host = ref<HTMLElement | null>(null)

onMounted(() => {
  const receipts = receiptsHost()
  if (receipts === null) return
  host.value?.replaceChildren(statsFooter(receipts.stats, (slug) => withBase(`/${slug}`)))
})
</script>

<template><div ref="host" /></template>
