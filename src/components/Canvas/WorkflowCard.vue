<template>
  <div
      class="workflow-card"
      :class="{ selected: isSelected, running: status === 'running', success: status === 'success', error: status === 'error' }"
      :data-card-id="card.id"
      :data-card-type="card.type"
      :style="cardStyle"
  >
    <div class="card-header">
      <i :class="[definition.icon, 'icon']" :style="{ color: definition.color }"></i>
      <span class="title">{{ definition.title }}</span>
    </div>
    <div class="card-content">
      <p v-if="card.type === 'llm_call'">{{ (card.properties.prompt || '').substring(0, 30) }}...</p>
      <p v-else-if="card.type === 'text_input'">"{{ (card.properties.value || '').substring(0, 20) }}..."</p>
      <p v-else-if="card.type === 'rag_content'">查询: "{{ card.properties.query || '' }}"<br/>Top K: {{ card.properties.top_k || 5 }}</p>
      <p v-else-if="card.type === 'agent'">角色: "{{ card.properties.role || '' }}"</p>
      <p v-else-if="card.type === 'format_output'">格式: {{ card.properties.format || 'text' }}</p>
    </div>
    <div class="card-ports">
      <div
          v-for="i in (definition.inputs || 0)"
          :key="`in-${i-1}`"
          class="port input"
          data-port-type="input"
          :data-port-index="i-1"
      ></div>
      <div
          v-for="i in (definition.outputs || 0)"
          :key="`out-${i-1}`"
          class="port output"
          data-port-type="output"
          :data-port-index="i-1"
      ></div>
    </div>
    <button v-if="isSelected" class="card-delete-btn" title="删除卡片" @mousedown.stop.prevent="deleteCard">
      <i class="ri-close-line"></i>
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useWorkflowStore } from '../../stores/workflowStore.js';
import { getCardDefinition } from './cardDefinitions.js';
// --- MODIFICATION START ---
import { useModal } from '../../composables/useModal.js';

const modal = useModal();
// --- MODIFICATION END ---

const props = defineProps({
  card: Object,
  status: String,
});
defineEmits(['select-card']);

const store = useWorkflowStore();
const definition = computed(() => getCardDefinition(props.card.type));
const isSelected = computed(() => store.selectedItemId === props.card.id);

const cardStyle = computed(() => ({
  transform: `translate(${props.card.x}px, ${props.card.y}px)`,
}));

// --- MODIFICATION START ---
// Replaced native confirm with the custom modal system.
const deleteCard = async () => {
  try {
    await modal.confirm({
      title: '删除卡片',
      message: `确定要删除卡片 "${definition.value.title}" 吗？`
    });
    store.removeCard(props.card.id);
  } catch (error) {
    // User clicked cancel, do nothing.
  }
};
// --- MODIFICATION END ---
</script>

<style scoped>
.workflow-card {
  position: absolute;
  top: 0;
  left: 0;
  background-color: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-lg);
  padding: var(--spacing-md);
  box-shadow: 0 4px 8px var(--color-shadow);
  cursor: grab;
  width: 180px;
  height: 100px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  z-index: 10;
  will-change: transform;
}
.workflow-card:active { cursor: grabbing; }
.workflow-card.selected {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(90, 90, 235, 0.3), 0 4px 8px var(--color-shadow);
  z-index: 11;
}
.workflow-card.running { border: 2px solid orange; }
.workflow-card.success { border: 2px solid var(--color-success); }
.workflow-card.error { border: 2px solid var(--color-error); }
.card-header { display: flex; align-items: center; margin-bottom: var(--spacing-sm); }
.card-header .icon { font-size: 1.5em; margin-right: var(--spacing-xs); }
.card-header .title { font-weight: bold; font-size: 1.1em; }
.card-content {
  font-size: 0.9em;
  color: #666;
  word-break: break-word;
  overflow: hidden;
  max-height: 40px;
}
.card-delete-btn {
  position: absolute; top: -8px; right: -8px; width: 20px; height: 20px;
  background-color: var(--color-error); color: white; border-radius: 50%;
  display: flex; justify-content: center; align-items: center; font-size: 0.8em;
  cursor: pointer; transition: transform 0.2s ease; z-index: 12; border: none;
}
.card-delete-btn:hover { background-color: #c02b3b; transform: scale(1.1); }
.card-ports { position: absolute; width: 100%; height: 100%; top: 0; left: 0; pointer-events: none; }
.port {
  position: absolute; width: 12px; height: 12px; background-color: var(--color-border);
  border: 1px solid #999; border-radius: 50%; cursor: crosshair; z-index: 20;
  pointer-events: all; transition: all 0.1s ease;
}
.port:hover, .port.active { background-color: var(--color-primary); border-color: var(--color-primary); transform: scale(1.1); }
.port.active { box-shadow: 0 0 0 4px rgba(90, 90, 235, 0.3); }
.port.input { left: -6px; top: 50%; transform: translateY(-50%); }
.port.output { right: -6px; top: 50%; transform: translateY(-50%); }
</style>