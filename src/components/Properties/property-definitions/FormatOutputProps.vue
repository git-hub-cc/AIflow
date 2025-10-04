<template>
  <div class="input-group">
    <label>输出格式</label>
    <select :value="card.properties.format" @change="updateProperty('format', $event.target.value)">
      <option value="text">文本</option>
      <option value="json">JSON</option>
      <option value="xml">XML</option>
    </select>
  </div>
  <div class="input-group">
    <label>输出模板<br/><small v-pre>(可使用 {{input}})</small></label>
    <textarea :value="card.properties.template" @input="updateProperty('template', $event.target.value)"></textarea>
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