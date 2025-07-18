// js/services/ragService.js

// 引入 transformers.js 的 pipeline 函数
// 确保在 index.html 中通过 <script type="module" src="https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2"></script> 引入
import { pipeline, cos_sim } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';
// 引入 localforage
// 确保在 index.html 中通过 <script src="https://cdn.jsdelivr.net/npm/localforage@1.10.0/dist/localforage.min.js"></script> 引入
// PDF.js 已经通过 GlobalWorkerOptions 配置，无需在此直接引入

let extractor = null; // 用于存储嵌入模型 pipeline
let ragStore = null;  // 用于存储 localforage 实例

// 文本分块器配置
const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 100;

/**
 * 初始化 RAG 服务：加载嵌入模型和 IndexedDB 存储
 */
export async function initRAG() {
    try {
        console.log("[RAG Service] Initializing...");
        // 1. 加载嵌入模型
        // 使用 'Xenova/all-MiniLM-L6-v2' 是一个常用的、轻量级的嵌入模型
        // 第一次加载可能需要下载模型文件，会比较慢
        if (!extractor) {
            console.log("[RAG Service] Loading embedding model 'Xenova/bge-small-zh-v1.5'...");
            // MODIFIED: Changed model from 'Xenova/all-MiniLM-L6-v2' to 'Xenova/bge-small-zh-v1.5'
            extractor = await pipeline('feature-extraction', 'Xenova/bge-small-zh-v1.5');
            console.log("[RAG Service] Embedding model loaded successfully.");
        }

        // 2. 初始化 IndexedDB 存储
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
        throw new Error("RAG 服务初始化失败。请检查网络或浏览器兼容性。");
    }
}

/**
 * 将文本分块
 * @param {string} text - 原始文本
 * @returns {string[]} 文本块数组
 */
function chunkText(text) {
    const chunks = [];
    // 简单的分块策略：按字符数，并有重叠
    // 实际应用中可能需要更复杂的语义分块 (按段落、句子等)
    let i = 0;
    while (i < text.length) {
        let end = Math.min(i + CHUNK_SIZE, text.length);
        // 尝试在重叠区域之后找到一个自然的分隔符（如句号、换行符）
        let actualEnd = end;
        if (end < text.length) {
            let tempSlice = text.substring(i, end + CHUNK_OVERLAP);
            let lastSeparatorIndex = Math.max(
                tempSlice.lastIndexOf('.'),
                tempSlice.lastIndexOf('?'),
                tempSlice.lastIndexOf('!'),
                tempSlice.lastIndexOf('\n')
            );
            if (lastSeparatorIndex > -1 && lastSeparatorIndex >= (end - i)) {
                actualEnd = i + lastSeparatorIndex + 1;
            }
        }
        chunks.push(text.substring(i, actualEnd));
        i = actualEnd - CHUNK_OVERLAP; // 带有重叠
        if (i < 0) i = 0; // 避免负数索引
        if (actualEnd === text.length) break; // 已到文本末尾
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
 * @returns {Promise<string>} 处理结果消息
 */
export async function processDocument(file, onProgress) {
    if (!extractor || !ragStore) {
        throw new Error("RAG 服务未初始化。");
    }

    onProgress(`正在处理文件 "${file.name}"...`);
    console.log(`[RAG Service] Processing document: ${file.name}`);

    let textContent = '';
    const fileId = `${file.name}_${file.lastModified}`; // 简单的文件ID，用于区分不同上传版本

    // 1. 提取文本
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
        console.error("[RAG Service] Text extraction failed:", e);
        throw new Error(`文本提取失败: ${e.message}`);
    }

    // 2. 文本分块
    const chunks = chunkText(textContent);
    onProgress(`"${file.name}": 文本分块完成 (${chunks.length} 块)。`);
    console.log(`[RAG Service] Chunks created: ${chunks.length}`);

    // 3. 生成嵌入并存储
    const documentData = {
        fileId: fileId,
        fileName: file.name,
        timestamp: Date.now(),
        chunks: []
    };

    let processedCount = 0;
    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        try {
            // 生成嵌入向量
            const output = await extractor(chunk, { pooling: 'mean', normalize: true });
            const embedding = Array.from(output.data); // 将 Float32Array 转换为普通数组

            documentData.chunks.push({
                chunkId: `${fileId}_chunk_${i}`,
                text: chunk,
                embedding: embedding
            });
            processedCount++;
            if (onProgress) {
                onProgress(`"${file.name}": 正在嵌入 ${processedCount}/${chunks.length} 块...`);
            }
        } catch (e) {
            console.error(`[RAG Service] Embedding chunk ${i} failed:`, e);
            onProgress(`"${file.name}": 嵌入块 ${i} 失败: ${e.message}`);
            // 可以选择跳过此块或抛出错误
        }
    }

    // 将整个文档的数据存储到 IndexedDB
    try {
        await ragStore.setItem(fileId, documentData);
        onProgress(`"${file.name}": 所有块嵌入并存储完成！`);
        console.log(`[RAG Service] Document "${file.name}" (ID: ${fileId}) processed and stored.`);
        return `文件 "${file.name}" 处理完成，共 ${documentData.chunks.length} 个块。`;
    } catch (e) {
        console.error("[RAG Service] Storing document failed:", e);
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
    if (!extractor || !ragStore) {
        throw new Error("RAG 服务未初始化。");
    }

    console.log(`[RAG Service] Retrieving context for query: "${query}"`);

    // 1. 生成查询嵌入
    const queryEmbeddingOutput = await extractor(query, { pooling: 'mean', normalize: true });
    const queryEmbedding = Array.from(queryEmbeddingOutput.data);

    const allChunks = [];
    // 2. 遍历所有存储的文档，收集所有文本块
    await ragStore.iterate((value, key, iterationNumber) => {
        if (value && value.chunks) {
            value.chunks.forEach(chunk => {
                allChunks.push({
                    fileId: value.fileId, // 记录来自哪个文件
                    chunkId: chunk.chunkId,
                    text: chunk.text,
                    embedding: chunk.embedding
                });
            });
        }
    });

    if (allChunks.length === 0) {
        console.warn("[RAG Service] No documents found in store for retrieval.");
        return [];
    }

    // 3. 计算余弦相似度并排序
    const scoredChunks = allChunks.map(chunk => {
        const score = cos_sim(queryEmbedding, chunk.embedding);
        return {
            text: chunk.text,
            score: score,
            fileId: chunk.fileId,
            chunkId: chunk.chunkId
        };
    });

    // 降序排序并取 Top K
    scoredChunks.sort((a, b) => b.score - a.score);
    const topChunks = scoredChunks.slice(0, topK);

    console.log("[RAG Service] Retrieved top chunks:", topChunks);
    return topChunks;
}

/**
 * 列出所有已处理的文档
 * @returns {Promise<Array<{fileId: string, fileName: string, timestamp: number, chunkCount: number}>>} 文档列表
 */
export async function listDocuments() {
    if (!ragStore) {
        throw new Error("RAG 服务未初始化。");
    }
    const docs = [];
    await ragStore.iterate((value, key) => {
        if (value && value.fileName) { // 确保是完整文档数据
            docs.push({
                fileId: value.fileId,
                fileName: value.fileName,
                timestamp: value.timestamp,
                chunkCount: value.chunks ? value.chunks.length : 0
            });
        }
    });
    // 按时间降序排序
    docs.sort((a, b) => b.timestamp - a.timestamp);
    console.log("[RAG Service] Listed documents:", docs);
    return docs;
}

/**
 * 删除指定文档及其所有块
 * @param {string} fileId - 要删除的文档ID
 * @returns {Promise<void>}
 */
export async function deleteDocument(fileId) {
    if (!ragStore) {
        throw new Error("RAG 服务未初始化。");
    }
    await ragStore.removeItem(fileId);
    console.log(`[RAG Service] Document ${fileId} deleted.`);
}