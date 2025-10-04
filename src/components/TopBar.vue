<template>
  <header class="top-bar">
    <div class="app-title">AI Workflow Builder</div>
    <div class="actions">
      <button @click="$emit('run')" class="btn primary-btn"><i class="ri-play-fill"></i> 运行</button>
      <button @click="$emit('export')" class="btn secondary-btn"><i class="ri-download-2-line"></i> 导出</button>
      <button @click="$emit('import')" class="btn secondary-btn"><i class="ri-upload-2-line"></i> 导入</button>
      <button @click="$emit('rag')" class="btn secondary-btn"><i class="ri-book-open-line"></i> RAG 文档</button>
    </div>
  </header>
</template>

<script setup>
defineEmits(['run', 'export', 'import', 'rag']);
</script>