<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue"

// A showcase page's subject is the route itself, so the frame is sized to hold a grid rather than
// to fit a paragraph: 760px leaves ~430px under the demo's own chrome at the doc column width.
const DEFAULT_PX = 760
const MIN_PX = 320

const props = defineProps<{ route: string; title: string }>()

const box = ref<HTMLElement | null>(null)
const key = `signal-grid.route-frame.${props.route}`
let observer: ResizeObserver | null = null

onMounted(() => {
  const el = box.value
  if (el === null) return
  const held = Number(localStorage.getItem(key))
  el.style.blockSize = `${Number.isFinite(held) && held >= MIN_PX ? held : DEFAULT_PX}px`
  observer = new ResizeObserver(() => {
    const next = Math.round(el.getBoundingClientRect().height)
    if (next >= MIN_PX) localStorage.setItem(key, String(next))
  })
  observer.observe(el)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
})
</script>

<template>
  <div ref="box" class="route-frame-box">
    <iframe class="route-frame" :src="`./demo/${props.route}`" :title="props.title" loading="lazy"></iframe>
  </div>
  <p class="route-frame-link">
    <a :href="`./demo/${props.route}`" target="_blank" rel="noreferrer">Open the route full screen</a>
    <span class="route-frame-hint">drag the frame's bottom edge to resize it; the height is remembered</span>
  </p>
</template>
