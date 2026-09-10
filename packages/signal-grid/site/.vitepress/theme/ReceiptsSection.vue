<script setup lang="ts">
import { onMounted, ref } from "vue"
import { renderStatsSection } from "../../stats.js"

const props = defineProps<{ id: string }>()
const host = ref<HTMLElement | null>(null)

onMounted(() => {
  if (host.value !== null) renderStatsSection(props.id, host.value)
})
</script>

<template><div ref="host" class="stats-section" /></template>
