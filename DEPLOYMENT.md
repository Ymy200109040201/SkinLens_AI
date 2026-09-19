# SkinLens AI 公网部署指南

目标：让任何人打开一个公网 URL，就能直接体验「AI 化妆品成分分析 Demo」，不需要安装任何东西。

```
用户电脑 / 手机  →  公网 URL（HTTPS）  →  SkinLens AI（Next.js 全栈）  →  可选：外部 AI 服务
```

---

## 一、为什么选 Vercel（推荐平台）

| 平台 | 适配度 | 成本 | 说明 |
| --- | --- | --- | --- |
| **Vercel（推荐）** | ★★★★★ | Hobby 免费额度足够 Demo | Next.js 官方平台，零配置识别 `next build` / `next start`，自带 HTTPS、CDN、环境变量、日志与一键回滚 |
| Netlify / Cloudflare | ★★★☆ | 免费 | 也能跑 Next.js，但对 App Router 的支持由第三方集成提供，偶尔需要额外适配 |
| Railway / Render | ★★★★ | 免费额度较小 | 标准 Node 服务，`npm run build` + `npm start` 直接用，冷启动较慢 |
| 自有服务器 / Docker | ★★★ | 需自维护 | 完全可控，但要自己处理 HTTPS、进程守护、扩容 |

选 Vercel 的原因很简单：这个项目是**单一 Next.js 应用**（前端页面 + 服务端 Route Handler 在同一个工程里），
没有数据库、没有独立后端、没有额外运行时依赖，Vercel 可以零配置上线并自动签发 HTTPS 证书。
免费 Hobby 计划适合个人学习与非商业试用；如果这个 Demo 要用于商业推广 / 对外获客，
按 Vercel 的使用条款应升级到 Pro，或改用 Railway / Render / 自有服务器（本仓库代码无需改动，见方式 B / C）。

> 国内访问提示：`*.vercel.app` 域名在部分网络环境下访问不稳定。
> 做国内试用时建议绑定一个自己的域名（见第六节），必要时再加一层 CDN。

---

## 二、部署前检查（已完成，无需重复）

| 项目 | 状态 |
| --- | --- |
| `npm install` | ✅ 无特殊依赖，零额外运行时库 |
| `npm run lint` | ✅ 通过 |
| `npm run typecheck` | ✅ 通过 |
| `npm test` | ✅ 28 项通过（含限流、演示数据、AI 兜底） |
| `npm run build` | ✅ 生产构建通过（17 个路由） |
| `npm run start` | ✅ 生产服务可用，页面 / 接口 / PWA 均已自测 |
| API Key 位置 | ✅ 只在服务端读取，浏览器包里没有 Key |
| 硬编码本地地址 | ✅ 前端全部走相对路径 `/api/*`，无 `localhost` / `127.0.0.1` |
| 数据存储 | ✅ 浏览器 localStorage，与服务端文件系统无关，公网可用 |

---

## 三、方式 A：Vercel + Git（推荐，可自动重新部署）

### 1. 把代码推到 Git 仓库

项目目录不是 Git 仓库时，先初始化（已经初始化过就跳过）：

```bash
git init -b main
git add -A
git commit -m "chore: deployment-ready"
```

然后推到一个远端仓库（GitHub / GitLab / Bitbucket 都可以，私有仓库也可以）：

```bash
git remote add origin https://github.com/<你的账号>/<仓库名>.git
git push -u origin main
```

> 确认 `.env.local` 没有被提交：`.gitignore` 已经忽略 `.env*`，只放行 `.env.example`。

### 2. 在 Vercel 创建项目并连接仓库

1. 打开 https://vercel.com ，用 GitHub / GitLab 账号注册或登录（免费 Hobby 计划）。
2. 点 **Add New… → Project**。
3. 在 **Import Git Repository** 里选中刚才推送的仓库（第一次会要求授权 Vercel 访问你的仓库）。
4. 如果仓库不在列表里，点 **Adjust GitHub App Permissions** 授权后刷新。
5. Framework Preset 会自动识别为 **Next.js**；Build / Output / Install Command 保持默认
   （`npm install` → `npm run build`，Start 由平台自动接管）。

> **不想用 Git？** 也可以用命令行直传：
> ```bash
> npm i -g vercel
> vercel login
> vercel --prod
> ```
> 第一次会问几个问题，全部回车用默认值即可，最后同样会得到一个公网 URL。
> 这种方式的缺点是本地改代码后要手动再执行一次 `vercel --prod`。

### 3. 配置环境变量

在 **Project → Settings → Environment Variables** 里逐条添加（Environment 勾选 **Production**，需要的话再勾 Preview）：

| Key | Value | 必须 | 说明 |
| --- | --- | --- | --- |
| `MOCK_AI` | `true` | 建议先填 | 强制本地演示模式：不调用外部 AI，Demo 一定能跑通，也不花钱 |
| `OPENAI_API_KEY` | `sk-...` | 可选 | 真实 AI Key。填了它并且 `MOCK_AI=false` 才会真正调用模型 |
| `AI_MODEL` | `gpt-4o-mini` | 可选 | 模型名，可换任意 OpenAI 兼容模型 |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | 可选 | 用代理 / 兼容网关时修改，末尾不要带 `/` |
| `AI_RATE_LIMIT_PER_MINUTE` | `20` | 可选 | 每个 IP 每分钟接口调用上限，防刷 |

**推荐的第一版配置**：只填 `MOCK_AI=true`。
这样即使 Key 没配好、额度用尽或网络不通，试用者看到的依然是完整的分析报告流程。
确认流程没问题后，再按第八节切换成真实 AI。

> ⚠️ 不要在 Vercel 上使用 `NEXT_PUBLIC_` 前缀声明这些变量——带此前缀的值会被打包进浏览器代码。

### 4. 部署

点 **Deploy**。首次构建约 1-3 分钟，日志会实时显示在页面上。
看到 `Congratulations!` 或 **Build Completed** 即为成功。

### 5. 拿到公网 URL

- 部署完成后 Vercel 会给出两个地址：
  - `https://<项目名>.vercel.app`（正式地址，直接分享即可）
  - `https://<项目名>-git-<分支名>-<账号>.vercel.app`（每次推送代码的预览地址）
- 打开后先自检：

```
https://<你的域名>/api/health       → {"ok":true,"mode":"mock","hasApiKey":false,...}
https://<你的域名>/                 → 首页
https://<你的域名>/api/ai-status    → 当前 AI 模式
```

### 6. 重新部署

- **自动**：往同一个分支（例如 `main`）再 push 一次，Vercel 自动构建并替换线上版本。
- **手动**：Project → Deployments → 选择历史版本 → **Redeploy**（可用于快速回滚）。
- **只改了环境变量**：需要 **Redeploy** 才生效（`NEXT_PUBLIC_*` 是构建期注入，服务端变量在重新部署时注入到新实例）。

### 7. 查看日志

- **构建日志**：Project → Deployments → 点某次部署 → Build Logs。
- **运行日志（接口报错、AI 调用失败）**：Deployment → **Logs / Runtime Logs**，可按时间范围与状态码过滤。
  代码里 AI 失败会打印 `[ai] 请求失败` / `[analyze] AI 调用失败，回退本地分析`，搜索这些关键字最快。
- **用量**：Project → Settings → Usage，可以看到函数调用次数与流量，用于发现异常刷量。

---

## 四、方式 B：Railway / Render（Node 服务，非 Vercel 时的替代）

仓库自带标准脚本，任何支持 Node 的平台都能直接跑：

```bash
npm install     # Build Command
npm run build   # Build Command
npm start       # Start Command（平台会注入 PORT，Next.js 自动读取）
```

Railway：New Project → Deploy from GitHub repo → 变量里同样配置上一节的 Key。
Node 版本用 `package.json` 里的 `engines.node` 指定（≥ 20.9）。

## 五、方式 C：Docker（自建服务器）

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./
EXPOSE 3000
CMD ["npm", "start"]
```

```bash
docker build -t skinlens .
docker run -p 3000:3000 -e MOCK_AI=true skinlens
```

自建时记得在外层反向代理（Nginx / Caddy）上加 HTTPS。

---

## 六、要不要绑定自己的域名

- **只是发给同事 / 评委试用**：`xxx.vercel.app` 就够了，无需域名。
- **要在国内稳定访问、或者给别人一个更好记的地址**：建议绑定自己的域名。
  1. Vercel → Project → Settings → **Domains** → Add，输入如 `demo.yourbrand.com`。
  2. 到域名服务商处按提示添加一条 `CNAME`（`cname.vercel-dns.com`）。
  3. 等 DNS 生效（通常几分钟），HTTPS 证书由 Vercel 自动签发并续期。

> 若目标用户主要在国内，且 `vercel.app` 访问不畅：优先「自定义域名 + 国内可访问的 CDN」，
> 或把同一份代码部署到国内云厂商的 Node/容器服务（方式 B / C，无需改代码）。

---

## 七、部署后的验收清单

用手机和电脑各打开一次公网地址，确认：

1. 首页直接可用，没有开发环境提示、没有报错浮层。
2. 点「载入演示数据」→ 立刻出现 3 条示例分析。
3. 进入报告页：AI 总结、配方结构、值得关注、完整成分表都有内容。
4. 「记录」→ 搜索 / 收藏 / 删除正常；「对比」→ 选两款产品能出结构化对比。
5. 报告页「问问 AI」能连续追问，刷新页面后对话还在（数据在浏览器 localStorage）。
6. 「我的」→ 修改肤质 / 关注功效后重新分析，结论会变化。
7. 「我的 → 清除全部数据」能清空演示数据，并可以输入自己的成分表。
8. 手机浏览器「添加到主屏幕」后能全屏打开（PWA）。

---

## 八、AI Key 与费用管理

### 启用真实 AI（两步）

1. 在平台环境变量里填入 `OPENAI_API_KEY`（用代理/中转时同时填 `OPENAI_BASE_URL`）。
2. 把 `MOCK_AI` 改成 `false`（或删掉这个变量），然后 **Redeploy**。

验证：`GET /api/health` 返回 `{"mode":"llm","model":"..."}`，报告右上角标签从「本地演示分析」变成「AI 洞察」。

### 安全与省钱要点

- **Key 永远只放在服务端环境变量里**。前端代码、README、Git 提交里都不应出现真实 Key。
- 一旦怀疑泄露：立刻到 OpenAI 后台 **撤销该 Key** 并新建一个，然后只更新平台环境变量并重新部署。
  由于 Key 不参与构建产物，不需要改一行代码。
- 所有 AI 接口都有限流（默认 20 次/分钟/IP，可用 `AI_RATE_LIMIT_PER_MINUTE` 调整），
  超限返回 429 + 中文提示。注意：限流计数保存在单个实例内存中，Serverless 多实例下是「防误用」级别，
  公开推广时建议同时在 OpenAI 后台设置 **每月用量上限（Usage limits）**，这是最硬的兜底。
- 想临时停掉真实 AI 又不想删 Key：把 `MOCK_AI` 改成 `true` 再 Redeploy，Demo 立刻回到零成本模式。
- 试用期推荐先用 `MOCK_AI=true` 对外，内部验证完再打开真实 Key。

---

## 九、常见问题排查

| 现象 | 原因与处理 |
| --- | --- |
| 页面能打开，但点分析后提示「AI 服务暂时不可用」 | 正常降级：服务会自动改用本地规则引擎完成分析，报告里会有提示。想用真实 AI 检查 Key / Base URL / 额度 |
| 提示「操作有点频繁」 | 触发了限流（429）。等 1 分钟，或调大 `AI_RATE_LIMIT_PER_MINUTE` |
| 分析记录刷新后不见了 | 记录保存在浏览器 localStorage：换设备 / 换浏览器 / 无痕模式不会同步，属于 Demo 设计（可在「我的」导出 JSON 备份） |
| 部署成功但环境变量没生效 | 环境变量改动后需要 Redeploy；确认变量作用域勾选了 Production |
| 手机上「添加到主屏幕」后还是旧页面 | Service Worker 缓存：关闭 App 重新打开，或等新版本 SW 激活；发布新版本时可把 `public/sw.js` 的 `CACHE_NAME` 加一 |
| 想找回上一版 | Vercel → Deployments → 选择历史版本 → Redeploy，秒级回滚 |

---

## 十、最短部署路径（照着做）

```text
1. git init && git add -A && git commit -m "deploy" && git push 到 GitHub
2. vercel.com → Add New → Project → 选择该仓库 → Deploy
3. Settings → Environment Variables 加一条：MOCK_AI = true
4. Deployments → Redeploy（让变量生效）
5. 打开 https://<项目名>.vercel.app ，点「载入演示数据」即可开始体验
6. 想用真实 AI：再加 OPENAI_API_KEY，并把 MOCK_AI 改为 false → Redeploy
```
