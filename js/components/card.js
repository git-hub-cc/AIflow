// js/components/card.js

const CARD_DEFINITIONS = {
    start: {
        title: '开始',
        icon: 'ri-play-circle-line',
        defaultProperties: { output: 'workflow_start' },
        outputs: 1
    },
    llm_call: {
        title: 'LLM 调用',
        icon: 'ri-robot-2-line',
        defaultProperties: { model: 'THUDM/GLM-4-32B-0414', prompt: '请在这里输入你的提示...' },
        inputs: 1,
        outputs: 1
    },
    text_input: {
        title: '文本输入',
        icon: 'ri-file-text-line',
        defaultProperties: { value: '默认文本' },
        outputs: 1
    },
    rag_content: {
        title: 'RAG 内容',
        icon: 'ri-database-2-line',
        defaultProperties: { query: '产品介绍', top_k: 5 }, // 更改为 query 和 top_k
        inputs: 1, // 可以从上一个卡片获取查询
        outputs: 1
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
        outputs: 1
    },
    format_output: {
        title: '格式化输出',
        icon: 'ri-code-s-slash-line',
        defaultProperties: { format: 'text', template: '结果：{{input}}' },
        inputs: 1,
        outputs: 1
    },
    end: {
        title: '结束',
        icon: 'ri-stop-circle-line',
        defaultProperties: { result: 'workflow_end' },
        inputs: 1
    }
};

export function createWorkflowCardElement(cardData) {
    const cardEl = document.createElement('div');
    cardEl.className = 'workflow-card';
    cardEl.setAttribute('data-card-id', cardData.id);
    cardEl.setAttribute('data-card-type', cardData.type);
    cardEl.style.left = `${cardData.x}px`;
    cardEl.style.top = `${cardData.y}px`;

    const definition = CARD_DEFINITIONS[cardData.type] || { title: '未知类型', icon: 'ri-question-mark' };

    let cardContentHtml = '';
    switch (cardData.type) {
        case 'llm_call':
            cardContentHtml = `<p>${cardData.properties.prompt.substring(0, Math.min(cardData.properties.prompt.length, 30))}...</p>`;
            break;
        case 'text_input':
            cardContentHtml = `<p>"${cardData.properties.value.substring(0, Math.min(cardData.properties.value.length, 20))}..."</p>`;
            break;
        case 'rag_content':
            // RAG Card content now shows query and top_k
            cardContentHtml = `<p>查询: "${cardData.properties.query}"<br/>Top K: ${cardData.properties.top_k}</p>`;
            break;
        case 'agent':
            cardContentHtml = `<p>角色: "${cardData.properties.role}"</p>`;
            break;
        case 'format_output':
            cardContentHtml = `<p>格式: ${cardData.properties.format}</p>`;
            break;
        default:
            cardContentHtml = '';
            break;
    }

    cardEl.innerHTML = `
        <div class="card-header">
            <i class="${definition.icon} icon"></i>
            <span class="title">${definition.title}</span>
        </div>
        <div class="card-content">
            ${cardContentHtml}
        </div>
        <div class="card-ports">
            ${Array.from({ length: definition.inputs || 0 }).map((_, i) =>
        `<div class="port input" data-port-type="input" data-port-index="${i}"></div>`
    ).join('')}
            ${Array.from({ length: definition.outputs || 0 }).map((_, i) =>
        `<div class="port output" data-port-type="output" data-port-index="${i}"></div>`
    ).join('')}
        </div>
        <div class="card-delete-btn" title="删除卡片"><i class="ri-close-line"></i></div>
    `;

    return cardEl;
}

export function getCardDefinition(type) {
    return CARD_DEFINITIONS[type];
}

export function generatePropertiesHtml(cardData) {
    const definition = CARD_DEFINITIONS[cardData.type];
    if (!definition) {
        return '<p>无法找到该卡片类型的定义。</p>';
    }

    let html = `
        <div class="input-group">
            <label for="card-id-display">ID</label>
            <input type="text" id="card-id-display" value="${cardData.id}" readonly>
        </div>
        <div class="input-group">
            <label for="card-type-display">类型</label>
            <input type="text" id="card-type-display" value="${definition.title}" readonly>
        </div>
    `;

    switch (cardData.type) {
        // ... (llm_call, text_input 保持不变) ...
        case 'llm_call':
            html += `
                <div class="input-group">
                    <label for="llm-model">LLM 模型</label>
                    <input type="text" id="llm-model" value="${cardData.properties.model || ''}" data-prop-key="model">
                </div>
                <div class="input-group">
                    <label for="llm-prompt">提示 (Prompt) <br/> <small>可用变量: {{input}}, {{rag_content}}, {{tool_result}}</small></label>
                    <textarea id="llm-prompt" data-prop-key="prompt">${cardData.properties.prompt || ''}</textarea>
                </div>
            `;
            break;
        case 'text_input':
            html += `
                <div class="input-group">
                    <label for="text-input-value">输入内容</label>
                    <textarea id="text-input-value" data-prop-key="value">${cardData.properties.value || ''}</textarea>
                </div>
            `;
            break;
        case 'rag_content':
            html += `
                <div class="input-group">
                    <label for="rag-query">检索查询 (Query) <br/> <small>可用变量: {{input}}</small></label>
                    <input type="text" id="rag-query" value="${cardData.properties.query || ''}" data-prop-key="query">
                </div>
                <div class="input-group">
                    <label for="rag-top-k">检索数量 (Top K)</label>
                    <input type="number" id="rag-top-k" value="${cardData.properties.top_k || 5}" data-prop-key="top_k" min="1">
                </div>
            `;
            break;
        case 'agent': // 新增 Agent 卡片属性
            html += `
                <div class="input-group">
                    <label for="agent-role">角色 (Role)</label>
                    <input type="text" id="agent-role" value="${cardData.properties.role || ''}" data-prop-key="role">
                </div>
                <div class="input-group">
                    <label for="agent-initial-prompt">初始指令 (Initial Prompt) <br/> <small>可用变量: {{input}}, {{rag_content}}</small></label>
                    <textarea id="agent-initial-prompt" data-prop-key="initial_prompt">${cardData.properties.initial_prompt || ''}</textarea>
                </div>
                <div class="input-group">
                    <label for="agent-tools">可用工具 (逗号分隔，如: web_search,calculator)</label>
                    <input type="text" id="agent-tools" value="${cardData.properties.tools || ''}" data-prop-key="tools">
                </div>
            `;
            break;
        case 'format_output': // 新增 Format Output 卡片属性
            html += `
                <div class="input-group">
                    <label for="format-type">输出格式</label>
                    <select id="format-type" data-prop-key="format">
                        <option value="text" ${cardData.properties.format === 'text' ? 'selected' : ''}>文本</option>
                        <option value="json" ${cardData.properties.format === 'json' ? 'selected' : ''}>JSON</option>
                        <option value="xml" ${cardData.properties.format === 'xml' ? 'selected' : ''}>XML</option>
                    </select>
                </div>
                <div class="input-group">
                    <label for="format-template">输出模板 (可使用 {{input}})</label>
                    <textarea id="format-template" data-prop-key="template">${cardData.properties.template || ''}</textarea>
                </div>
            `;
            break;
        case 'start':
            html += `
                <div class="input-group">
                    <label for="start-output">输出变量名</label>
                    <input type="text" id="start-output" value="${cardData.properties.output || ''}" data-prop-key="output">
                </div>
            `;
            break;
        case 'end':
            html += `
                <div class="input-group">
                    <label for="end-result">结果变量名</label>
                    <input type="text" id="end-result" value="${cardData.properties.result || ''}" data-prop-key="result">
                </div>
            `;
            break;
    }

    return html;
}