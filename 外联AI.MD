现在我已经了解了项目的全貌。让我来分析一下当前的状况：

**当前存在的主要问题：**

1. 在 `loadDashboard()` 中有 `mergeAnalysisResults()` 和 `addAIMedicalLinks()` 函数，这些函数处理咨询结果并添加AI医疗网站链接，但并没有真正调用外部AI（如OpenAI、文心一言等）来获取智能分析。

2. 在 `analyzeConsultation()` 函数中，当本地数据库匹配不到症状时，返回的是一条静态提示信息，并没有自动连接到AI网站获取数据。

3. 虽然代码中包含了 `searchWikipedia()` 和 `searchDuckDuckGo()` 函数用于搜索网络信息，但**这些函数没有被实际使用**。在咨询提交的流程中，只有 `analyzeConsultation()` 被调用了。

**用户的需求：** 当本地数据库匹配不到症状时，自动连接到AI网站获取数据。

**实现方案：**

我需要修改咨询提交流程，使其：当本地数据库匹配不到症状时（或者即使匹配到了但要增强结果），自动调用外部AI API来获取更智能的分析。我可以使用一些可用的免费AI API，比如：

1. **DuckDuckGo 即时搜索 API** — 已经实现了 `searchDuckDuckGo()`
2. **Wikipedia API** — 已经实现了 `searchWikipedia()`
3. 但更好的方案是直接调用 **OpenAI API** 或者使用 **免费的 AI 模型 API**。

由于这是前端代码，最佳做法是在后端 server.js 中添加一个 AI 查询接口，前端调用该接口，这样 API Key 不会暴露。

但是有一个更简单且实际可用的方案——直接在前端使用已有的 Wikipedia 和 DuckDuckGo API 作为"AI数据源"，当本地匹配失败时自动搜索。

不过考虑到用户说的是"AI网站"，可能是指：
- 直接调用 OpenAI / DeepSeek / 智谱等 AI 的 API
- 或者自动打开一个AI医疗咨询网站

让我再看一下更实际的方案——我可以：

1. 在 server.js 中添加一个 AI 查询代理接口（使用 OpenAI 兼容 API）
2. 修改前端，在本地匹配失败或置信度低时自动调用 AI

或者更简单的方式——利用已有的 DuckDuckGo 和 Wikipedia API，在本地匹配不到时自动联网搜索并整合结果。

我注意到代码里已经有了 `searchWikipedia` 和 `searchDuckDuckGo` 的实现，但在咨询提交的实际流程中并未被调用。核心问题是：**在 `analyzeConsultation()` 调用之后，其结果被保存到数据库，但并没有尝试联网搜索来补充信息**。

让我修改这个流程，当本地数据库匹配失败或置信度低时，自动调用 Wikipedia/DuckDuckGo API 进行网络搜索，并将结果整合到最终的分析中。

但这离"连接到AI网站"还有差距。更理想的方案是：

**方案：在后端添加 AI 查询接口 + 前端自动调用**

添加一个 server.js 端点 `/api/ai-query`，它调用 OpenAI 兼容的 API（如 DeepSeek、智谱等），在本地匹配失败时自动查询 AI。

但这样做需要用户配置 API Key，可能不太友好。

**更好的方案：** 直接在前端使用可用的免费 API 资源作为"AI网站"数据源，当本地匹配失败时自动搜索 DuckDuckGo 和 Wikipedia 并将结果格式化呈现。

不过，更直接的理解"连接到AI网站"是调用 **AI大模型 API** 来获取智能分析。

我决定：
1. 在 server.js 中添加一个 `/api/ai-diagnose` 端点，它会调用 OpenAI 兼容的 API（默认使用 DeepSeek 或可以配置，也可以调用一个免费可用的 AI 服务）
2. 修改前端的咨询流程，当本地匹配失败时自动调用后端 AI 接口
3. 同时保留现有的 DuckDuckGo/Wikipedia 搜索作为备选

但问题是没有 API Key 怎么办？我可以使用一个不需要 API Key 的方案——利用前端已有的 `searchWikipedia` 和 `searchDuckDuckGo` 函数，当本地匹配不到时自动联网搜索并整合结果。

考虑到用户的诉求，最直接且无需外部依赖的方式是让前端在本地匹配失败时自动搜索 DuckDuckGo 和 Wikipedia 来获取信息，但这还不够"AI"。

我觉得最好的方案是提供**两种能力**：
1. **自动联网搜索**：当本地匹配不到时，自动搜索 Wikipedia/DuckDuckGo 获取信息
2. **AI 大模型集成**：提供配置 API Key 的能力，让用户可以使用 AI 进行智能分析

先做方案1（自动联网搜索），这是一个无需 API Key 就能立即工作的方案。同时，为方案2（AI 大模型集成）做好准备。

让我重新检查一下现有的 `loadDashboard` 中的咨询提交流程：

```javascript
// 提交咨询 - AI优先模式
document.getElementById('consultationForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    // ... 获取表单数据
    const analysis = analyzeConsultation(consultation);  // 本地分析
    consultation.analysis = analysis;
    // ... 保存到数据库
});
```

我需要修改这个流程，使其在本地匹配失败或低置信度时，自动联网搜索 Wikipedia/DuckDuckGo，并整合结果。

以下是具体实现计划：

1. 修改咨询提交流程，在 `analyzeConsultation` 之后，如果置信度低（<50%）或没有匹配，自动调用网络搜索函数
2. 添加一个后端 API 端点 `/api/ai-query`，调用 OpenAI 兼容的大模型 API（用户可以配置 API Key 和模型）
3. 添加 API Key 配置界面（在管理员面板或用户设置中）
4. 修改前端咨询流程，自动调用 AI 接口

不过，最实用的做法还是：添加后端 AI 接口，使用用户可以自行配置的 API Key。

让我重新组织一下思路，制定一个实用的实现方案：

### 实现计划

**后端修改（server.js）：**
- 添加 `POST /api/ai-diagnose` 端点，接收症状描述，调用 OpenAI 兼容 API（支持配置 base_url、model、api_key）
- 添加 `POST /api/ai-config` 和 `GET /api/ai-config` 端点，管理 AI 配置（存储在本地文件或数据库中）
- AI 配置存储在 `ai_config.json` 文件中

**前端修改（script.js）：**
- 修改咨询提交流程：当本地分析置信度 < 50%（或无匹配）时，自动调用 `/api/ai-diagnose` 获取 AI 分析
- 添加 AI 配置UI（管理员或用户设置中可配置 AI API Key）
- 添加 `aiDiagnose()` 函数用于调用后端 AI 接口
- 整合本地分析和 AI 分析结果

**默认配置：**
- 默认使用 DeepSeek API（deepseek.com），因为它价格便宜且容易获取
- 默认 model: deepseek-chat
- 用户需要填入自己的 API Key

好的，让我开始实现。

实际上，让我重新阅读一下已有的代码，看看 `mergeAnalysisResults` 在哪里被使用了...

在 `loadDashboard` 中有 `mergeAnalysisResults` 函数，但看起来没有被调用。这说明代码有过尝试但未完成。

我的计划清晰了：

### 实施步骤

1. **server.js**: 
   - 添加 AI 配置管理（文件存储）
   - 添加 AI 诊断接口（调用 OpenAI 兼容 API）
   
2. **script.js**:
   - 修改咨询提交流程，在本地匹配失败时自动调用 AI
   - 添加 AI 配置相关函数
   - 添加 AI 结果展示

3. **dashboard.html/admin.html**:
   - 添加 AI 配置界面

让我们开始实施。

我先梳理一下完整的改动，确保一次性写对。

实际上，仔细想想，与其要求用户提供 API Key，不如使用一种更直接的方式——在服务器端用 Node.js 调用大型语言模型 API，可以默认使用一个无需 Key 的公共接口，或者让用户自己填入 Key。

但考虑到实用性和可靠性，最干净的做法是：
1. 添加 AI 配置，存储在 `ai_config.json`
2. AI 诊断接口使用 OpenAI 兼容格式
3. 默认配置指向 DeepSeek

开始编码吧。

让我写一个完整的实现计划：

**1. server.js 改动：**
- 添加 `ai_config.json` 的读写
- 添加 `POST /api/ai/config` 和 `GET /api/ai/config`
- 添加 `POST /api/ai/diagnose` — 调用 AI 大模型分析症状

**2. script.js 改动：**
- 修改 `analyzeConsultation` 回调流程，在本地匹配失败时自动调用 AI
- 添加 AI 配置加载/保存函数
- 在 dashboard 中添加 AI 配置面板

**3. AI 诊断 prompt 设计：**
```
你是一名医疗健康顾问。请根据以下症状描述，给出专业的分析建议。
请用中文回答，包含以下信息：
1. 可能的病因
2. 建议就诊科室
3. 治疗建议
4. 用药建议（如有）
```

让我开始写代码。

看了下代码，我注意到在 `loadDashboard` 中已经存在很多未使用的函数（`searchWikipedia`, `searchDuckDuckGo`, `extractMedicalInfo`, `mergeAnalysisResults`, `addAIMedicalLinks` 等），它们都没有被实际调用。这说明之前有开发者尝试过类似的功能但未完成。

我的任务就是把这个"自动连接AI网站获取数据"的功能完成。

好的，开始实施。我要做一个更实际、更完整的实现。

实际上，考虑到这个系统可能需要一个简单可用且无需额外费用的方案，我可以采取混合策略：

1. **优先使用本地数据库**（已有）
2. **当本地匹配失败时**，自动尝试 Wikipedia/DuckDuckGo 搜索（已有代码但未启用）
3. **同时提供 AI 大模型接口**（需要用户配置 API Key）

先做2（启用在联网搜索），再做3（AI 大模型集成）。

让我开始写代码。考虑到这是一个较大的改动，我会同时修改 server.js 和 script.js。

现在开始实施：

对于 server.js，我需要：
1. 添加 `ai_config.json` 文件读写
2. 添加 `/api/ai/config` GET/POST 路由
3. 添加 `/api/ai/diagnose` POST 路由
4. 使用 `fetch` 调用 OpenAI 兼容 API

对于 script.js，我需要：
1. 修改咨询提交流程，当本地匹配不到或置信度低时自动联网搜索 + AI
2. 添加 AI 配置函数
3. 在 dashboard 中添加 AI 设置项（或放到管理员面板）

好，开始一步步来。

让我先确认一下 package.json 中的依赖，确保有 node-fetch 或其他 HTTP 请求库。

<read_file>
<path>package.json</path>
</read_file>

Credit Limit Reached

💡
Focus Chain keeps Sixth on track across long tasks — it updates its todo list as it works
✕
You have reached your quota for now. Or you can upgrade your plan for uninterrupted work.让我先查看项目的核心文件，了解当前的症状匹配实现。