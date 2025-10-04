import { ref } from 'vue';
import { useWorkflowStore } from '../stores/workflowStore.js';
import { apiService } from '../services/apiService.js';
import { getCardDefinition } from '../components/Canvas/cardDefinitions.js';
import { sleep } from '../utils';
import { useModal } from './useModal.js';
import { useUiStore } from '../stores/uiStore';

export function useWorkflowManager() {
    const store = useWorkflowStore();
    const isRunning = ref(false);
    const executionStatus = ref({}); // { [cardId]: 'pending' | 'running' | 'success' | 'error' }
    const modal = useModal();
    const uiStore = useUiStore();

    function getNextExecutionStep(currentCardId) {
        const nextConnection = store.connections.find(
            conn => conn.startCardId === currentCardId
        );
        if (nextConnection) {
            const nextCard = store.getCardById(nextConnection.endCardId);
            if (nextCard) {
                return { nextCard, connection: nextConnection };
            }
        }
        return { nextCard: null, connection: null };
    }

    async function executeCard(cardData, previousOutput) {
        executionStatus.value[cardData.id] = 'running';
        await sleep(200);

        try {
            let output = null;
            // This giant switch statement contains the core logic for each card type.
            switch (cardData.type) {
                case 'start':
                    output = { value: cardData.properties.output || 'workflow_started_data' };
                    break;
                case 'text_input':
                    output = { value: cardData.properties.value };
                    break;
                case 'rag_content': {
                    let ragQuery = cardData.properties.query;
                    if (previousOutput?.value) ragQuery = ragQuery.replace(/\{\{input\}\}/g, previousOutput.value);
                    else if (previousOutput?.text) ragQuery = ragQuery.replace(/\{\{input\}\}/g, previousOutput.text);
                    ragQuery = ragQuery.replace(/\{\{.*?\}\}/g, '');
                    if (!ragQuery.trim()) ragQuery = "请提供相关信息";
                    const ragResult = await apiService.getRAGContent(ragQuery, cardData.properties.top_k || 5);
                    output = { content: ragResult.content };
                    break;
                }
                case 'llm_call': {
                    let prompt = cardData.properties.prompt;
                    if (previousOutput) {
                        if (previousOutput.value) prompt = prompt.replace(/\{\{input\}\}/g, previousOutput.value);
                        if (previousOutput.content) prompt = prompt.replace(/\{\{rag_content\}\}/g, previousOutput.content);
                        if (previousOutput.tool_result) prompt = prompt.replace(/\{\{tool_result\}\}/g, previousOutput.tool_result);
                        if (previousOutput.text && !prompt.includes('{{input}}') && !prompt.includes('{{rag_content}}')) prompt = prompt.replace(/\{\{input\}\}/g, previousOutput.text);
                    }
                    prompt = prompt.replace(/\{\{.*?\}\}/g, '');
                    const llmResult = await apiService.callLLM(prompt, cardData.properties.model);
                    const toolCallMatch = llmResult.text.match(/调用工具\s+(\w+)\((.*)\)/);
                    if(toolCallMatch) {
                        try {
                            const toolName = toolCallMatch[1];
                            const argsStr = toolCallMatch[2];
                            const args = JSON.parse(argsStr.replace(/'/g, '"'));
                            llmResult.tool_call = { name: toolName, args: args };
                        } catch(e) {
                            console.error("Failed to parse tool call arguments:", e);
                            llmResult.tool_call = null;
                        }
                    }
                    output = { text: llmResult.text, tool_call: llmResult.tool_call };
                    break;
                }
                case 'agent': {
                    let agentPrompt = cardData.properties.initial_prompt;
                    const availableTools = cardData.properties.tools.split(',').map(t => t.trim()).filter(t => t);
                    let agentOutput = null;
                    const MAX_AGENT_ITERATIONS = 5;

                    if (previousOutput) {
                        if (previousOutput.value) agentPrompt = agentPrompt.replace(/\{\{input\}\}/g, previousOutput.value);
                        if (previousOutput.content) agentPrompt = agentPrompt.replace(/\{\{rag_content\}\}/g, previousOutput.content);
                        if (previousOutput.text) agentPrompt = agentPrompt.replace(/\{\{input\}\}/g, previousOutput.text);
                    }
                    agentPrompt = agentPrompt.replace(/\{\{.*?\}\}/g, '');

                    for (let i = 0; i < MAX_AGENT_ITERATIONS; i++) {
                        const toolListPrompt = availableTools.length > 0 ? `\n\n你可用的工具：${availableTools.join(', ')}...\n\n如果你需要调用工具，请使用格式：调用工具 tool_name({"param1": "value1"})。` : '\n\n你没有任何可用的工具。';
                        const agentLLMPrompt = `${agentPrompt}${toolListPrompt}\n\n否则直接给出答案。`;
                        const agentLLMResponse = await apiService.callLLM(agentLLMPrompt, 'THUDM/GLM-4-32B-0414');

                        const toolCallMatch = agentLLMResponse.text.match(/调用工具\s+(\w+)\((.*)\)/);
                        let tool_call = null;
                        if(toolCallMatch) {
                            try {
                                const toolName = toolCallMatch[1];
                                const argsStr = toolCallMatch[2];
                                const args = JSON.parse(argsStr.replace(/'/g, '"'));
                                tool_call = { name: toolName, args: args };
                            } catch(e) {
                                console.error("Agent failed to parse tool call:", e);
                            }
                        }

                        if (tool_call && availableTools.includes(tool_call.name)) {
                            const toolResult = await apiService.executeTool(tool_call.name, tool_call.args);
                            agentPrompt += `\n\n工具 ${tool_call.name} 的结果：${toolResult.result}\n\n根据这个结果，你的下一步是什么？`;
                            agentOutput = { text: `Agent执行了工具${tool_call.name}`, tool_result: toolResult.result };
                        } else {
                            agentOutput = { text: agentLLMResponse.text };
                            break;
                        }
                    }
                    output = agentOutput;
                    break;
                }
                case 'format_output': {
                    let formatTemplate = cardData.properties.template;
                    if (previousOutput) {
                        if (previousOutput.text) formatTemplate = formatTemplate.replace(/\{\{input\}\}/g, previousOutput.text);
                        else if (previousOutput.value) formatTemplate = formatTemplate.replace(/\{\{input\}\}/g, previousOutput.value);
                        else if (previousOutput.content) formatTemplate = formatTemplate.replace(/\{\{input\}\}/g, previousOutput.content);
                        else formatTemplate = formatTemplate.replace(/\{\{input\}\}/g, JSON.stringify(previousOutput || {}, null, 2));
                    }
                    formatTemplate = formatTemplate.replace(/\{\{.*?\}\}/g, '');
                    output = { formatted_text: formatTemplate };
                    break;
                }
                case 'end':
                    output = { final_result: previousOutput };
                    break;
                default:
                    output = { error: `Unknown card type: ${cardData.type}` };
                    break;
            }
            executionStatus.value[cardData.id] = 'success';
            return output;
        } catch (error) {
            console.error(`Error executing card ${cardData.id} (${cardData.type}):`, error);
            executionStatus.value[cardData.id] = 'error';
            throw error;
        }
    }

    async function runWorkflow() {
        if (store.cards.length === 0) {
            await modal.alert({ title: '无法运行', message: '请先在画布上放置卡片！' });
            return;
        }
        isRunning.value = true;
        executionStatus.value = {};
        store.cards.forEach(card => executionStatus.value[card.id] = 'pending');

        const startCard = store.cards.find(card => card.type === 'start');
        if (!startCard) {
            await modal.alert({ title: '错误', message: '工作流需要一个“开始”卡片！' });
            isRunning.value = false;
            return;
        }

        let currentCard = startCard;
        let previousOutput = null;

        try {
            while (currentCard) {
                const output = await executeCard(currentCard, previousOutput);
                previousOutput = output;

                const nextStep = getNextExecutionStep(currentCard.id);
                if (nextStep.nextCard) {
                    currentCard = nextStep.nextCard;
                } else {
                    if (currentCard.type !== 'end') {
                        executionStatus.value[currentCard.id] = 'error';
                        await modal.alert({
                            title: '工作流终止',
                            message: `工作流在卡片 ${getCardDefinition(currentCard.type).title} (${currentCard.id}) 处终止。`
                        });
                    } else {
                        uiStore.showResultModal(previousOutput);
                    }
                    currentCard = null; // End loop
                }
            }
        } catch (error) {
            console.error('工作流执行过程中发生错误:', error);
            await modal.alert({ title: '执行失败', message: `工作流执行失败：${error.message}` });
        } finally {
            isRunning.value = false;
        }
    }

    async function exportWorkflow() {
        if (store.cards.length === 0) {
            await modal.alert({ title: '无法导出', message: '画布是空的，无法导出。' });
            return;
        }

        let workflowName;
        try {
            workflowName = await modal.prompt({
                title: '导出工作流',
                message: '请输入要导出的文件名：',
                defaultValue: 'my-ai-workflow'
            });
            if (!workflowName) return; // User entered empty string
        } catch (error) {
            return; // User cancelled prompt
        }

        let workflowDataToSave = {
            cards: store.cards.map(c => ({ id: c.id, type: c.type, x: c.x, y: c.y, properties: c.properties })),
            connections: store.connections.map(c => ({
                id: c.id, startCardId: c.startCardId, startPortIndex: c.startPortIndex,
                endCardId: c.endCardId, endPortIndex: c.endPortIndex
            }))
        };
        workflowDataToSave = JSON.parse(JSON.stringify(workflowDataToSave));

        try {
            const jsonString = JSON.stringify(workflowDataToSave, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${workflowName.replace(/[^a-z0-9-]/gi, '_').toLowerCase()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            // --- MODIFICATION START ---
            // 移除不准确的成功提示。
            // 浏览器自身的下载UI会为用户提供足够的反馈。
            // await modal.alert({ title: '成功', message: `工作流已成功导出为 ${a.download}` });
            // --- MODIFICATION END ---
        } catch (error) {
            await modal.alert({ title: '导出失败', message: `导出失败！${error.message}` });
        }
    }

    return {
        isRunning,
        executionStatus,
        runWorkflow,
        exportWorkflow,
    };
}