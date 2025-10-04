<template>
  <aside class="properties-panel">
    <h3>属性</h3>
    <div class="panel-content">
      <div v-if="selectedItem" :key="selectedItem.id">
        <div class="input-group">
          <label>ID</label>
          <input type="text" :value="selectedItem.id" readonly>
        </div>
        <div class="input-group">
          <label>类型</label>
          <input v-if="isCard" type="text" :value="getCardDefinition(selectedItem.type).title" readonly>
          <input v-else type="text" value="连接线" readonly>
        </div>
        
        <!-- Card Specific Properties -->
        <component v-if="isCard" :is="propertyComponent" :card="selectedItem" />
        
        <!-- Connection Properties -->
        <div v-if="isConnection">
          <div class="input-group"><label>起始卡片</label><input type="text" :value="selectedItem.startCardId" readonly></div>
          <div class="input-group"><label>结束卡片</label><input type="text" :value="selectedItem.endCardId" readonly></div>
          <button class="btn secondary-btn" @click="deleteConnection"><i class="ri-delete-bin-line"></i> 删除连线</button>
        </div>

      </div>
      <p v-else class="no-selection-message">请选择一个卡片或连线以编辑其属性。</p>
    </div>
  </aside>
</template>

<script setup>
import { computed, defineAsyncComponent } from 'vue';
import { useWorkflowStore } from '../../stores/workflowStore.js';
import { getCardDefinition } from '../Canvas/cardDefinitions.js';
import DefaultProps from './property-definitions/DefaultProps.vue'

const store = useWorkflowStore();
const selectedItem = computed(() => store.selectedItem);
const isCard = computed(() => store.selectedItemType === 'card');
const isConnection = computed(() => store.selectedItemType === 'connection');

const propertyComponent = computed(() => {
  if (!isCard.value) return null;
  const cardType = selectedItem.value.type;
  // Dynamic import based on card type
  const componentName = cardType.charAt(0).toUpperCase() + cardType.slice(1).replace(/_([a-z])/g, g => g[1].toUpperCase()) + 'Props';
  return defineAsyncComponent({
    loader: () => import(`./property-definitions/${componentName}.vue`).catch(() => DefaultProps),
    // A component to use while the async component is loading
    loadingComponent: { template: '<div>Loading...</div>' },
    // A component to use if the load fails
    errorComponent: DefaultProps,
  });
});

const deleteConnection = () => {
    if (isConnection.value) {
        store.removeConnection(selectedItem.value.id);
    }
}
</script>