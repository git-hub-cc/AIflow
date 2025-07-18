// js/services/api.js

// NEW: 只导入 retrieveContext 函数
import { retrieveContext } from './ragService.js';
// REMOVED: import localforage from '...'; // localforage 在 index.html 中作为全局变量加载

// --- 配置常量 ---
// 你的后端服务的基地址
// 如果前端和后端在同一个域，可以相对路径；否则需要完整 URL
const BACKEND_API_BASE_URL = 'http://localhost:3000/api'; // 保留，如果 executeTool 仍需后端

// LLM 接口的直接调用地址（根据你的提供，前端直接调用）
const LLM_API_URL = 'https://ppmc.club/webchat/v1/chat/completions';
const LLM_API_KEY = 'sk-xxxx'; // !!! 警告：请勿在生产环境中将API Key硬编码在前端 !!!

// NEW: 初始化 localforage 实例用于工作流存储
let workflowStore = null;

/**
 * 初始化工作流存储
 */
export async function initWorkflowStore() {
    if (!workflowStore) {
        // 确保 localforage 全局变量可用
        if (typeof localforage === 'undefined') {
            console.error("localforage 未定义。请确保在 main.js 导入此模块之前，在 index.html 中正确加载了 localforage 库。");
            throw new Error("localforage 库未找到。");
        }
        workflowStore = localforage.createInstance({
            name: "ai_workflow_builder_store", // IndexedDB 数据库名称
            storeName: "workflows"             // 对象仓库名称
        });
        console.log("[API Service] Workflow IndexedDB store initialized.");
    }
}

/**
 * 辅助函数：处理 Fetch API 响应
 * @param {Response} response - Fetch API 的 Response 对象
 * @returns {Promise<any>} JSON 响应数据
 */
async function handleResponse(response) {
    if (!response.ok) {
        let errorData;
        try {
            errorData = await response.json();
        } catch (e) {
            errorData = { message: response.statusText || '未知错误' };
        }
        throw new Error(errorData.message || 'API 请求失败');
    }
    return response.json();
}


/**
 * 模拟的 API 服务 (工作流部分已迁移至 IndexedDB)
 */
export const apiService = {
    /**
     * 调用 LLM (Large Language Model)
     * 使用 Server-Sent Events (SSE) 流式接收响应
     */
    async callLLM(userPrompt, model = 'THUDM/GLM-4-32B-0414', previousMessages = []) {
        console.log(`[API Service] Calling LLM with model: ${model}`);
        console.log(`[API Service] User Prompt: "${userPrompt}"`);
        console.log(`[API Service] Previous Messages:`, previousMessages);

        // 构造完整的消息数组
        const messages = [...previousMessages, { role: 'user', content: userPrompt }];

        try {
            const response = await fetch(LLM_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${LLM_API_KEY}` // !!! 警告：生产环境不应如此处理API Key
                },
                body: JSON.stringify({
                    model: model, // 这里使用你提供的固定模型
                    messages: messages,
                    stream: true, // 启用 SSE
                    temperature: 0.1,
                    max_tokens: 2048,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`LLM API request failed: ${response.status} ${response.statusText} - ${errorText}`);
            }

            if (!response.body) {
                throw new Error('LLM API response body is empty.');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let fullText = '';
            let done, value;

            console.log("[API Service] Receiving LLM stream...");

            while (true) {
                ({ value, done } = await reader.read());
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                // SSE 格式通常是 "data: {json}\n\n"
                // 并可能包含 [DONE] 标记
                chunk.split('\n').forEach(line => {
                    line = line.trim();
                    if (line.startsWith('data:')) {
                        const jsonStr = line.substring(5).trim();
                        if (jsonStr === '[DONE]') {
                            return; // 结束处理
                        }
                        try {
                            const data = JSON.parse(jsonStr);
                            if (data.choices && data.choices[0] && data.choices[0].delta && data.choices[0].delta.content) {
                                fullText += data.choices[0].delta.content;
                            }
                        } catch (e) {
                            console.error("[API Service] Error parsing SSE JSON chunk:", e, "Chunk:", jsonStr);
                        }
                    }
                });
            }
            console.log(`[API Service] Full LLM Response: "${fullText}"`);
            // 根据 agent card 的逻辑，我们只返回 text，agent card 会自己解析其中的工具调用指令
            return { text: fullText };

        } catch (error) {
            console.error('[API Service] Error calling LLM:', error);
            throw new Error(`LLM 调用失败: ${error.message}`);
        }
    },

    /**
     * 调用 RAG (Retrieval Augmented Generation) 内容检索接口 (NEW: 现在调用本地 RAG 服务)
     * @param {string} query - 查找内容的查询，例如一个用户问题
     * @param {number} topK - 返回最相关的 K 个文本块
     * @returns {Promise<{content: string}>} RAG内容的响应
     */
    async getRAGContent(query, topK = 5) {
        console.log(`[API Service] Requesting RAG content for query: "${query}", topK: ${topK} (Local RAG)`);
        try {
            // 直接调用本地 RAG 服务进行检索，使用导入的 retrieveContext
            const retrievedChunks = await retrieveContext(query, topK); // 检索 top K 块
            const combinedContent = retrievedChunks.map(chunk => chunk.text).join('\n\n');
            return { content: combinedContent };
        } catch (error) {
            console.error('[API Service] Error getting RAG content (local):', error);
            throw new Error(`获取 RAG 内容失败 (本地RAG): ${error.message}`);
        }
    },

    /**
     * 调用后端工具执行器 (这里是模拟的)
     * @param {string} toolName - 要调用的工具名称
     * @param {object} args - 工具的参数
     * @returns {Promise<{result: any}>} 工具执行结果
     */
    async executeTool(toolName, args) {
        console.log(`[API Service] Requesting backend to execute tool: "${toolName}" with args:`, args);
        // 这里只是一个模拟实现，实际应用中会通过 fetch 调用后端API
        console.warn("[API Service] executeTool 是模拟的。实际工具执行需要后端集成。");
        await new Promise(resolve => setTimeout(resolve, 500)); // 模拟网络延迟
        if (toolName === 'web_search') {
            return { result: `模拟搜索结果：找到关于 "${args.query}" 的信息，包括AI发展历程和当前趋势。` };
        } else if (toolName === 'calculator') {
            try {
                const expr = args.expression;
                // 注意: eval() 存在安全风险，实际应用中应使用安全的数学表达式解析器
                const res = eval(expr);
                return { result: `模拟计算结果：${expr} = ${res}` };
            } catch (e) {
                return { result: `模拟计算失败：无法计算表达式 "${args.expression}"。` };
            }
        }
        return { result: `模拟工具 "${toolName}" 已执行，但未有具体实现结果。参数：${JSON.stringify(args)}` };
    },

    /**
     * 保存工作流的API (现在使用 IndexedDB)
     * @param {object} workflowData 工作流数据
     * @param {string} workflowName 工作流名称
     * @returns {Promise<object>} 保存结果
     */
    async saveWorkflow(workflowData, workflowName) {
        // 确保 workflowStore 已初始化
        if (!workflowStore) await initWorkflowStore();
        console.log("[API Service] Saving workflow to IndexedDB:", workflowName, workflowData);
        try {
            await workflowStore.setItem(workflowName, workflowData);
            return { success: true, message: `工作流 "${workflowName}" 已成功保存到本地。` };
        } catch (error) {
            console.error('[API Service] Error saving workflow to IndexedDB:', error);
            throw new Error(`保存工作流失败: ${error.message}`);
        }
    },

    /**
     * 加载工作流的API (现在使用 IndexedDB)
     * @param {string} workflowName 工作流名称
     * @returns {Promise<object|null>} 工作流数据或 null
     */
    async loadWorkflow(workflowName) {
        // 确保 workflowStore 已初始化
        if (!workflowStore) await initWorkflowStore();
        console.log("[API Service] Loading workflow from IndexedDB:", workflowName);
        try {
            const data = await workflowStore.getItem(workflowName);
            if (data) {
                return { success: true, data: data };
            } else {
                return { success: false, message: `工作流 "${workflowName}" 未找到。` };
            }
        } catch (error) {
            console.error('[API Service] Error loading workflow from IndexedDB:', error);
            throw new Error(`加载工作流失败: ${error.message}`);
        }
    },

    /**
     * 获取所有已保存工作流名称的API (现在使用 IndexedDB)
     * @returns {Promise<string[]>} 已保存工作流名称列表
     */
    async getSavedWorkflowNames() {
        // 确保 workflowStore 已初始化
        if (!workflowStore) await initWorkflowStore();
        console.log("[API Service] Getting saved workflow names from IndexedDB.");
        try {
            const names = await workflowStore.keys(); // localforage.keys() 返回所有键
            return names;
        } catch (error) {
            console.error('[API Service] Error getting saved workflow names from IndexedDB:', error);
            throw new Error(`获取已保存工作流列表失败: ${error.message}`);
        }
    },

    /**
     * 删除已保存工作流的API (现在使用 IndexedDB)
     * @param {string} workflowName 工作流名称
     * @returns {Promise<object>} 删除结果
     */
    async deleteWorkflow(workflowName) {
        // 确保 workflowStore 已初始化
        if (!workflowStore) await initWorkflowStore();
        console.log("[API Service] Deleting workflow from IndexedDB:", workflowName);
        try {
            await workflowStore.removeItem(workflowName);
            return { success: true, message: `工作流 "${workflowName}" 已从本地删除。` };
        } catch (error) {
            console.error('[API Service] Error deleting workflow from IndexedDB:', error);
            throw new Error(`删除工作流失败: ${error.message}`);
        }
    },

    /**
     * 运行工作流的API (实际执行逻辑仍在 main.js 中，此函数仅为后端预留)
     * 尽管实际执行在前端，我们仍然保留这个模拟API以保持接口一致性，
     * 如果未来需要将工作流执行逻辑转移到后端，可以直接修改这里。
     * @param {object} workflowGraph 工作流图数据
     * @returns {Promise<object>} 运行结果
     */
    async runWorkflow(workflowGraph) {
        console.log("[API Service] Mock running workflow request sent (actual execution in main.js):", workflowGraph);
        return { success: true, message: "模拟的工作流运行请求已处理！实际执行由前端模拟器给出。" };
    }
};