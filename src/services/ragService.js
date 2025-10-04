// src/services/ragService.js

import { pipeline, cos_sim } from '@xenova/transformers';
import localforage from 'localforage';
import * as pdfjsLib from 'pdfjs-dist/build/pdf.min.mjs';

// Setup PDF.js worker
// 确保您已将 `pdf.worker.min.mjs` 文件从 `node_modules/pdfjs-dist/build/` 复制到您的 `public` 目录下
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    '/pdf.worker.min.mjs', // Vite 会在 public 目录中找到这个文件
    import.meta.url
).toString();


let extractor = null;
let ragStore = null;

const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 100;

/**
 * 初始化 RAG 服务：加载嵌入模型和 IndexedDB 存储
 */
export async function initRAG() {
    try {
        console.log("[RAG Service] Initializing...");
        if (!extractor) {
            console.log("[RAG Service] Loading embedding model 'bge-small-zh-v1.5' from local path...");

            // --- BUG FIX: 移除模型路径的前导斜杠 ---
            // 之前的错误导致请求路径中出现重复的 "models/"。
            // 移除前导斜杠后，路径将被正确地解析为相对于服务器根目录的路径。
            const modelPath = 'bge-small-zh-v1.5/';
            // ------------------------------------

            // 通过添加 { quantized: true } 选项，我们告诉 transformers.js
            // 加载 'model_quantized.onnx' 文件，而不是让它自己猜测。
            extractor = await pipeline('feature-extraction', modelPath, { quantized: true });

            console.log("[RAG Service] Embedding model loaded successfully from local path.");
        }

        if (!ragStore) {
            ragStore = localforage.createInstance({
                name: "rag_document_store",
                storeName: "document_chunks"
            });
            console.log("[RAG Service] IndexedDB store initialized.");
        }
        console.log("[RAG Service] Initialization complete.");
    } catch (error) {
        console.error("[RAG Service] Initialization failed:", error);
        throw new Error("RAG 服务初始化失败。请确保模型文件已正确放置在 public/models/ 目录下，并检查网络或浏览器兼容性。");
    }
}

/**
 * 将文本分块
 * @param {string} text - 原始文本
 * @returns {string[]} 文本块数组
 */
function chunkText(text) {
    const chunks = [];
    let i = 0;
    while (i < text.length) {
        let end = Math.min(i + CHUNK_SIZE, text.length);
        let actualEnd = end;
        if (end < text.length) {
            let tempSlice = text.substring(i, end + CHUNK_OVERLAP);
            let lastSeparatorIndex = Math.max(
                tempSlice.lastIndexOf('.'), tempSlice.lastIndexOf('?'),
                tempSlice.lastIndexOf('!'), tempSlice.lastIndexOf('\n')
            );
            if (lastSeparatorIndex > -1 && lastSeparatorIndex >= (end - i)) {
                actualEnd = i + lastSeparatorIndex + 1;
            }
        }
        chunks.push(text.substring(i, actualEnd));
        i = actualEnd - CHUNK_OVERLAP;
        if (i < 0) i = 0;
        if (actualEnd === text.length) break;
    }
    return chunks;
}

/**
 * 从 PDF 中提取文本
 * @param {File} file - PDF 文件对象
 * @returns {Promise<string>} 提取的文本内容
 */
async function extractTextFromPdf(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        fullText += textContent.items.map(item => item.str).join(' ') + '\n\n';
    }
    return fullText;
}

/**
 * 处理上传的文档：提取文本、分块、生成嵌入并存储
 * @param {File} file - 文件对象
 * @param {function} onProgress - 进度回调函数 (progress)
 */
export async function processDocument(file, onProgress) {
    if (!extractor || !ragStore) throw new Error("RAG 服务未初始化。");

    onProgress(`正在处理文件 "${file.name}"...`);
    let textContent = '';
    const fileId = `${file.name}_${file.lastModified}`;

    try {
        if (file.type === 'application/pdf') {
            textContent = await extractTextFromPdf(file);
        } else if (file.type === 'text/plain') {
            textContent = await file.text();
        } else {
            throw new Error(`不支持的文件类型: ${file.type}`);
        }
        onProgress(`"${file.name}": 文本提取完成。`);
    } catch (e) {
        throw new Error(`文本提取失败: ${e.message}`);
    }

    const chunks = chunkText(textContent);
    onProgress(`"${file.name}": 文本分块完成 (${chunks.length} 块)。`);

    const documentData = {
        fileId: fileId,
        fileName: file.name,
        timestamp: Date.now(),
        chunks: []
    };

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        try {
            const output = await extractor(chunk, { pooling: 'mean', normalize: true });
            const embedding = Array.from(output.data);
            documentData.chunks.push({
                chunkId: `${fileId}_chunk_${i}`, text: chunk, embedding
            });
            onProgress(`"${file.name}": 正在嵌入 ${i + 1}/${chunks.length} 块...`);
        } catch (e) {
            console.error(`[RAG Service] Embedding chunk ${i} failed:`, e);
        }
    }

    try {
        await ragStore.setItem(fileId, documentData);
        onProgress(`"${file.name}": 存储完成！`);
    } catch (e) {
        throw new Error(`存储文档失败: ${e.message}`);
    }
}

/**
 * 从本地存储中检索相关上下文
 * @param {string} query - 用户查询
 * @param {number} topK - 返回最相关的 K 个文本块
 * @returns {Promise<{text: string, score: number}[]>} 相关的文本块数组，包含分数
 */
export async function retrieveContext(query, topK = 3) {
    if (!extractor || !ragStore) throw new Error("RAG 服务未初始化。");

    const queryEmbeddingOutput = await extractor(query, { pooling: 'mean', normalize: true });
    const queryEmbedding = Array.from(queryEmbeddingOutput.data);

    const allChunks = [];
    await ragStore.iterate((value) => {
        if (value?.chunks) {
            value.chunks.forEach(chunk => allChunks.push({ ...chunk, fileId: value.fileId }));
        }
    });

    if (allChunks.length === 0) return [];

    const scoredChunks = allChunks.map(chunk => ({
        ...chunk,
        score: cos_sim(queryEmbedding, chunk.embedding)
    }));

    scoredChunks.sort((a, b) => b.score - a.score);
    return scoredChunks.slice(0, topK);
}

/**
 * 列出所有已处理的文档
 * @returns {Promise<Array<{fileId: string, fileName: string, timestamp: number, chunkCount: number}>>} 文档列表
 */
export async function listDocuments() {
    if (!ragStore) throw new Error("RAG 服务未初始化。");
    const docs = [];
    await ragStore.iterate((value, key) => {
        if (value?.fileName) {
            docs.push({
                fileId: value.fileId,
                fileName: value.fileName,
                timestamp: value.timestamp,
                chunkCount: value.chunks?.length || 0
            });
        }
    });
    docs.sort((a, b) => b.timestamp - a.timestamp);
    return docs;
}

/**
 * 删除指定文档及其所有块
 * @param {string} fileId - 要删除的文档ID
 */
export async function deleteDocument(fileId) {
    if (!ragStore) throw new Error("RAG 服务未初始化。");
    await ragStore.removeItem(fileId);
    console.log(`[RAG Service] Document ${fileId} deleted.`);
}