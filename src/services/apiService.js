// src/services/apiService.js

import { retrieveContext } from './ragService.js';

// --- 配置常量 ---
const LLM_API_URL = 'https://ppmc.club/webchat/v1/chat/completions';
const LLM_API_KEY = 'sk-xxxx'; // !!! 警告：请勿在生产环境中将API Key硬编码在前端 !!!

export const apiService = {
    /**
     * 占位符初始化函数
     */
    init() {
        // 此函数以前用于初始化 IndexedDB 工作流存储。
        // 现在该功能已移除，此函数保留为空以避免破坏 workflowStore.js 中的调用。
        console.log("[API Service] Service initialized.");
    },

    /**
     * 调用 LLM (Large Language Model)
     * 使用 Server-Sent Events (SSE) 流式接收响应
     */
    async callLLM(userPrompt, model = 'THUDM/GLM-4-32B-0414', previousMessages = []) {
        console.log(`[API Service] Calling LLM with model: ${model}`);
        console.log(`[API Service] User Prompt: "${userPrompt}"`);

        const messages = [...previousMessages, { role: 'user', content: userPrompt }];

        try {
            const response = await fetch(LLM_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${LLM_API_KEY}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: messages,
                    stream: true,
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

            while (true) {
                ({ value, done } = await reader.read());
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                chunk.split('\n').forEach(line => {
                    line = line.trim();
                    if (line.startsWith('data:')) {
                        const jsonStr = line.substring(5).trim();
                        if (jsonStr === '[DONE]') return;
                        try {
                            const data = JSON.parse(jsonStr);
                            if (data.choices?.[0]?.delta?.content) {
                                fullText += data.choices[0].delta.content;
                            }
                        } catch (e) {
                            console.error("[API Service] Error parsing SSE JSON chunk:", e, "Chunk:", jsonStr);
                        }
                    }
                });
            }
            console.log(`[API Service] Full LLM Response: "${fullText}"`);
            return { text: fullText };

        } catch (error) {
            console.error('[API Service] Error calling LLM:', error);
            throw new Error(`LLM 调用失败: ${error.message}`);
        }
    },

    /**
     * 调用 RAG 内容检索接口
     */
    async getRAGContent(query, topK = 5) {
        console.log(`[API Service] Requesting RAG content for query: "${query}", topK: ${topK}`);
        try {
            const retrievedChunks = await retrieveContext(query, topK);
            const combinedContent = retrievedChunks.map(chunk => chunk.text).join('\n\n');
            return { content: combinedContent };
        } catch (error) {
            console.error('[API Service] Error getting RAG content (local):', error);
            throw new Error(`获取 RAG 内容失败: ${error.message}`);
        }
    },

    /**
     * 调用后端工具执行器 (模拟)
     */
    async executeTool(toolName, args) {
        console.log(`[API Service] Executing tool: "${toolName}" with args:`, args);
        console.warn("[API Service] executeTool is a mock. Real tool execution needs a backend.");
        await new Promise(resolve => setTimeout(resolve, 500));
        if (toolName === 'web_search') {
            return { result: `模拟搜索结果：找到关于 "${args.query}" 的信息。` };
        } else if (toolName === 'calculator') {
            try {
                const res = new Function(`return ${args.expression}`)();
                return { result: `模拟计算结果：${args.expression} = ${res}` };
            } catch (e) {
                return { result: `模拟计算失败：无法计算 "${args.expression}"。` };
            }
        }
        return { result: `模拟工具 "${toolName}" 已执行。` };
    },
};