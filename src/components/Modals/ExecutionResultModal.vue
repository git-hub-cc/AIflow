<template>
  <BaseModal :show="true" title="工作流执行结果" @close="$emit('close')">
    <div class="result-content">
      <pre><code>{{ formattedResult }}</code></pre>
    </div>
    <div class="result-footer">
      <button class="btn secondary-btn" @click="copyToClipboard">
        <i class="ri-clipboard-line"></i> {{ copyButtonText }}
      </button>
      <button class="btn primary-btn" @click="$emit('close')">
        关闭
      </button>
    </div>
  </BaseModal>
</template>

<script setup>
import { ref, computed } from 'vue';
import BaseModal from './BaseModal.vue';

const props = defineProps({
  result: Object,
});
defineEmits(['close']);

const copyButtonText = ref('复制内容');

const formattedResult = computed(() => {
  // 最终输出被包裹在 result.final_result.formatted_text 中
  const formattedText = props.result?.final_result?.formatted_text;
  if (typeof formattedText !== 'string') {
    // 为非预期结构提供降级显示
    return JSON.stringify(props.result, null, 2);
  }

  try {
    // 示例工作流的最终节点输出的是一个 JSON 字符串
    const parsed = JSON.parse(formattedText);

    // 该 JSON 包含 "details" 键，其值是 Agent 节点的输出（可能也是一个 JSON 字符串）
    if (parsed && typeof parsed.details === 'string') {
      let detailsContent = parsed.details;
      try {
        // 尝试将 details 的内容再次解析并美化，以获得更好的可读性
        detailsContent = JSON.stringify(JSON.parse(detailsContent), null, 2);
      } catch (e) {
        // 如果 details 不是有效的 JSON，则按原样显示
      }
      return `消息: ${parsed.message}\n\n详情:\n${detailsContent}`;
    }

    // 如果没有 "details"，则美化整个解析后的对象
    return JSON.stringify(parsed, null, 2);
  } catch (e) {
    // 如果 formattedText 本身不是 JSON 字符串，则直接返回
    return formattedText;
  }
});

const copyToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(formattedResult.value);
    copyButtonText.value = '已复制!';
    setTimeout(() => {
      copyButtonText.value = '复制内容';
    }, 2000);
  } catch (err) {
    console.error('复制内容失败: ', err);
    copyButtonText.value = '复制失败';
  }
};
</script>

<style scoped>
.result-content {
  background-color: #f7f9fc;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-md);
  padding: var(--spacing-md);
  max-height: 60vh;
  overflow-y: auto;
  margin-bottom: var(--spacing-lg);
}
.result-content pre {
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.9em;
  color: #333;
}
.result-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
}
</style>