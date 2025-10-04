<template>
  <aside class="toolbox">
    <h3>组件库</h3>
    <div class="card-list">
      <ToolboxItem
        v-for="(def, type) in cardDefinitions"
        :key="type"
        :type="type"
        :title="def.title"
        :icon="def.icon"
      />
    </div>
  </aside>
</template>

<script setup>
import ToolboxItem from './ToolboxItem.vue';
import { cardDefinitions } from '../Canvas/cardDefinitions.js';
</script>