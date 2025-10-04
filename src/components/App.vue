<template>
  <div class="app-container">
    <TopBar @run="runWorkflow" @export="exportWorkflow" @import="handleImportClick" @rag="showRagModal = true" />
    <main class="main-content">
      <Toolbox />
      <WorkflowCanvas :execution-status="executionStatus" />
      <PropertiesPanel />
    </main>
    <RagDocsModal v-if="showRagModal" @close="showRagModal = false" />
    <input type="file" ref="fileInputRef" @change="handleFileImport" style="display: none" accept=".json" />
    <GlobalModal />
    <!-- --- MODIFICATION START --- -->
    <ExecutionResultModal
        v-if="uiStore.resultModalState.isVisible"
        :result="uiStore.resultModalState.resultData"
        @close="uiStore.hideResultModal()"
    />
    <!-- --- MODIFICATION END --- -->
  </div>
</template>

<script setup>
import { ref } from 'vue';
import TopBar from './TopBar.vue';
import Toolbox from './Toolbox/Toolbox.vue';
import WorkflowCanvas from './Canvas/WorkflowCanvas.vue';
import PropertiesPanel from './Properties/PropertiesPanel.vue';
import RagDocsModal from './Modals/RagDocsModal.vue';
import { useWorkflowManager } from '../composables/useWorkflowManager.js';
import { useWorkflowStore } from '../stores/workflowStore.js';
import GlobalModal from './Modals/GlobalModal.vue';
import { useModal } from '../composables/useModal.js';
// --- MODIFICATION START ---
import ExecutionResultModal from './Modals/ExecutionResultModal.vue';
import { useUiStore } from '../stores/uiStore.js';

const uiStore = useUiStore();
// --- MODIFICATION END ---

const modal = useModal();
const { runWorkflow, exportWorkflow, executionStatus } = useWorkflowManager();
const store = useWorkflowStore();

const showRagModal = ref(false);
const fileInputRef = ref(null);

const handleImportClick = () => {
  fileInputRef.value.click();
};

const handleFileImport = async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  try {
    await modal.confirm({
      title: '导入工作流',
      message: `确定要导入工作流 "${file.name}" 吗？\n当前画布将被清空。`
    });

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workflowData = JSON.parse(e.target.result);
        if (workflowData && Array.isArray(workflowData.cards) && Array.isArray(workflowData.connections)) {
          store.loadWorkflowData(workflowData);
          modal.alert({ title: '成功', message: `工作流 "${file.name}" 导入成功！` });
        } else {
          modal.alert({ title: '导入失败', message: '文件格式不正确，必须包含 "cards" 和 "connections" 数组。' });
        }
      } catch (error) {
        modal.alert({ title: '导入失败', message: `无法解析 JSON 文件。\n错误: ${error.message}` });
      } finally {
        event.target.value = ''; // Reset file input
      }
    };
    reader.onerror = () => {
      modal.alert({ title: '导入失败', message: '读取文件时发生错误。' });
      event.target.value = '';
    }
    reader.readAsText(file);
  } catch (error) {
    // User cancelled the confirmation modal.
    event.target.value = ''; // Also reset if cancelled
  }
};
</script>