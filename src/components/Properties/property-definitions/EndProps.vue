<template>
    <div class="input-group">
        <label>结果变量名</label>
        <input type="text" :value="card.properties.result" @input="updateProperty('result', $event.target.value)">
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