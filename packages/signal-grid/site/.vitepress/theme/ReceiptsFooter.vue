<script setup lang="ts">
import { withBase } from "vitepress"
import { onMounted, ref } from "vue"
import { statsFooter } from "../../stats.js"

const host = ref<HTMLElement | null>(null)

onMounted(() => {
  host.value?.replaceChildren(statsFooter((slug) => withBase(`/${slug}`)))
})
</script>

<template><div ref="host" /></template>
