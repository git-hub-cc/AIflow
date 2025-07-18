1. 目标：开发一个网站，用户可以设置ai，然后进行编排任务，更好的使用ai，分多个阶段进行实现
2. 细致功能
   1. 参考LangChain
      1. Chain 链式调用
      2. RAG 内容增强，调用外部接口，获取信息
      3. Agents 调用外部接口，执行动作
      4. Format 拼接内容让ai按指定格式生成
   2. 参考Dify
      1. 在页面支持编排任务
      2. 卡片设计，支持拖拽
3. 技术栈
   1. 原生html，js，css
4. 风格
   1. 美观，现代，参考Dify

## ai调用
url: https://ppmc.club/webchat/v1/chat/completions
key: sk-xxxx
Body:
{
"model": "THUDM/GLM-4-32B-0414",
"messages": [
{
"role": "system",
"content": "请模仿原神游戏中派蒙的语气回复我。一般回复1句话，具有多变、丰富台词潜力（通过表情、姿态、情境暗示）。"
},
{
"role": "user",
"content": "hi [发送于: 2025/7/18 10:54:17]"
}
],
"stream": true,
"temperature": 0.1,
"max_tokens": 2048,
}
响应类似为：sse
{"id":"01981b743a288b782142ff7b101aec07","object":"chat.completion.chunk","created":1752807258,"model":"THUDM/GLM-4-32B-0414","choices":[{"index":0,"delta":{"content":"~","reasoning_content":null},"finish_reason":null}],"system_fingerprint":"","usage":{"prompt_tokens":107,"completion_tokens":23,"total_tokens":130}}
{"id":"01981b743a288b782142ff7b101aec07","object":"chat.completion.chunk","created":1752807258,"model":"THUDM/GLM-4-32B-0414","choices":[{"index":0,"delta":{"content":" 😄","reasoning_content":null},"finish_reason":null}],"system_fingerprint":"","usage":{"prompt_tokens":107,"completion_tokens":25,"total_tokens":132}}
...
{"id":"01981b743a288b782142ff7b101aec07","object":"chat.completion.chunk","created":1752807258,"model":"THUDM/GLM-4-32B-0414","choices":[{"index":0,"delta":{"content":"","reasoning_content":null},"finish_reason":"stop"}],"system_fingerprint":"","usage":{"prompt_tokens":107,"completion_tokens":25,"total_tokens":132}}
[DONE]
tools:
get_weather: {
name: "get_weather",
description: "查询指定城市的实时天气。",
// URL模板, {city} 是将被替换的参数占位符
url_template: "https://wttr.in/{city}?format=j1",
// 参数定义，用于AI理解和构建调用
parameters: {
type: "object",
properties: {
city: {
type: "string",
description: "需要查询天气的城市名称，例如：北京、上海、东京。"
},
},
required: ["city"], // 声明city是必需参数
}
},
duckduckgo_search: {
name: "duckduckgo_search",
description: "使用 DuckDuckGo 搜索引擎进行网络搜索，以获取信息。",
// URL模板, {query} 是将被替换的参数占位符。返回JSON格式结果。
url_template: "https://api.duckduckgo.com/?q={query}&format=json&pretty=1",
parameters: {
type: "object",
properties: {
query: {
type: "string",
description: "要搜索的关键词或问题。"
}
},
required: ["query"]
}
},
get_current_ip_info: {
name: "get_current_ip_info",
description: "获取当前设备的公网IP地址及相关的地理位置信息。",
// 此API无需参数
url_template: "http://ip-api.com/json/",
parameters: {
type: "object",
properties: {}, // 无需任何参数
required: []
}
},
get_github_user_info: {
name: "get_github_user_info",
description: "获取指定 GitHub 用户的公开个人资料信息。",
// URL模板, {username} 是将被替换的参数占位符
url_template: "https://api.github.com/users/{username}",
parameters: {
type: "object",
properties: {
username: {
type: "string",
description: "需要查询的 GitHub 用户名，例如：'torvalds'。"
}
},
required: ["username"]
}
}

