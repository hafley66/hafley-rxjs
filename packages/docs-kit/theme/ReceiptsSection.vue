<script setup lang="ts">
import { onMounted, ref } from "vue"
import { renderSection } from "../src/5_stats.ts"
import { receiptsHost } from "./0_site.ts"

const props = defineProps<{ id: string }>()
const host = ref<HTMLElement | null>(null)

onMounted(() => {
  const receipts = receiptsHost()
  if (receipts === null || host.value === null) return
  renderSection(receipts.stats, receipts.sections, props.id, host.value)
})
</script>

<template><div ref="host" class="stats-section" /></template>
