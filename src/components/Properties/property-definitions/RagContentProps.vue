<template>
  <div class="input-group">
    <label>检索查询 (Query)<br/><small v-pre>可用变量: {{input}}</small></label>
    <input type="text" :value="card.properties.query" @input="updateProperty('query', $event.target.value)">
  </div>
  <div class="input-group">
    <label>检索数量 (Top K)</label>
    <input type="number" :value="card.properties.top_k" @input="updateProperty('top_k', parseInt($event.target.value) || 1)" min="1">
  </div>
</template>
<script setup>
import { useWorkflowStore } from '../../../stores/workflowStore';
const props = defineProps({ card: Object });
const store = useWorkflowStore();
const updateProperty = (key, value) => {
  store.updateCardProperty(props.card.id, key, value);
};
</script>