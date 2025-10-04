import { defineStore } from 'pinia';
import { ref } from 'vue';
import * as ragService from '../services/ragService.js';

export const useRagStore = defineStore('rag', () => {
    // --- STATE ---
    const documents = ref([]);
    const isInitialized = ref(false);
    const processingStatus = ref('RAG 服务未初始化。');

    // --- ACTIONS ---
    async function initialize() {
        if (isInitialized.value) return;
        try {
            processingStatus.value = '正在初始化 RAG 服务...';
            await ragService.initRAG();
            processingStatus.value = 'RAG 服务已准备就绪。';
            isInitialized.value = true;
            await fetchDocuments();
        } catch (error) {
            console.error("RAG store initialization failed:", error);

            processingStatus.value = `RAG 服务初始化失败: ${error.message}`;
            isInitialized.value = false;
        }
    }

    async function fetchDocuments() {
        if (!isInitialized.value) await initialize();
        try {
            documents.value = await ragService.listDocuments();
        } catch (error) {
            console.error("Failed to fetch RAG documents:", error);
            documents.value = [];
        }
    }

    async function processAndAddDocument(file, onProgress) {
        if (!isInitialized.value) await initialize();
        try {
            await ragService.processDocument(file, onProgress);
            await fetchDocuments(); // Refresh the list after adding
        } catch (error) {
            console.error(`Failed to process document ${file.name}:`, error);
            throw error; // Re-throw to be caught by UI
        }
    }

    async function deleteDocument(fileId) {
        if (!isInitialized.value) await initialize();
        try {
            await ragService.deleteDocument(fileId);
            await fetchDocuments(); // Refresh the list after deleting
        } catch (error) {
            console.error(`Failed to delete document ${fileId}:`, error);
        }
    }
    
    // Auto-initialize when the store is first used
    initialize();

    return {
        documents,
        isInitialized,
        processingStatus,
        fetchDocuments,
        processAndAddDocument,
        deleteDocument,
        initialize, // Expose for manual re-init if needed
    };
});