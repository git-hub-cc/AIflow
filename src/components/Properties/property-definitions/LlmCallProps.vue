<template>
  <div class="input-group">
    <label>LLM 模型</label>
    <input type="text" :value="card.properties.model" @input="updateProperty('model', $event.target.value)">
  </div>
  <div class="input-group">
    <label>提示 (Prompt)<br/><small v-pre>可用变量: {{input}}, {{rag_content}}, {{tool_result}}</small></label>
    <textarea :value="card.properties.prompt" @input="updateProperty('prompt', $event.target.value)"></textarea>
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