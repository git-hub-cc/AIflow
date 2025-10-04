<template>
  <BaseModal :show="true" title="RAG 文档管理" @close="$emit('close')">
    <div class="input-group">
      <label for="rag-file-input">选择文件 (PDF 或 TXT)</label>
      <input type="file" id="rag-file-input" accept=".pdf,.txt" multiple @change="onFileChange">
    </div>
    <button class="btn primary-btn" @click="processFiles" :disabled="!selectedFiles.length || isProcessing">
      <i class="ri-add-line"></i> {{ isProcessing ? '处理中...' : '添加并处理' }}
    </button>
    <p id="rag-processing-status">{{ ragStore.processingStatus }}</p>

    <h3 style="margin-top: var(--spacing-lg);">已导入文档</h3>
    <div class="saved-items-list">
      <p v-if="!ragStore.isInitialized" class="no-items-message">正在初始化...</p>
      <p v-else-if="ragStore.documents.length === 0" class="no-items-message">没有已导入的文档。</p>
      <div v-else>
        <div v-for="doc in ragStore.documents" :key="doc.fileId" class="saved-item">
          <span class="title">{{ doc.fileName }} ({{ doc.chunkCount }} 块)</span>
          <div class="actions">
            <button class="btn secondary-btn" @click="deleteDoc(doc)"><i class="ri-delete-bin-line"></i> 删除</button>
          </div>
        </div>
      </div>
    </div>
    <p style="margin-top: 10px; font-size: 0.8em; color: #888;">
      注意：文件存储在本地 IndexedDB 中，不会上传到服务器。
    </p>
  </BaseModal>
</template>

<script setup>
import { ref } from 'vue';
import BaseModal from './BaseModal.vue';
import { useRagStore } from '../../stores/ragStore.js';
// --- MODIFICATION START ---
import { useModal } from '../../composables/useModal.js';

const modal = useModal();
// --- MODIFICATION END ---

defineEmits(['close']);

const ragStore = useRagStore();
const selectedFiles = ref([]);
const isProcessing = ref(false);

const onFileChange = (event) => {
  selectedFiles.value = Array.from(event.target.files);
};

const processFiles = async () => {
  if (!selectedFiles.value.length) return;
  isProcessing.value = true;
  for (const file of selectedFiles.value) {
    try {
      await ragStore.processAndAddDocument(file, (msg) => {
        // This callback can be used to update a more granular progress
        console.log(msg);
      });
    } catch (error) {
      // --- MODIFICATION START ---
      await modal.alert({ title: '处理失败', message: `处理文件 ${file.name} 失败: ${error.message}` });
      // --- MODIFICATION END ---
      break;
    }
  }
  isProcessing.value = false;
  selectedFiles.value = [];
  // Clear the file input
  const fileInput = document.getElementById('rag-file-input');
  if (fileInput) fileInput.value = '';
};

// --- MODIFICATION START ---
// Replaced native confirm with the custom modal system.
const deleteDoc = async (doc) => {
  try {
    await modal.confirm({
      title: '删除文档',
      message: `确定要删除文档 "${doc.fileName}" 吗？此操作不可撤销。`
    });
    await ragStore.deleteDocument(doc.fileId);
  } catch (error) {
    // User clicked cancel, do nothing.
  }
};
// --- MODIFICATION END ---
</script>