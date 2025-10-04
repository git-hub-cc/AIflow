// This file centralizes card definitions to be used across components.
export const cardDefinitions = {
    start: {
        title: '开始',
        icon: 'ri-play-circle-line',
        defaultProperties: { output: 'workflow_start' },
        outputs: 1,
        color: 'var(--color-success)'
    },
    text_input: {
        title: '文本输入',
        icon: 'ri-file-text-line',
        defaultProperties: { value: '默认文本' },
        inputs: 1,
        outputs: 1,
        color: 'var(--color-warning)'
    },
    rag_content: {
        title: 'RAG 内容',
        icon: 'ri-database-2-line',
        defaultProperties: { query: '产品介绍', top_k: 5 },
        inputs: 1,
        outputs: 1,
        color: 'var(--color-rag)'
    },
    llm_call: {
        title: 'LLM 调用',
        icon: 'ri-robot-2-line',
        defaultProperties: { model: 'THUDM/GLM-4-32B-0414', prompt: '提示...' },
        inputs: 1,
        outputs: 1,
        color: 'var(--color-info)'
    },
    agent: {
        title: 'Agent',
        icon: 'ri-account-circle-line',
        defaultProperties: {
            role: '通用助手',
            initial_prompt: '请告诉我如何解决问题。',
            tools: 'web_search,calculator'
        },
        inputs: 1,
        outputs: 1,
        color: 'var(--color-agent)'
    },
    format_output: {
        title: '格式化输出',
        icon: 'ri-code-s-slash-line',
        defaultProperties: { format: 'text', template: '结果：{{input}}' },
        inputs: 1,
        outputs: 1,
        color: 'var(--color-format)'
    },
    end: {
        title: '结束',
        icon: 'ri-stop-circle-line',
        defaultProperties: { result: 'workflow_end' },
        inputs: 1,
        color: 'var(--color-error)'
    }
};

export function getCardDefinition(type) {
    return cardDefinitions[type] || { title: '未知', icon: 'ri-question-mark', defaultProperties: {} };
}