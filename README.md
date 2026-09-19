# SkinLens AI · AI 个性化化妆品成分分析（MVP）

> 看懂成分，更了解它是否适合你。

输入一款产品的完整成分表，SkinLens AI 会解析成分、匹配成分数据库、分析配方结构，再结合你的肤质、关注功效与关注/避开成分，生成一份结构化的个性化成分报告，并支持历史记录、产品对比与围绕当前产品的 AI 问答。

当前版本是可直接小范围试用的 MVP。未配置 AI Key 时也能 100% 跑通全部流程（本地演示模式）。

已经完成生产环境（production）部署适配：`npm run build` + `npm start` 通过，
所有 AI 调用都在服务端完成，Key 不会进入浏览器；部署步骤见 [DEPLOYMENT.md](./DEPLOYMENT.md)。

## 一、这份 MVP 实现了什么

### 核心链路

| 能力 | 说明 |
| --- | --- |
| 成分解析 | 本地 Ingredient Parser：拆分中英文成分表、统一大小写、别名归一、去重、保留原文、识别「可能含有」段落 |
| 成分数据库 | 110+ 条常见成分（INCI 名 / 中文名 / 别名 / 分类 / 作用 / 皮肤相关说明 / 致敏·刺激·致痘标记 / 来源） |
| AI 分析 | 服务端统一分析服务，输出结构化 JSON：summary、formulaOverview、personalizedAnalysis、matchedGoals、watchItems、skinCompatibility、ingredientExplanations、questionsStarter |
| 个性化 | 肤质、肤质特征、关注功效、关注成分、避开成分全部参与分析与文案生成，改画像后重新分析结果会变化 |
| 配方结构 | 保湿 / 润肤 / 功能性成分 / 舒缓 / 香精相关 / 防腐体系（另含防晒与着色、基底与质地辅助） |
| 风险提醒 | 明确区分「潜在过敏关注」「潜在刺激关注」「你自己设置的关注/避开成分」「与痘痘话题相关」 |
| 完整成分表 | 每条成分可展开查看标准名、中文名、分类、作用、与你的关系、是否需要特别了解 |
| 为什么？ | 每个关注项都可一键追问 AI，结合该成分与你的画像给出解释 |
| 产品对比 | 结构化差异：配方结构、关注功效相关成分、关注项、关键成分差异、与画像的相关性，另有 AI 对比总结（不做优劣排名） |
| AI 问答 | 自动携带当前产品、完整成分、用户画像与本次分析结论，支持连续追问，对话本地保存 |
| 分析历史 | 搜索、查看详情、收藏、删除 |
| 本地持久化 | localStorage 保存画像、记录与对话，刷新不丢失；数据访问层已封装，可替换为 Supabase / PostgreSQL |
| 一键演示数据 | 首页 / 「我的」可一键载入「示例画像 + 3 款示例产品」，直接体验报告、对比与问答，随时可清除 |
| PWA | Web App Manifest + Service Worker + 离线兜底页 + 可安装图标（192 / 512 / maskable / apple-touch） |
| 错误处理 | 成分为空、成分过少、内容过长、AI 不可用、AI 返回非法 JSON、成分未收录、未设置肤质、未设置关注功效、接口限流、页面级错误兜底与 404 |
| 未来接口 | parseIngredientImage（OCR）与 analyzeSkinImage（AI 测肤）已预留，页面标注「即将推出」 |

### 中文优先的展示策略

产品面向国内用户，因此界面与 AI 输出统一使用中文成分名（例如「烟酰胺」「透明质酸钠」「香精」）。
英文 INCI 名只在「完整成分表 → 展开某个成分」里以「INCI 名称」单独列出，方便对照包装核对，不会出现在结论性文案中。
成分库未收录的成分会保留包装原文，并标注「成分库暂未收录」。

### 明确未实现（按需求约定）

OCR 拍照识别、AI 拍照测肤、社区、电商购买链接、医疗诊断、复杂推荐系统。其中前两项已预留接口与接入位置（见第八节）。

## 二、技术栈

- Next.js 16（App Router + Turbopack）+ React 19 + TypeScript
- Tailwind CSS v4（自定义设计令牌，组件按 shadcn 风格手写，无额外 UI 依赖）
- 服务端 API Route（Route Handlers）：AI Key 只在服务端使用
- 持久化：浏览器 localStorage（数据访问层 DataRepository 已抽象）
- 零额外运行时依赖：AI 调用直接使用 fetch，PWA 图标由脚本生成，Service Worker 手写

## 三、目录结构

```
src/
├─ app/
│  ├─ page.tsx                    首页
│  ├─ analyze/page.tsx            分析产品（输入页）
│  ├─ report/[id]/page.tsx        分析结果（服务端壳 + ReportView 客户端渲染）
│  ├─ history/page.tsx            分析记录
│  ├─ compare/page.tsx            产品对比
│  ├─ profile/page.tsx            我的（个人画像 / 数据管理）
│  ├─ privacy/page.tsx            隐私与数据
│  ├─ offline/page.tsx            离线兜底页
│  ├─ error.tsx                   页面级错误兜底
│  ├─ not-found.tsx               404 页面
│  ├─ manifest.ts                 PWA Manifest
│  └─ api/
│     ├─ analyze/route.ts         POST 产品分析
│     ├─ chat/route.ts            POST 上下文问答
│     ├─ compare/route.ts         POST 产品对比
│     ├─ demo/route.ts            POST 一键生成演示数据（固定走本地规则引擎）
│     ├─ ai-status/route.ts       GET 当前 AI 模式
│     ├─ health/route.ts          GET 健康检查（部署自检 / 监控）
│     ├─ ocr/route.ts             POST 预留：拍照识别成分表（当前 501）
│     └─ skin-analysis/route.ts   POST 预留：AI 拍照测肤（当前 501）
├─ components/                    UI 组件（ReportView / ChatPanel / 底部导航 / 设计系统）
├─ hooks/useStore.ts              客户端状态订阅
└─ lib/
   ├─ domain/                     领域模型与中文文案表
   ├─ ingredients/                成分数据库 + 查找 + 解析器
   ├─ analysis/                   配方结构估算 + 本地规则分析引擎
   ├─ ai/                         配置 / Prompt / Provider / 校验 / 分析 / 问答 / 对比
   ├─ demo/data.ts                演示画像与示例产品数据
   ├─ api/rate-limit.ts           接口限流（防公网 Demo 被刷）
   ├─ storage/                    数据访问层（接口 + localStorage 实现）
   ├─ store/client-store.ts       轻量客户端 store
   ├─ ocr/index.ts                预留：成分表 OCR
   ├─ skin/index.ts               预留：AI 拍照测肤
   └─ api/validate.ts             接口入参校验
scripts/generate-icons.mjs        零依赖生成 PWA 图标与 favicon
tests/                            Node 原生测试（21 项）
public/sw.js                      Service Worker
```

## 四、本地运行

环境要求：Node.js ≥ 20.9（实测 24.x；Vercel 会按 package.json 的 engines 选择 22.x 或更高）、npm。

```bash
npm install
npm run dev
```

打开 http://localhost:3000 即可使用，不需要任何环境变量（默认进入本地演示模式）。

其他命令：

```bash
npm run typecheck   # TypeScript 类型检查
npm run lint        # ESLint
npm test            # 28 项单元测试（Node 原生 test runner，直接运行 TS 源码）
npm run build       # 生产构建（Turbopack）
npm start           # 启动生产服务
npm run verify      # 依次执行 lint → typecheck → test → build，提交 / 部署前跑一次
npm run icons       # 需要重新生成 PWA 图标时执行
```

### dev 与 production 的区别

| | `npm run dev` | `npm run build` + `npm start` |
| --- | --- | --- |
| 用途 | 本地开发，热更新、错误浮层 | 公网部署用的生产模式 |
| 编译 | 按需编译，含调试信息 | 预编译 + 代码压缩 + 预渲染 |
| Service Worker | 不注册（避免缓存影响热更新） | 注册，提供离线兜底 |
| 环境变量 | 读取 `.env.local` | 读取 `.env.local` / 平台环境变量 |
| 端口 | 3000 | 3000（云平台会自动注入 `PORT`） |

## 五、AI API 配置方法

复制 .env.example 为 .env.local，按需填写：

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| OPENAI_API_KEY | AI 服务 Key。留空即自动进入本地演示模式 | 空 |
| AI_MODEL | 模型名称，可换成任意 OpenAI 兼容模型 | gpt-4o-mini |
| OPENAI_BASE_URL | OpenAI 兼容网关地址（代理 / 自建服务） | https://api.openai.com/v1 |
| MOCK_AI | 设为 `true` / `1` 时强制使用本地演示模式，即使配置了 Key 也不调用外部 AI | 空（= 不强制）|
| SKINLENS_FORCE_MOCK | 同 MOCK_AI 的历史写法，两者任一为真即生效 | 0 |
| AI_RATE_LIMIT_PER_MINUTE | 每个来源 IP 每分钟允许的接口调用次数，防止公网 Demo 被刷 | 真实 AI 20 / 演示模式 90 |

```bash
# .env.local 示例
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxx
AI_MODEL=gpt-4o-mini
# 想用真实 AI，记得把 MOCK_AI 设为 false（或删掉这一行）
MOCK_AI=false
```

安全说明：

- Key 只在服务端读取（src/lib/ai/config.ts），浏览器端拿不到，前端也不会出现任何 Key 相关变量。
- 分析、问答、对比全部通过服务端 Route Handler 调用 AI。
- 所有 AI 接口都带进程内限流（src/lib/api/rate-limit.ts），同一 IP 超过阈值直接返回 429，避免公网 Key 被脚本刷。
- AI 返回内容会经过 src/lib/ai/normalize.ts 做结构校验，字段缺失或类型不符时自动用本地规则结果补齐。
- AI 调用失败、超时或返回非法 JSON 时，服务自动降级为本地分析并在报告中提示用户，不会中断流程。

## 六、本地演示模式（Mock AI Mode）

没有 API Key 也能演示完整产品：整个应用使用本地成分数据库 + 规则引擎生成结构完全一致的分析结果。

它并不是写死的假数据，而是真实的规则推理，因此：

- 同一款产品，修改画像后重新分析，结论会明显变化（满足验收流程 3）；
- 成分表不同，配方结构、关注项、功效匹配都会随之变化；
- 成分库命中、排序位置、致敏/刺激标记都真实参与计算。

界面上会用「AI 洞察」与「本地演示分析」两种标签明确区分当前模式，不会误导试用用户。

### 六条验收流程怎么走

1. 首次设置画像：进入「我的」→ 选择肤质、肤质特征、关注功效 → 在「关注的成分 / 希望避开的成分」中添加例如 Niacinamide、Fragrance（输入时带联想）。所有修改即时保存。
2. 分析产品：首页点「＋ 分析一款产品」→ 选择产品类型 → 点「填入示例成分表」或粘贴自己的成分表（输入框下方实时显示已识别成分数与数据库匹配数）→ 点「开始 AI 分析」→ 自动跳转完整报告。
3. 个性化：回到「我的」修改肤质或关注功效 → 重新分析同一份成分表 → 报告中的「AI 总结 / 与你的关注 / 与你的肤质」都会相应变化。
4. 历史：分析后自动保存 → 底部「记录」查看 → 支持搜索、收藏、删除、点击重新查看。
5. 对比：至少分析两款产品 → 底部「对比」→ 选择 A / B（默认取最近两次分析）→ 自动生成结构化差异与 AI 对比总结；也可在「记录」里点「选择对比」挑两款。
6. 问答：任意报告页底部「问问 AI」→ 使用推荐问题或自由提问，例如「烟酰胺在这里主要起什么作用？」「为什么你提醒我这个成分？」「这款产品里面有哪些保湿成分？」→ 支持连续追问，对话保存在本地。

### Demo 数据

项目没有账号体系，因此没有测试账号。有三种方式可以立刻看到完整效果：

1. **一键载入演示数据（推荐给第一次打开的人）**：在首页点「载入演示数据」，会自动生成「示例画像 + 3 款示例产品的完整分析」（精华 / 面霜 / 洁面），随后「记录」「对比」「问答」都直接有内容。数据完全由本地规则引擎生成，不消耗 AI 额度，只存在你自己的浏览器里，随时可在「我的 → 数据管理 → 清除全部数据」删掉。
2. 分析页点「填入示例成分表」，可在三份示例成分表之间循环切换，快速走一次分析流程。
3. 直接粘贴下面这段：

```
Water, Glycerin, Niacinamide, Butylene Glycol, Panthenol, Sodium Hyaluronate,
Centella Asiatica Extract, Tranexamic Acid, Tocopherol, Carbomer,
Phenoxyethanol, Ethylhexylglycerin, Disodium EDTA, Fragrance, Linalool, Limonene
```

示例画像：混合性肌肤 · 容易出油 · 毛孔困扰 · 关注美白 / 保湿 / 抗皱 · 关注成分「烟酰胺」· 避开成分「香精」。

## 七、数据、隐私与生产构建

### 数据存哪里

- 画像、分析记录与问答对话默认保存在当前浏览器的 localStorage（命名空间 skinlens:v1:*）。
- 换设备或清除浏览器数据不会同步；「我的 → 数据管理」支持导出 JSON 备份与一键清除。
- 数据访问层是 src/lib/storage/types.ts 中的 DataRepository 接口，src/lib/storage/index.ts 的 getRepository() 是唯一切换点。未来接 Supabase / PostgreSQL 时新增一个实现即可，页面代码无需改动。

### 会发送什么给 AI

点击「开始 AI 分析」时，服务端会把产品名称、产品类型、完整成分表与你的画像（肤质、肤质特征、关注功效、关注/避开成分）发送给所配置的 AI 服务用于生成分析。
本地演示模式下不会向外发送任何数据。当前版本不采集、不上传任何人脸照片（详见应用内「隐私与数据」页）。

### 生产构建与部署

```bash
npm run build
npm start        # 本地生产验证，默认 3000 端口
```

部署自检：

| 检查 | 命令 / 地址 | 期望结果 |
| --- | --- | --- |
| 服务是否存活 | `GET /api/health` | `{"ok":true,"mode":"mock"或"llm"}` |
| 当前 AI 模式 | `GET /api/ai-status` | `mode` = `mock` / `llm` |
| 首页与各页面 | `/`、`/analyze`、`/history`、`/compare`、`/profile` | 200，无报错 |
| 匿名页面路由 | `/no-such-page` | 404 + 站内 404 页面 |
| PWA | `/manifest.webmanifest`、`/sw.js` | 200 |

公网部署（推荐 Vercel）的完整步骤、环境变量配置、日志查看与重新部署方式见 [DEPLOYMENT.md](./DEPLOYMENT.md)。
Service Worker 只在生产环境注册（src/components/PwaRegister.tsx），避免开发时缓存干扰热更新；
发布新版本时把 `public/sw.js` 里的 `CACHE_NAME` 版本号加一，旧缓存会在下次访问时自动清理。

## 八、下一阶段：OCR 与 AI 测肤接入位置

两个能力都按「图片 → 处理 → 复用现有链路」设计，接入时无需改动分析、对比、问答逻辑。

### 1. OCR 拍照识别成分表

| 位置 | 内容 |
| --- | --- |
| src/lib/ocr/index.ts | parseIngredientImage(image) 返回 { text, confidence, provider }，当前抛出 NOT_IMPLEMENTED，注释中写明了输入输出契约 |
| src/app/api/ocr/route.ts | 已接收 multipart/form-data 的 image 字段并调用上述函数，当前返回 501 + 友好提示 |
| 前端接入点 | 在 src/app/analyze/page.tsx 增加「拍照 / 上传图片」按钮，拿到 text 后直接写入成分输入框，后续复用现有 /api/analyze |

落地时只需三步：选定 OCR 提供方（云端视觉 API 或本地 tesseract）→ 在 parseIngredientImage 内实现 → 前端加一个上传入口。

### 2. AI 拍照测肤

| 位置 | 内容 |
| --- | --- |
| src/lib/skin/index.ts | analyzeSkinImage(image) 返回 { suggestedProfile, confidence, notes }，当前抛出 NOT_IMPLEMENTED |
| src/app/api/skin-analysis/route.ts | 已接收图片并调用上述函数，当前返回 501 |
| 前端接入点 | 「我的」页面已展示「AI 拍照测肤：即将推出」入口，未来改为拍摄 → 展示模型建议值 → 用户确认后写入 UserProfile |

隐私前置要求：上线前必须先完成明确的授权流程与用途说明，并保留「不使用照片也能完整使用产品」的降级路径。

## 九、已知限制（MVP 范围内）

- 成分库为 demo 级数据（110+ 条），冷门成分会记为「未收录」，不影响报告生成（会保留原文并交给 AI 参考）。
- 配方结构百分比是按「成分数量 + 成分表排序位置」加权的估算值，不是真实含量，界面中已明确标注。
- 产品类型与成分相关性基于公开资料，不做任何医学判断，报告内多处提示「不构成医疗诊断」。
- 记录仅存于本地浏览器，没有账号与云端同步。
- 界面为简体中文，暂未做多语言。

## 十、免责声明

成分分析基于公开成分资料与配方结构推断，不构成医疗诊断或医学建议。
成分资料为信息性科普内容，用于帮助你理解成分与配方结构，不代表医学结论。
如有持续泛红、长痘、皮疹等皮肤问题，请咨询专业医生。
