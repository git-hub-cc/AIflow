<template>
  <BaseModal :show="uiStore.modalState.isVisible" :title="uiStore.modalState.title" @close="handleCancel">
    <div class="modal-body">
      <p v-if="uiStore.modalState.message" class="modal-message">{{ uiStore.modalState.message }}</p>
      <div v-if="uiStore.modalState.type === 'prompt'" class="input-group">
        <input type="text" v-model="promptInput" @keyup.enter="handleConfirm" ref="promptInputRef" />
      </div>
    </div>
    <div class="modal-footer">
      <button v-if="uiStore.modalState.type !== 'alert'" class="btn secondary-btn" @click="handleCancel">
        取消
      </button>
      <button class="btn primary-btn" @click="handleConfirm">
        确认
      </button>
    </div>
  </BaseModal>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue';
import BaseModal from './BaseModal.vue';
import { useUiStore } from '../../stores/uiStore';

const uiStore = useUiStore();
const promptInput = ref('');
const promptInputRef = ref(null);

watch(() => uiStore.modalState.isVisible, (isVisible) => {
  if (isVisible) {
    promptInput.value = uiStore.modalState.promptValue || '';
    if (uiStore.modalState.type === 'prompt') {
      nextTick(() => {
        promptInputRef.value?.focus();
      });
    }
  }
});

const handleConfirm = () => {
  const value = uiStore.modalState.type === 'prompt' ? promptInput.value : true;
  uiStore.handleConfirm(value);
};

const handleCancel = () => {
  uiStore.handleCancel();
};
</script>

<style scoped>
.modal-body {
  margin-bottom: var(--spacing-lg);
}
.modal-message {
  white-space: pre-wrap; /* 保留换行符 */
  line-height: 1.6;
  font-size: 1.1em;
  color: var(--color-text-dark);
}
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
}
.input-group {
  margin-top: var(--spacing-md);
  margin-bottom: 0;
}
</style>