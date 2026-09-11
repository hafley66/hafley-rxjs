<script setup lang="ts">
// Rendering nothing while `mountedDemos` is zero is what keeps a page with no demo off the frame loop.
import { fps, mountedDemos } from "../src/3_meters.ts"
</script>

<template>
  <output v-if="mountedDemos > 0" class="fps-meter">
    <b>{{ fps }}</b>
    fps
  </output>
</template>
