<template>
    <div class="input-group">
        <label>输入内容</label>
        <textarea :value="card.properties.value" @input="updateProperty('value', $event.target.value)"></textarea>
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