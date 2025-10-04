<template>
    <div class="input-group">
        <label>输出变量名</label>
        <input type="text" :value="card.properties.output" @input="updateProperty('output', $event.target.value)">
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