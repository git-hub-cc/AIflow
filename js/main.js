// js/main.js

// 导入工具函数和组件函数
import { generateUniqueId, constrainPosition, clearElementChildren, getBezierPath, sleep, createModal } from './utils.js';
// MODIFIED: 导入 initWorkflowStore 函数
import { apiService, initWorkflowStore } from './services/api.js';
// NEW: 导入所有 RAG 服务中直接用到的函数
import { initRAG, processDocument, listDocuments, deleteDocument } from './services/ragService.js';
// NEW: 导入 PDF.js 的 GlobalWorkerOptions
import { GlobalWorkerOptions } from 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs';
import { createWorkflowCardElement, generatePropertiesHtml, getCardDefinition } from './components/card.js';


// --- 全局状态变量 ---
const workflowCards = []; // 存储所有卡片数据：{ id, type, x, y, properties, element }
const workflowConnections = []; // 存储所有连接数据：{ id, startCardId, startPortIndex, endCardId, endPortIndex, element }
let selectedCardId = null; // 当前选中卡片的ID
let selectedConnectionId = null; // 当前选中连接线的ID

let draggedCardElement = null; // 正在拖拽的画布上的卡片元素
let isDraggingCanvasCard = false; // 标记是否正在拖拽画布上的卡片
let initialMouseX, initialMouseY; // 鼠标按下时在“画布内容坐标系”中的初始坐标
let initialCardX, initialCardY; // 卡片按下时在“画布内容坐标系”中的初始坐标

// 连接线绘制相关
let isDrawingConnection = false; // 标记是否正在绘制连接线
let tempLine = null; // 临时连接线 (SVG path element)
let startPortInfo = null; // 存储连接开始端口的信息 { cardId, portType, portIndex, x, y }
let tempLineTimeoutId = null; // 用于存储 setTimeout 的 ID，控制临时线消失

// NEW: 画布缩放和平移状态
let canvasScale = 1.0; // 当前缩放比例
let canvasPan = { x: 0, y: 0 }; // 当前平移量
const MIN_SCALE = 0.3; // 最小缩放比例
const MAX_SCALE = 2.5; // 最大缩放比例
const ZOOM_SENSITIVITY = 0.001; // 滚轮缩放的灵敏度

// --- DOM 元素引用 ---
const workflowCanvas = document.getElementById('workflow-canvas'); // 外部视口容器
const canvasContent = document.getElementById('canvas-content'); // NEW: 实际可缩放平移的内容容器
const toolboxCardItems = document.querySelectorAll('.toolbox .card-item');
const propertiesPanel = document.getElementById('properties-panel');
const propertiesPanelContent = propertiesPanel.querySelector('.panel-content');
const runWorkflowBtn = document.getElementById('run-workflow-btn');
const saveWorkflowBtn = document.getElementById('save-workflow-btn');
const loadWorkflowBtn = document.getElementById('load-workflow-btn'); // 加载按钮
const manageRagDocsBtn = document.getElementById('manage-rag-docs-btn'); // NEW: RAG 文档管理按钮

// 模态框 DOM 引用
const loadWorkflowModal = document.getElementById('load-workflow-modal');
const savedWorkflowsList = document.getElementById('saved-workflows-list');
const ragDocsModal = document.getElementById('rag-docs-modal'); // NEW: RAG 文档模态框
const ragFileInput = document.getElementById('rag-file-input'); // NEW: RAG 文件输入
const processRagFileBtn = document.getElementById('process-rag-file-btn'); // NEW: RAG 处理按钮
const ragProcessingStatus = document.getElementById('rag-processing-status'); // NEW: RAG 状态显示
const importedRagDocsList = document.getElementById('imported-rag-docs-list'); // NEW: RAG 已导入文档列表

// 模态框实例
const loadModalInstance = createModal(loadWorkflowModal);
const ragDocsModalInstance = createModal(ragDocsModal); // NEW: RAG 模态框实例

let svgCanvas; // SVG 绘图画布


// --- 辅助函数 ---

/**
 * NEW: 更新画布内容容器的CSS transform属性
 */
function updateCanvasTransform() {
    if (canvasContent) {
        canvasContent.style.transform = `translate(${canvasPan.x}px, ${canvasPan.y}px) scale(${canvasScale})`;
    }
}

/**
 * NEW: 将视口坐标（鼠标事件的 clientX/Y）转换为画布内容坐标（考虑缩放和平移）
 * @param {number} clientX - 鼠标的 clientX 屏幕坐标
 * @param {number} clientY - 鼠标的 clientY 屏幕坐标
 * @returns {{x: number, y: number}} 画布内容坐标系中的坐标
 */
function screenToCanvasCoords(clientX, clientY) {
    const rect = workflowCanvas.getBoundingClientRect(); // 获取画布容器在视口中的位置

    // 1. 鼠标相对于 workflowCanvas 容器的内部坐标
    const viewportX = clientX - rect.left;
    const viewportY = clientY - rect.top;

    // 2. 调整平移和缩放，得到在 canvasContent 坐标系中的位置
    // 公式: canvasX = (viewportX - panX) / scale
    const canvasX = (viewportX - canvasPan.x) / canvasScale;
    const canvasY = (viewportY - canvasPan.y) / canvasScale;

    return { x: canvasX, y: canvasY };
}


/**
 * 根据ID获取卡片数据对象
 * @param {string} id - 卡片ID
 * @returns {object|undefined} 卡片数据对象或 undefined
 */
function getCardById(id) {
    return workflowCards.find(card => card.id === id);
}

/**
 * 根据ID获取连接数据对象
 * @param {string} id - 连接ID
 * @returns {object|undefined} 连接数据对象或 undefined
 */
function getConnectionById(id) {
    return workflowConnections.find(conn => conn.id === id);
}


/**
 * 获取端口在画布内容坐标系上的绝对中心坐标
 * MODIFIED: 不再需要 canvasEl 参数，直接通过 getBoundingClientRect 和 screenToCanvasCoords 转换
 * @param {HTMLElement} portEl - 端口DOM元素
 * @returns {{x: number, y: number}} 端口中心坐标
 */
function getPortCenter(portEl) {
    const portRect = portEl.getBoundingClientRect(); // 获取端口在屏幕上的位置

    // 计算端口中心的屏幕坐标
    const portCenterX = portRect.left + portRect.width / 2;
    const portCenterY = portRect.top + portRect.height / 2;

    // 将屏幕坐标转换为画布内容坐标系中的坐标
    return screenToCanvasCoords(portCenterX, portCenterY);
}

/**
 * 添加一个新卡片到画布和工作流数据中
 * @param {string} type - 卡片类型
 * @param {number} x - 放置的X坐标 (画布内容坐标系)
 * @param {number} y - 放置的Y坐标 (画布内容坐标系)
 * @param {object} [properties={}] - 卡片的属性，用于加载时
 * @param {string} [id=generateUniqueId()] - 卡片ID，用于加载时
 */
function addCardToCanvas(type, x, y, properties = {}, id = generateUniqueId()) {
    const definition = getCardDefinition(type);
    const cardProperties = { ...definition.defaultProperties, ...properties }; // 合并默认属性和传入属性

    const newCardData = {
        id: id,
        type: type,
        x: x,
        y: y,
        properties: cardProperties,
        element: null
    };

    // 1. 创建卡片DOM元素
    const cardElement = createWorkflowCardElement(newCardData);

    // 2. 将卡片添加到画布内容区 (MODIFIED: append to canvasContent)
    canvasContent.appendChild(cardElement);
    newCardData.element = cardElement; // 存储DOM引用

    // 3. 将卡片数据添加到全局状态
    workflowCards.push(newCardData);

    // 4. 绑定删除按钮事件
    const deleteBtn = cardElement.querySelector('.card-delete-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // 阻止事件冒泡到卡片选中
            removeCardFromCanvas(newCardData.id);
        });
    }

    // 5. 选中新创建的卡片 (如果不是从加载流程过来的，且是用户手动拖拽)
    if (!properties.isLoaded) { // 简单标记，避免加载大量卡片时逐个选中
        selectItem(newCardData.id, 'card');
    }
}

/**
 * 从画布和工作流数据中移除一个卡片
 * @param {string} cardId - 要移除的卡片ID
 */
function removeCardFromCanvas(cardId) {
    const cardIndex = workflowCards.findIndex(card => card.id === cardId);
    if (cardIndex > -1) {
        const cardToRemove = workflowCards[cardIndex];
        // 移除卡片DOM元素
        if (cardToRemove.element && cardToRemove.element.parentNode) {
            cardToRemove.element.parentNode.removeChild(cardToRemove.element);
        }
        workflowCards.splice(cardIndex, 1); // 从数组中移除

        // 移除所有与该卡片相关的连接线
        const connectionsToRemove = workflowConnections.filter(conn =>
            conn.startCardId === cardId || conn.endCardId === cardId
        );
        connectionsToRemove.forEach(conn => removeConnection(conn.id));

        console.log(`Card ${cardId} removed along with its connections.`);
        if (selectedCardId === cardId) {
            selectItem(null, null); // 取消选中
        }
    }
}


/**
 * 选中一个卡片或连接线并更新UI
 * @param {string|null} id - 要选中的ID，或 null 表示取消选中
 * @param {'card'|'connection'|null} type - 要选中的类型
 */
function selectItem(id, type) {
    // 取消之前选中卡片的样式
    if (selectedCardId) {
        const prevSelectedCardEl = getCardById(selectedCardId)?.element;
        if (prevSelectedCardEl) {
            prevSelectedCardEl.classList.remove('selected');
        }
    }
    // 取消之前选中连接线的样式
    if (selectedConnectionId) {
        const prevSelectedConnEl = getConnectionById(selectedConnectionId)?.element;
        if (prevSelectedConnEl) {
            prevSelectedConnEl.classList.remove('selected');
        }
    }

    selectedCardId = null;
    selectedConnectionId = null;

    if (id && type) {
        if (type === 'card') {
            selectedCardId = id;
            const currentSelectedCard = getCardById(selectedCardId);
            if (currentSelectedCard && currentSelectedCard.element) {
                currentSelectedCard.element.classList.add('selected');
                updatePropertiesPanel(currentSelectedCard, 'card');
            }
        } else if (type === 'connection') {
            selectedConnectionId = id;
            const currentSelectedConn = getConnectionById(selectedConnectionId);
            if (currentSelectedConn && currentSelectedConn.element) {
                currentSelectedConn.element.classList.add('selected');
                updatePropertiesPanel(currentSelectedConn, 'connection');
            }
        }
    } else {
        // 如果没有选中任何项，显示默认消息
        clearElementChildren(propertiesPanelContent);
        propertiesPanelContent.innerHTML = '<p class="no-selection-message">请选择一个卡片或连线以编辑其属性。</p>';
    }
}


/**
 * 更新右侧属性面板的内容和事件监听
 * @param {object} data - 当前选中卡片或连接线的数据
 * @param {'card'|'connection'} type - 选中项的类型
 */
function updatePropertiesPanel(data, type) {
    clearElementChildren(propertiesPanelContent);

    if (type === 'card') {
        propertiesPanelContent.innerHTML = generatePropertiesHtml(data);
        // 监听属性面板中的输入变化
        propertiesPanelContent.querySelectorAll('input[data-prop-key], textarea[data-prop-key], select[data-prop-key]').forEach(input => {
            input.addEventListener('input', (e) => {
                const propKey = e.target.dataset.propKey;
                let value = e.target.value;

                // 特殊处理数字类型的属性，如 top_k
                if (e.target.type === 'number') {
                    value = parseInt(value);
                    if (isNaN(value)) { // 如果输入无效，则设置为默认值或上次的有效值
                        value = parseInt(e.target.defaultValue || e.target.dataset.previousValue || 1); // 默认为1
                    }
                    e.target.dataset.previousValue = value; // 存储当前有效值
                }

                // 更新卡片数据
                data.properties[propKey] = value;
                // 同时更新画布上卡片的简要显示
                if (data.element) {
                    const cardContentEl = data.element.querySelector('.card-content');
                    if (cardContentEl) {
                        // 重新生成卡片内容以更新显示
                        const updatedCardElement = createWorkflowCardElement(data);
                        // 只替换 .card-content 的内容，而不是整个卡片，以保留事件监听器等
                        const newCardContent = updatedCardElement.querySelector('.card-content');
                        if (newCardContent) {
                            cardContentEl.innerHTML = newCardContent.innerHTML;
                        }
                    }
                }
                console.log(`Card ${data.id} property "${propKey}" updated to: "${value}"`);
            });
        });
    } else if (type === 'connection') {
        propertiesPanelContent.innerHTML = `
            <h4>连接线属性</h4>
            <div class="input-group">
                <label for="conn-id-display">ID</label>
                <input type="text" id="conn-id-display" value="${data.id}" readonly>
            </div>
            <div class="input-group">
                <label for="conn-start-card">起始卡片</label>
                <input type="text" id="conn-start-card" value="${data.startCardId}" readonly>
            </div>
            <div class="input-group">
                <label for="conn-end-card">结束卡片</label>
                <input type="text" id="conn-end-card" value="${data.endCardId}" readonly>
            </div>
            <button class="btn secondary-btn" id="delete-connection-btn"><i class="ri-delete-bin-line"></i> 删除连线</button>
        `;
        document.getElementById('delete-connection-btn').addEventListener('click', () => {
            removeConnection(data.id);
        });
    }
}

/**
 * 绘制或更新一条连接线
 * @param {string} connectionId - 连接线ID
 * @param {object} startCoords - 起始点 {x, y} (画布内容坐标系)
 * @param {object} endCoords - 结束点 {x, y} (画布内容坐标系)
 * @param {boolean} isTemp - 是否为临时线
 */
function drawConnection(connectionId, startCoords, endCoords, isTemp = false) {
    let pathElement = document.getElementById(connectionId);
    if (!pathElement) {
        pathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        pathElement.setAttribute('id', connectionId);
        pathElement.classList.add('connection-path');
        svgCanvas.appendChild(pathElement);
    }

    const pathData = getBezierPath(startCoords.x, startCoords.y, endCoords.x, endCoords.y);
    pathElement.setAttribute('d', pathData);

    if (isTemp) {
        pathElement.classList.add('temp-line');
    } else {
        pathElement.classList.remove('temp-line');
    }
}

/**
 * 根据卡片位置更新所有相关连接线的绘制
 * MODIFIED: getPortCenter 调用不再需要第二个参数
 * @param {string} cardId - 移动的卡片ID
 */
function redrawConnectionsForCard(cardId) {
    workflowConnections.forEach(conn => {
        if (conn.startCardId === cardId || conn.endCardId === cardId) {
            const startCard = getCardById(conn.startCardId);
            const endCard = getCardById(conn.endCardId);

            if (startCard && endCard) {
                // 重新获取端口坐标
                const startPortEl = startCard.element.querySelector(`.port.output[data-port-index="${conn.startPortIndex}"]`);
                const endPortEl = endCard.element.querySelector(`.port.input[data-port-index="${conn.endPortIndex}"]`);

                if (startPortEl && endPortEl) {
                    const startCoords = getPortCenter(startPortEl); // 调用更新后的函数
                    const endCoords = getPortCenter(endPortEl);     // 调用更新后的函数
                    drawConnection(conn.id, startCoords, endCoords);
                }
            }
        }
    });
}

/**
 * 移除指定ID的连接线
 * @param {string} connectionId - 要移除的连接线ID
 */
function removeConnection(connectionId) {
    const index = workflowConnections.findIndex(conn => conn.id === connectionId);
    if (index > -1) {
        const connEl = workflowConnections[index].element;
        if (connEl && connEl.parentNode) {
            connEl.parentNode.removeChild(connEl);
        }
        workflowConnections.splice(index, 1);
        console.log(`Connection ${connectionId} removed.`);
        if (selectedConnectionId === connectionId) {
            selectItem(null, null); // 取消选中
        }
    }
}

/**
 * 移除临时连接线，如果存在。
 * @param {boolean} immediate - 如果为 true，则立即移除；否则等待 tempLineTimeout ms 后移除。
 */
function removeTempLine(immediate = false) {
    if (tempLineTimeoutId) {
        clearTimeout(tempLineTimeoutId);
        tempLineTimeoutId = null;
    }

    if (tempLine && svgCanvas.contains(tempLine)) {
        if (immediate) {
            svgCanvas.removeChild(tempLine);
            tempLine = null;
            console.log('Temporary line removed immediately.');
        } else {
            // 设置 2 秒后移除
            tempLineTimeoutId = setTimeout(() => {
                if (tempLine && svgCanvas.contains(tempLine)) {
                    svgCanvas.removeChild(tempLine);
                    tempLine = null;
                    console.log('Temporary line removed after 2 seconds.');
                }
            }, 2000); // 2000 毫秒 = 2 秒
        }
    }
    // 清除所有端口高亮，无论是否移除临时线，确保鼠标抬起时端口高亮被清除
    workflowCanvas.querySelectorAll('.port').forEach(port => port.classList.remove('active'));
}

/**
 * 清空画布上的所有卡片和连接线
 */
function clearCanvas() {
    // 移除所有卡片（也会自动移除相关连接线）
    workflowCards.slice().forEach(card => removeCardFromCanvas(card.id));
    // 确保所有连接线被移除（虽然 removeCardFromCanvas 已处理大部分）
    workflowConnections.slice().forEach(conn => removeConnection(conn.id));
    selectItem(null, null); // 取消所有选中
    console.log('Canvas cleared.');
}

/**
 * 遍历图结构，获取下一个执行的卡片及其输入。
 * @param {object} currentCardData - 当前卡片的数据
 * @param {object} previousOutput - 上一个卡片的输出
 * @returns {{nextCard: object|null, input: any}} - 下一个卡片的数据和输入
 */
function getNextExecutionStep(currentCardData, previousOutput) {
    const nextConnection = workflowConnections.find(
        conn => conn.startCardId === currentCardData.id
    );

    if (nextConnection) {
        const nextCard = getCardById(nextConnection.endCardId);
        if (!nextCard) {
            throw new Error(`Connection ${nextConnection.id} points to non-existent card ${nextConnection.endCardId}`);
        }
        return { nextCard: nextCard, input: previousOutput };
    }
    return { nextCard: null, input: null };
}

// --- 工作流执行逻辑 (模拟 LangChain Chains, RAG, Agents, Format) ---

/**
 * 执行工作流中单个卡片的逻辑
 * @param {object} cardData - 卡片的数据
 * @param {object} previousOutput - 上一个卡片的输出
 * @returns {Promise<any>} 当前卡片的输出
 */
async function executeCard(cardData, previousOutput) {
    const cardEl = cardData.element;
    let output = null;

    if (!cardEl) {
        console.error(`Card element not found for ${cardData.id}`);
        throw new Error(`Card element not found for ${cardData.id}`);
    }

    // 视觉反馈：卡片边框变色表示执行中
    cardEl.style.borderColor = 'orange';

    try {
        switch (cardData.type) {
            case 'start':
                console.log(`Executing Start Card: ${cardData.id}`);
                output = { value: cardData.properties.output || 'workflow_started_data' };
                break;
            case 'text_input':
                console.log(`Executing Text Input Card: ${cardData.id}`);
                output = { value: cardData.properties.value };
                break;
            case 'rag_content':
                console.log(`Executing RAG Content Card: ${cardData.id}`);
                let ragQuery = cardData.properties.query;
                const ragTopK = cardData.properties.top_k || 5;

                // 如果前一个卡片有输出，将其作为 RAG 查询的输入
                if (previousOutput && previousOutput.value) {
                    ragQuery = ragQuery.replace(/\{\{input\}\}/g, previousOutput.value);
                } else if (previousOutput && previousOutput.text) { // LLM或Agent的文本输出
                    ragQuery = ragQuery.replace(/\{\{input\}\}/g, previousOutput.text);
                }
                // 移除所有未匹配的 {{变量}}
                ragQuery = ragQuery.replace(/\{\{.*?\}\}/g, '');
                // 如果查询为空，给一个默认值
                if (!ragQuery.trim()) {
                    ragQuery = "请提供相关信息"; // 或者抛出错误
                    console.warn("RAG Card query is empty, using default:", ragQuery);
                }

                console.log(`RAG Query: "${ragQuery}", Top K: ${ragTopK}`);
                // NEW: 调用 apiService.getRAGContent，它现在会调用本地 ragService
                const ragResult = await apiService.getRAGContent(ragQuery, ragTopK);
                output = { content: ragResult.content };
                break;
            case 'llm_call':
                console.log(`Executing LLM Call Card: ${cardData.id}`);
                let prompt = cardData.properties.prompt;
                let model = cardData.properties.model;

                if (previousOutput) {
                    if (previousOutput.value) {
                        prompt = prompt.replace(/\{\{input\}\}/g, previousOutput.value);
                    }
                    if (previousOutput.content) {
                        prompt = prompt.replace(/\{\{rag_content\}\}/g, previousOutput.content);
                    }
                    if (previousOutput.tool_result) {
                        prompt = prompt.replace(/\{\{tool_result\}\}/g, previousOutput.tool_result);
                    }
                    if (previousOutput.text) {
                        if (!prompt.includes('{{input}}') && !prompt.includes('{{rag_content}}')) {
                            prompt = prompt.replace(/\{\{input\}\}/g, previousOutput.text);
                        }
                    }
                }
                prompt = prompt.replace(/\{\{.*?\}\}/g, '');

                console.log(`LLM Input Prompt: ${prompt}`);
                const llmResult = await apiService.callLLM(prompt, model);
                output = { text: llmResult.text, tool_call: llmResult.tool_call };
                break;
            case 'agent':
                console.log(`Executing Agent Card: ${cardData.id}`);
                let agentPrompt = cardData.properties.initial_prompt;
                const availableTools = cardData.properties.tools.split(',').map(t => t.trim()).filter(t => t);
                let agentOutput = null;
                let agentIteration = 0;
                const MAX_AGENT_ITERATIONS = 5;

                if (previousOutput) {
                    if (previousOutput.value) {
                        agentPrompt = agentPrompt.replace(/\{\{input\}\}/g, previousOutput.value);
                    }
                    if (previousOutput.content) {
                        agentPrompt = agentPrompt.replace(/\{\{rag_content\}\}/g, previousOutput.content);
                    }
                    if (previousOutput.text) {
                        agentPrompt = agentPrompt.replace(/\{\{input\}\}/g, previousOutput.text);
                    }
                }
                agentPrompt = agentPrompt.replace(/\{\{.*?\}\}/g, '');

                while (agentIteration < MAX_AGENT_ITERATIONS) {
                    console.log(`Agent Iteration ${agentIteration + 1}:`);
                    const toolListPrompt = availableTools.length > 0 ? `\n\n你可用的工具：${availableTools.join(', ')}\n\n如果你需要调用工具，请使用格式：调用工具 tool_name({"param1": "value1", "param2": "value2"})。` : '\n\n你没有任何可用的工具。';
                    const agentLLMPrompt = `${agentPrompt}${toolListPrompt}\n\n否则直接给出答案。`;

                    console.log(`Agent calling LLM with prompt:\n${agentLLMPrompt}`);
                    const agentLLMResponse = await apiService.callLLM(agentLLMPrompt, 'THUDM/GLM-4-32B-0414');

                    if (agentLLMResponse.tool_call && availableTools.includes(agentLLMResponse.tool_call.name)) {
                        console.log(`Agent calls tool: ${agentLLMResponse.tool_call.name} with args:`, agentLLMResponse.tool_call.args);
                        const toolResult = await apiService.executeTool(agentLLMResponse.tool_call.name, agentLLMResponse.tool_call.args);
                        console.log("Tool Result:", toolResult.result);
                        agentPrompt += `\n\n工具 ${agentLLMResponse.tool_call.name} 的结果：${toolResult.result}\n\n根据这个结果，你的下一步是什么？`;
                        agentOutput = { text: `Agent执行了工具${agentLLMResponse.tool_call.name}, 结果: ${toolResult.result}`, tool_result: toolResult.result };
                    } else if (agentLLMResponse.tool_call) {
                        console.warn(`Agent tried to call unknown or unavailable tool: ${agentLLMResponse.tool_call.name}`);
                        agentPrompt += `\n\n警告：工具 ${agentLLMResponse.tool_call.name} 不可用。请重新思考。`;
                        agentOutput = { text: `Agent试图调用不可用工具: ${agentLLMResponse.tool_call.name}` };
                    }
                    else {
                        console.log("Agent final answer:", agentLLMResponse.text);
                        agentOutput = { text: agentLLMResponse.text };
                        break;
                    }
                    agentIteration++;
                    if (agentIteration >= MAX_AGENT_ITERATIONS) {
                        console.warn("Agent reached max iterations without a final answer.");
                        agentOutput = { text: "Agent达到最大迭代次数，未能给出最终答案。", final_incomplete_response: agentLLMResponse.text };
                    }
                }
                output = agentOutput;
                break;
            case 'format_output':
                console.log(`Executing Format Output Card: ${cardData.id}`);
                const formatType = cardData.properties.format;
                let formatTemplate = cardData.properties.template;
                let formattedResult = '';

                if (previousOutput) {
                    if (previousOutput.text) {
                        formatTemplate = formatTemplate.replace(/\{\{input\}\}/g, previousOutput.text);
                    } else if (previousOutput.value) {
                        formatTemplate = formatTemplate.replace(/\{\{input\}\}/g, previousOutput.value);
                    } else if (previousOutput.content) {
                        formatTemplate = formatTemplate.replace(/\{\{input\}\}/g, previousOutput.content);
                    } else {
                        formatTemplate = formatTemplate.replace(/\{\{input\}\}/g, JSON.stringify(previousOutput || {}, null, 2));
                    }
                }
                formatTemplate = formatTemplate.replace(/\{\{.*?\}\}/g, '');

                switch (formatType) {
                    case 'text':
                        formattedResult = formatTemplate;
                        break;
                    case 'json':
                        try {
                            let jsonString = formatTemplate.trim();
                            if (!jsonString.startsWith('{') && !jsonString.startsWith('[')) {
                                // 如果不是标准的JSON开头，尝试包裹成一个简单的JSON对象
                                jsonString = JSON.stringify({ result: formatTemplate });
                            }
                            formattedResult = JSON.stringify(JSON.parse(jsonString), null, 2);
                        } catch (e) {
                            formattedResult = `{"error": "Invalid JSON format in template or input could not be parsed as JSON", "template_content": "${formatTemplate.replace(/"/g, '\\"')}"}`;
                            console.error("Format Output JSON parsing error:", e);
                        }
                        break;
                    case 'xml':
                        const escapedContent = formatTemplate.replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"').replace(/'/g, "'");
                        formattedResult = `<response><data>${escapedContent}</data></response>`;
                        break;
                    default:
                        formattedResult = formatTemplate;
                }
                output = { formatted_text: formattedResult };
                break;
            case 'end':
                console.log(`Executing End Card: ${cardData.id}`);
                output = { final_result: previousOutput };
                break;
            default:
                console.warn(`Unknown card type: ${cardData.type}`);
                output = { error: `Unknown card type: ${cardData.type}` };
                break;
        }
        cardEl.style.borderColor = 'green';
        return output;
    } catch (error) {
        console.error(`Error executing card ${cardData.id} (${cardData.type}):`, error);
        cardEl.style.borderColor = 'red';
        throw error;
    }
}

/**
 * 运行整个工作流
 */
async function runWorkflow() {
    if (workflowCards.length === 0) {
        alert('请先在画布上放置卡片！');
        return;
    }

    // 1. 恢复所有卡片和连线默认颜色
    workflowCards.forEach(card => {
        if (card.element) card.element.style.borderColor = '';
    });
    workflowConnections.forEach(conn => {
        if (conn.element) conn.element.classList.remove('selected'); // 移除选中样式
        if (conn.element) conn.element.style.stroke = 'var(--color-line-default)'; // 恢复线条颜色
        if (conn.element) conn.element.style.strokeWidth = '2'; // 恢复线条宽度
    });


    console.log('--- 运行工作流 ---');

    // 2. 查找起始卡片
    const startCard = workflowCards.find(card => card.type === 'start');
    if (!startCard) {
        alert('工作流需要一个“开始”卡片！');
        return;
    }

    let currentCard = startCard;
    let previousOutput = null; // 用于传递链式调用的结果

    try {
        while (currentCard) {
            const currentCardId = currentCard.id;
            console.log(`--- 开始执行卡片: ${getCardDefinition(currentCard.type).title} (${currentCardId}) ---`);

            // 视觉反馈：高亮当前执行的卡片
            currentCard.element.style.borderColor = 'var(--color-primary)';
            await sleep(200); // 稍作停顿

            // 执行当前卡片
            const output = await executeCard(currentCard, previousOutput);
            previousOutput = output; // 更新传递给下一个卡片的输出

            // 查找下一个连接的卡片
            const nextConnection = workflowConnections.find(
                conn => conn.startCardId === currentCardId
            );

            if (nextConnection) {
                // 视觉反馈：高亮当前执行的连线
                if (nextConnection.element) {
                    nextConnection.element.style.stroke = 'green';
                    nextConnection.element.style.strokeWidth = '3';
                }
                await sleep(300); // 稍微停顿一下，让用户看到连线高亮

                currentCard.element.style.borderColor = 'green'; // 当前卡片执行完毕，变回绿色
                currentCard = getCardById(nextConnection.endCardId);
                if (!currentCard) {
                    throw new Error(`Connection ${nextConnection.id} points to non-existent card ${nextConnection.endCardId}`);
                }
            } else {
                // 如果没有下一个连接，检查是否为结束卡片
                if (currentCard.type !== 'end') {
                    currentCard.element.style.borderColor = 'red'; // 未结束但无后续，标记为错误
                    alert(`工作流在卡片 ${getCardDefinition(currentCard.type).title} (${currentCardId}) 处终止，因为它没有后续连接，且不是“结束”卡片。`);
                } else {
                    currentCard.element.style.borderColor = 'green'; // 结束卡片执行完毕
                    alert(`工作流执行完成！最终结果：\n${JSON.stringify(previousOutput, null, 2)}`); // 美化JSON输出
                }
                currentCard = null; // 终止循环
            }
        }
    } catch (error) {
        console.error('工作流执行过程中发生错误:', error);
        alert(`工作流执行失败：${error.message}`);
    } finally {
        console.log('--- 工作流执行结束 ---');
        // 恢复所有卡片和连线默认颜色
        workflowCards.forEach(card => {
            if (card.element && card.element.style.borderColor !== 'red') { // 失败的卡片保持红色
                card.element.style.borderColor = ''; // 恢复默认
            }
        });
        workflowConnections.forEach(conn => {
            if (conn.element) {
                conn.element.style.stroke = 'var(--color-line-default)';
                conn.element.style.strokeWidth = '2';
            }
        });
    }
}

/**
 * 弹出保存工作流对话框并处理保存逻辑
 */
async function promptAndSaveWorkflow() {
    const workflowName = prompt('请输入工作流的名称：', '我的AI工作流');
    if (!workflowName) {
        alert('保存已取消。');
        return;
    }
    // NEW: 简单校验名称是否合法作为 IndexedDB key
    // IndexedDB key 不能包含 null (U+0000) 字节，且一般不建议包含 / # $ . [ ] 等影响文件路径或对象引用的字符
    if (workflowName.length > 50 || /[\/#\[\]$\0]/.test(workflowName)) {
        alert('工作流名称不能超过50个字符，且不能包含 / # $ . [ ] \\0 (空字节) 等特殊字符。');
        return;
    }

    const workflowDataToSave = {
        cards: workflowCards.map(c => ({
            id: c.id,
            type: c.type,
            x: c.x,
            y: c.y,
            properties: c.properties
        })),
        connections: workflowConnections.map(conn => ({
            id: conn.id,
            startCardId: conn.startCardId,
            startPortIndex: conn.startPortIndex,
            endCardId: conn.endCardId,
            endPortIndex: conn.endPortIndex
        }))
    };
    try {
        // 调用 apiService 中已修改为 localforage 的 saveWorkflow
        const result = await apiService.saveWorkflow(workflowDataToSave, workflowName);
        alert(result.message);
        console.log('保存成功:', result);
    } catch (error) {
        console.error('保存失败:', error);
        alert(`保存失败！${error.message}`); // 显示更详细的错误信息
    }
}

/**
 * 加载并显示已保存的工作流列表
 */
async function displaySavedWorkflows() {
    clearElementChildren(savedWorkflowsList);
    savedWorkflowsList.innerHTML = '<p class="no-workflows-message">加载中...</p>'; // 加载提示

    try {
        // 调用 apiService 中已修改为 localforage 的 getSavedWorkflowNames
        const workflowNames = await apiService.getSavedWorkflowNames();
        if (workflowNames.length === 0) {
            savedWorkflowsList.innerHTML = '<p class="no-workflows-message">没有已保存的工作流。</p>';
            return;
        }

        clearElementChildren(savedWorkflowsList); // 清空加载提示
        workflowNames.forEach(name => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'saved-workflow-item';
            itemDiv.innerHTML = `
                <span class="title">${name}</span>
                <div class="actions">
                    <button class="btn primary-btn load-item-btn" data-workflow-name="${name}"><i class="ri-upload-line"></i> 加载</button>
                    <button class="btn secondary-btn delete-item-btn" data-workflow-name="${name}"><i class="ri-delete-bin-line"></i> 删除</button>
                </div>
            `;
            savedWorkflowsList.appendChild(itemDiv);
        });

        // 绑定加载和删除事件
        savedWorkflowsList.querySelectorAll('.load-item-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const nameToLoad = e.currentTarget.dataset.workflowName;
                if (confirm(`确定要加载工作流 "${nameToLoad}" 吗？当前画布上的内容将被清空。`)) {
                    await loadWorkflow(nameToLoad);
                    loadModalInstance.hide(); // 加载成功后关闭模态框
                }
            });
        });

        savedWorkflowsList.querySelectorAll('.delete-item-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const nameToDelete = e.currentTarget.dataset.workflowName;
                if (confirm(`确定要删除工作流 "${nameToDelete}" 吗？此操作不可撤销。`)) {
                    // 调用 apiService 中已修改为 localforage 的 deleteWorkflow
                    const deleteResult = await apiService.deleteWorkflow(nameToDelete);
                    alert(deleteResult.message); // 显示删除结果
                    displaySavedWorkflows(); // 刷新列表
                }
            });
        });

    } catch (error) {
        console.error('加载已保存工作流列表失败:', error);
        savedWorkflowsList.innerHTML = '<p class="no-workflows-message" style="color: red;">加载失败：' + error.message + '</p>';
    }
}

/**
 * 根据名称加载一个工作流到画布
 * MODIFIED: getPortCenter 调用不再需要第二个参数
 * @param {string} workflowName - 要加载的工作流名称
 */
async function loadWorkflow(workflowName) {
    clearCanvas(); // 清空当前画布

    try {
        // 调用 apiService 中已修改为 localforage 的 loadWorkflow
        const result = await apiService.loadWorkflow(workflowName);
        if (result.success) {
            const workflowData = result.data;
            // 重新构建卡片
            workflowData.cards.forEach(card => {
                // 添加一个标记，避免在加载时自动选中
                addCardToCanvas(card.type, card.x, card.y, { ...card.properties, isLoaded: true }, card.id);
            });

            // 重新绘制连接线
            workflowData.connections.forEach(conn => {
                const startCard = getCardById(conn.startCardId);
                const endCard = getCardById(conn.endCardId);

                if (startCard && endCard) {
                    const startPortEl = startCard.element.querySelector(`.port.output[data-port-index="${conn.startPortIndex}"]`);
                    const endPortEl = endCard.element.querySelector(`.port.input[data-port-index="${conn.endPortIndex}"]`);

                    if (startPortEl && endPortEl) {
                        const startCoords = getPortCenter(startPortEl); // 调用更新后的函数
                        const endCoords = getPortCenter(endPortEl);     // 调用更新后的函数

                        // 直接使用加载的ID。鉴于ID生成方式，冲突概率极低，这里直接使用加载的ID。
                        const connectionIdToUse = conn.id;

                        drawConnection(connectionIdToUse, startCoords, endCoords);
                        // 存储连接线的DOM引用，并绑定点击事件
                        const newConnectionEl = document.getElementById(connectionIdToUse);
                        if (newConnectionEl) {
                            const newConnection = {
                                id: connectionIdToUse,
                                startCardId: conn.startCardId,
                                startPortIndex: conn.startPortIndex,
                                endCardId: conn.endCardId,
                                endPortIndex: conn.endPortIndex,
                                element: newConnectionEl // 存储SVG Path元素的引用
                            };
                            workflowConnections.push(newConnection); // 将加载的连接数据添加到数组

                            newConnectionEl.addEventListener('click', (ev) => { // 使用 ev 避免与外部 e 冲突
                                ev.stopPropagation(); // 阻止事件冒泡到画布，以免取消选中
                                selectItem(newConnection.id, 'connection');
                            });
                        }
                    } else {
                        console.warn(`Connection ${conn.id} ports not found after card reload. StartPort: ${startPortEl}, EndPort: ${endPortEl}`);
                    }
                } else {
                    console.warn(`Connection ${conn.id} involves missing cards. Skipped. StartCard: ${startCard}, EndCard: ${endCard}`);
                }
            });

            // NEW: 加载工作流后重置缩放和平移，使内容适应视图
            canvasScale = 1.0;
            canvasPan = { x: 0, y: 0 };
            updateCanvasTransform();

            console.log(`Workflow "${workflowName}" loaded successfully.`);
        } else {
            alert(result.message);
        }
    } catch (error) {
        console.error('加载工作流失败:', error);
        alert(`加载工作流失败！${error.message}`); // 显示更详细的错误信息
    }
}


// --- 事件监听器 ---

document.addEventListener('DOMContentLoaded', async () => {
    // MODIFIED: 确保在初始化 RAG 服务之前，初始化 workflowStore
    console.log("Initializing workflow store...");
    await initWorkflowStore(); // 首先初始化工作流存储
    console.log("Workflow store initialized.");

    // NEW: 设置 PDF.js worker 路径
    // 放在这里确保 DOMContentLoaded 事件触发时 Worker 路径已经设置
    GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs';
    console.log("PDF.js Worker path set.");

    // 初始化 SVG 画布
    svgCanvas = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgCanvas.classList.add('connection-svg');
    canvasContent.appendChild(svgCanvas); // 将 SVG 放到 canvasContent 中

    // 初始化画布变换
    updateCanvasTransform();

    // NEW: 初始化 RAG 服务 (在 DOMContentLoaded 中异步进行)
    try {
        ragProcessingStatus.textContent = 'RAG 服务正在初始化，请稍候... (首次加载模型可能需要时间)';
        await initRAG();
        ragProcessingStatus.textContent = 'RAG 服务已准备就绪。';
        console.log("RAG service initialized on DOMContentLoaded.");
    } catch (error) {
        ragProcessingStatus.textContent = `RAG 服务初始化失败: ${error.message}`;
        ragProcessingStatus.style.color = 'red';
        console.error("Failed to initialize RAG service:", error);
    }


    // 1. Toolbox 卡片拖拽开始
    toolboxCardItems.forEach(item => {
        item.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', e.target.dataset.cardType); // 传递卡片类型
            e.dataTransfer.effectAllowed = 'copy'; // 允许复制效果
        });
    });

    // 2. 画布拖拽区域事件
    workflowCanvas.addEventListener('dragover', (e) => {
        e.preventDefault(); // 允许放置 (droppable)
        e.dataTransfer.dropEffect = 'copy';
    });

    workflowCanvas.addEventListener('drop', (e) => {
        e.preventDefault();
        const cardType = e.dataTransfer.getData('text/plain');
        if (cardType) {
            // MODIFIED: 获取拖放位置相对于“画布内容坐标系”的坐标
            const { x, y } = screenToCanvasCoords(e.clientX, e.clientY);

            // 考虑卡片中心点放置，使其在鼠标释放位置居中
            const CARD_WIDTH = 180;
            const CARD_HEIGHT = 100; // 假设平均高度
            const centeredX = x - CARD_WIDTH / 2;
            const centeredY = y - CARD_HEIGHT / 2;

            addCardToCanvas(cardType, centeredX, centeredY);
        }
    });

    // 3. 画布内卡片拖拽 (mousedown, mousemove, mouseup)
    workflowCanvas.addEventListener('mousedown', (e) => {
        const targetCard = e.target.closest('.workflow-card');
        const targetPort = e.target.closest('.port'); // 检查是否点击了端口
        const targetPath = e.target.closest('.connection-path'); // 检查是否点击了连接线
        const targetDeleteBtn = e.target.closest('.card-delete-btn'); // 检查是否点击了删除按钮

        // 如果点击了删除按钮，阻止其他事件发生
        if (targetDeleteBtn) {
            e.preventDefault();
            return;
        }

        if (targetPort) {
            // 开始绘制连接线
            e.preventDefault();
            isDrawingConnection = true;
            selectItem(null, null); // 取消所有选中
            targetPort.classList.add('active'); // 高亮起始端口

            const cardId = targetPort.closest('.workflow-card').dataset.cardId;
            const portType = targetPort.dataset.portType;
            const portIndex = parseInt(targetPort.dataset.portIndex);

            startPortInfo = {
                cardId,
                portType,
                portIndex,
                element: targetPort, // 存储端口DOM引用，用于高亮
                ...getPortCenter(targetPort) // 调用更新后的函数
            };

            // 创建临时连接线
            tempLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            tempLine.setAttribute('id', 'temp-connection'); // 给临时线一个固定ID
            tempLine.classList.add('connection-path', 'temp-line');
            svgCanvas.appendChild(tempLine);

            console.log(`Started drawing connection from card ${cardId}, port ${portType}-${portIndex}`);

        } else if (targetCard) {
            // 开始拖拽卡片
            e.preventDefault();
            isDraggingCanvasCard = true;
            draggedCardElement = targetCard;

            selectItem(draggedCardElement.dataset.cardId, 'card'); // 选中被拖拽的卡片

            // MODIFIED: 记录鼠标在“画布内容坐标系”中的初始位置
            const canvasCoords = screenToCanvasCoords(e.clientX, e.clientY);
            initialMouseX = canvasCoords.x;
            initialMouseY = canvasCoords.y;

            initialCardX = parseFloat(draggedCardElement.style.left);
            initialCardY = parseFloat(draggedCardElement.style.top);

            draggedCardElement.style.zIndex = '1000'; // 提升 z-index
            draggedCardElement.classList.add('is-dragging');

        } else if (targetPath) {
            // 选中连接线
            e.preventDefault();
            selectItem(targetPath.id, 'connection');

        } else {
            // 点击画布空白处，取消选中所有
            selectItem(null, null);
            // TODO: 在这里可以添加画布平移（Panning）逻辑，如果需要鼠标拖拽空白处平移画布
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (isDraggingCanvasCard && draggedCardElement) {
            e.preventDefault();

            // MODIFIED: 计算在“画布内容坐标系”中的位移
            const currentCanvasCoords = screenToCanvasCoords(e.clientX, e.clientY);
            const dx = currentCanvasCoords.x - initialMouseX;
            const dy = currentCanvasCoords.y - initialMouseY;

            let newX = initialCardX + dx;
            let newY = initialCardY + dy;

            // constrainPosition 的 container 参数现在传递 canvasContent
            const constrainedPos = constrainPosition(draggedCardElement, canvasContent, newX, newY);
            newX = constrainedPos.x;
            newY = constrainedPos.y;

            draggedCardElement.style.left = `${newX}px`;
            draggedCardElement.style.top = `${newY}px`;

            const currentCardData = getCardById(draggedCardElement.dataset.cardId);
            if (currentCardData) {
                currentCardData.x = newX;
                currentCardData.y = newY;
                redrawConnectionsForCard(currentCardData.id); // 移动时重绘连线
            }
        } else if (isDrawingConnection && tempLine) {
            e.preventDefault();
            // MODIFIED: 计算临时线的终点在“画布内容坐标系”中的位置
            const { x: endX, y: endY } = screenToCanvasCoords(e.clientX, e.clientY);

            drawConnection('temp-connection', startPortInfo, { x: endX, y: endY }, true);

            // 高亮潜在的目标端口
            const targetPort = e.target.closest('.port');
            workflowCanvas.querySelectorAll('.port').forEach(port => port.classList.remove('active')); // 清除所有端口高亮
            if (targetPort && targetPort !== startPortInfo.element) { // 避免高亮起始端口
                const targetCardId = targetPort.closest('.workflow-card').dataset.cardId;
                const targetPortType = targetPort.dataset.portType;

                // 检查是否是合法的连接：输出端口连输入端口，且不是同一张卡片
                // 确保起始端口和目标端口类型不一致
                if (startPortInfo.cardId !== targetCardId && startPortInfo.portType !== targetPortType) {
                    targetPort.classList.add('active');
                }
            }
        }
    });

    document.addEventListener('mouseup', (e) => {
        // 结束卡片拖拽
        if (isDraggingCanvasCard && draggedCardElement) {
            draggedCardElement.style.zIndex = '11';
            draggedCardElement.classList.remove('is-dragging');
            draggedCardElement = null;
            isDraggingCanvasCard = false;
        }

        // 结束连接线绘制
        if (isDrawingConnection) {
            isDrawingConnection = false;

            const targetPort = e.target.closest('.port');
            let connectionCreated = false; // 标记是否成功创建了连接

            if (targetPort) {
                const endCardEl = targetPort.closest('.workflow-card');
                const endCardId = endCardEl.dataset.cardId;
                const endPortType = targetPort.dataset.portType;
                const endPortIndex = parseInt(targetPort.dataset.portIndex);

                // 检查连接是否合法：从输出到输入，且不是连接到同一张卡片
                const isValidConnection =
                    startPortInfo.cardId !== endCardId && // 不能连接到自己
                    startPortInfo.portType === 'output' && // 起始必须是输出端口
                    endPortType === 'input'; // 结束必须是输入端口

                if (isValidConnection) {
                    // 检查是否已存在相同的连接，避免重复
                    const existingConnection = workflowConnections.find(conn =>
                        conn.startCardId === startPortInfo.cardId &&
                        conn.startPortIndex === startPortInfo.portIndex &&
                        conn.endCardId === endCardId &&
                        conn.endPortIndex === endPortIndex
                    );

                    if (!existingConnection) {
                        const connectionId = generateUniqueId();
                        const newConnection = {
                            id: connectionId,
                            startCardId: startPortInfo.cardId,
                            startPortIndex: startPortInfo.portIndex,
                            endCardId: endCardId,
                            endPortIndex: endPortIndex,
                            element: null // 存储SVG Path元素的引用
                        };
                        workflowConnections.push(newConnection);

                        const startCard = getCardById(startPortInfo.cardId);
                        const endCard = getCardById(endCardId);
                        const startPortEl = startCard.element.querySelector(`.port.output[data-port-index="${startPortInfo.portIndex}"]`);
                        const endPortEl = endCard.element.querySelector(`.port.input[data-port-index="${endPortIndex}"]`);

                        if (startPortEl && endPortEl) {
                            const startCoords = getPortCenter(startPortEl); // 调用更新后的函数
                            const endCoords = getPortCenter(endPortEl);     // 调用更新后的函数

                            drawConnection(connectionId, startCoords, endCoords);
                            newConnection.element = document.getElementById(connectionId); // 存储DOM引用

                            // 监听连接线的点击事件，以便选中
                            newConnection.element.addEventListener('click', (ev) => { // 使用 ev 避免与外部 e 冲突
                                ev.stopPropagation(); // 阻止事件冒泡到画布，以免取消选中
                                selectItem(newConnection.id, 'connection');
                            });
                            connectionCreated = true;
                            console.log(`Created connection from ${startPortInfo.cardId} to ${endCardId}`);
                        }
                    } else {
                        console.log('Connection already exists.');
                    }
                } else {
                    console.log('Invalid connection attempt.');
                }
            }

            // 无论是否成功创建连接，都延迟或立即移除临时线
            if (connectionCreated) {
                removeTempLine(true); // 连接成功则立即移除
            } else {
                removeTempLine(false); // 连接不成功则 2 秒后移除
            }
            startPortInfo = null; // 清理
        }
    });

    // 监听键盘事件，用于删除选中项
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Delete') {
            e.preventDefault(); // 阻止浏览器默认行为，如回退
            if (selectedCardId) {
                removeCardFromCanvas(selectedCardId);
            } else if (selectedConnectionId) {
                removeConnection(selectedConnectionId);
            }
        }
    });

    // NEW: 7. 画布缩放 (Ctrl + Wheel)
    workflowCanvas.addEventListener('wheel', (e) => {
        if (e.ctrlKey) {
            e.preventDefault(); // 禁用浏览器默认缩放

            const rect = workflowCanvas.getBoundingClientRect();
            // 鼠标相对于 workflowCanvas 容器的内部坐标
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            // 计算缩放因子。e.deltaY > 0 表示向下滚动（缩小）。
            const zoom = 1 - e.deltaY * ZOOM_SENSITIVITY;

            const oldScale = canvasScale;
            let newScale = canvasScale * zoom;

            // 限制缩放范围
            newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));

            // 如果缩放比例没有变化（达到最小或最大值），则返回
            if (newScale === oldScale) return;

            canvasScale = newScale;

            // 计算新的平移位置，以实现向鼠标位置缩放
            // 确保缩放中心在鼠标位置
            // 公式: newPan = mousePos_in_viewport - (mousePos_in_viewport - oldPan) * (newScale / oldScale)
            const scaleRatio = canvasScale / oldScale;

            canvasPan.x = mouseX - (mouseX - canvasPan.x) * scaleRatio;
            canvasPan.y = mouseY - (mouseY - canvasPan.y) * scaleRatio;

            updateCanvasTransform();
        }
        // TODO: 可以在这里添加 else 分支来实现滚轮平移画布
    }, { passive: false }); // passive: false 是必须的，以便调用 preventDefault()


    // 4. 运行工作流按钮
    runWorkflowBtn.addEventListener('click', runWorkflow);

    // 5. 保存工作流按钮
    saveWorkflowBtn.addEventListener('click', promptAndSaveWorkflow);

    // 6. 加载工作流按钮
    loadWorkflowBtn.addEventListener('click', () => {
        loadModalInstance.show(); // 先显示模态框
        displaySavedWorkflows(); // 再加载并显示已保存工作流列表
    });

    // NEW: 7. RAG 文档管理按钮事件
    manageRagDocsBtn.addEventListener('click', async () => {
        ragDocsModalInstance.show();
        await displayImportedRagDocs(); // 显示已导入文档列表
    });

    // NEW: RAG 文件输入框改变事件
    ragFileInput.addEventListener('change', () => {
        processRagFileBtn.disabled = ragFileInput.files.length === 0;
    });

    // NEW: 处理 RAG 文件按钮点击事件
    processRagFileBtn.addEventListener('click', async () => {
        if (ragFileInput.files.length === 0) {
            alert('请选择至少一个文件。');
            return;
        }

        processRagFileBtn.disabled = true; // 禁用按钮，避免重复点击
        ragProcessingStatus.textContent = '开始处理文件...';
        ragProcessingStatus.style.color = 'var(--color-info)';

        for (const file of ragFileInput.files) {
            try {
                // 使用进度回调更新状态
                const result = await processDocument(file, (msg) => {
                    ragProcessingStatus.textContent = msg;
                });
                console.log(result);
                ragProcessingStatus.textContent = `文件 "${file.name}" 处理成功！`;
                ragProcessingStatus.style.color = 'var(--color-success)';
            } catch (error) {
                console.error(`处理文件 "${file.name}" 失败:`, error);
                ragProcessingStatus.textContent = `文件 "${file.name}" 处理失败: ${error.message}`;
                ragProcessingStatus.style.color = 'var(--color-error)';
                break; // 任意一个文件失败就停止
            }
            await sleep(500); // 稍作等待，让用户看到状态
        }
        ragFileInput.value = ''; // 清空文件选择器
        processRagFileBtn.disabled = false; // 重新启用按钮
        await displayImportedRagDocs(); // 刷新文档列表
    });

    // NEW: 显示已导入 RAG 文档列表
    async function displayImportedRagDocs() {
        clearElementChildren(importedRagDocsList);
        importedRagDocsList.innerHTML = '<p class="no-workflows-message">加载中...</p>';

        try {
            const docs = await listDocuments();
            if (docs.length === 0) {
                importedRagDocsList.innerHTML = '<p class="no-workflows-message">没有已导入的文档。</p>';
                return;
            }

            clearElementChildren(importedRagDocsList);
            docs.forEach(doc => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'saved-workflow-item'; // 复用保存工作流的样式
                itemDiv.innerHTML = `
                    <span class="title">${doc.fileName} (${doc.chunkCount} 块)</span>
                    <div class="actions">
                        <button class="btn secondary-btn delete-rag-doc-btn" data-file-id="${doc.fileId}"><i class="ri-delete-bin-line"></i> 删除</button>
                    </div>
                `;
                importedRagDocsList.appendChild(itemDiv);
            });

            importedRagDocsList.querySelectorAll('.delete-rag-doc-btn').forEach(button => {
                button.addEventListener('click', async (e) => {
                    const fileIdToDelete = e.currentTarget.dataset.fileId;
                    const fileNameToDelete = e.currentTarget.closest('.saved-workflow-item').querySelector('.title').textContent.split(' ')[0]; // 获取文件名
                    if (confirm(`确定要删除文档 "${fileNameToDelete}" 吗？此操作不可撤销。`)) {
                        try {
                            await deleteDocument(fileIdToDelete);
                            alert(`文档 "${fileNameToDelete}" 已删除。`);
                            await displayImportedRagDocs(); // 刷新列表
                        } catch (error) {
                            alert(`删除失败: ${error.message}`);
                            console.error("Error deleting document:", error);
                        }
                    }
                });
            });

        } catch (error) {
            console.error('加载已导入 RAG 文档列表失败:', error);
            importedRagDocsList.innerHTML = '<p class="no-workflows-message" style="color: red;">加载失败：' + error.message + '</p>';
        }
    }
});