<script setup lang="ts">
// Vue owns one div and nothing else. The board's host, journal, toolbar and file client are all React
// in `BoardPanel.tsx`, so this file holds no board logic and nothing here can drift from it.
import { ReactIsland } from "@hafley66/docs-kit/theme"
import { BoardPanel } from "./BoardPanel"
</script>

<template>
  <ReactIsland :component="BoardPanel" />
</template>
