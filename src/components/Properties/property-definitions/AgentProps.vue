<template>
  <div class="input-group">
    <label>角色 (Role)</label>
    <input type="text" :value="card.properties.role" @input="updateProperty('role', $event.target.value)">
  </div>
  <div class="input-group">
    <label>初始指令 (Initial Prompt)<br/><small v-pre>可用变量: {{input}}, {{rag_content}}</small></label>
    <textarea :value="card.properties.initial_prompt" @input="updateProperty('initial_prompt', $event.target.value)"></textarea>
  </div>
  <div class="input-group">
    <label>可用工具 (逗号分隔)</label>
    <input type="text" :value="card.properties.tools" @input="updateProperty('tools', $event.target.value)">
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