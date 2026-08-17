# 印象笔记 NoteStore MCP（Cloudflare Worker）

把 **印象笔记（Yinxiang）EDAM / Thrift NoteStore API** 封装成一个运行在 **Cloudflare Workers** 上、受 **Cloudflare Access** 保护的 Streamable HTTP MCP Server。

项目使用 Evernote 官方 JavaScript SDK，并刻意只暴露两个 MCP Tool：

- `yinxiang_search_api`：按方法名、参数、风险等级或用途检索允许调用的 NoteStore API。
- `yinxiang_execute`：使用具名参数执行白名单中的 API，Developer Token 由 Worker 在服务端注入。

这种设计避免把几十个 EDAM 方法全部直接注册成 MCP Tool，从而控制 Tool Schema 和模型上下文体积。

> 本项目适合个人自托管。`YINXIANG_DEVELOPER_TOKEN`、Cloudflare Access 配置和任何其他凭证都不应提交到 Git。

## 工作方式

```text
MCP Client
   │
   │ MCP Streamable HTTP
   ▼
Cloudflare Access
   │  Cf-Access-Jwt-Assertion
   ▼
yinxiang-mcp-worker
   ├─ verify Access JWT
   ├─ yinxiang_search_api
   ├─ yinxiang_execute
   ├─ allowlist + deletion guards
   ▼
Yinxiang NoteStore API
```

Worker 负责：

1. 校验 Cloudflare Access JWT 的签名、issuer 和 audience。
2. 从 Worker Secret 读取 Developer Token。
3. 只允许调用登记在白名单中的 NoteStore 方法。
4. 对带有删除/取消共享语义的参数做第二层阻断。
5. 固定 NoteStore 上游主机和路径格式，降低 SSRF 风险。
6. 对上游请求设置超时，并限制单次 MCP 响应体积。

## 为什么只有两个 Tool

EDAM NoteStore API 的方法较多，如果全部一对一注册为 MCP Tools，会显著增加 MCP discovery 结果和模型上下文体积。

因此本项目采用“**搜索接口 → 通用执行器**”模式：

```text
yinxiang_search_api
        ↓
找到方法、参数和风险说明
        ↓
yinxiang_execute
        ↓
执行白名单 NoteStore API
```

建议 MCP 客户端先搜索，再执行；不要依赖模型猜测 EDAM 参数顺序。

## 安全边界

### Developer Token

`YINXIANG_DEVELOPER_TOKEN` 必须使用 Cloudflare Worker Secret，不写入代码、README、`.dev.vars.example` 或日志。

印象笔记 Developer Token 通常具有较高账户权限，而且可能有有效期。Token 泄露后应立即撤销/更换，不能只删除 Git 当前文件。

### Cloudflare Access

`/health` 和 `/mcp` 均由 Worker 校验 `Cf-Access-Jwt-Assertion`：

- issuer 必须与 `TEAM_DOMAIN` 一致；
- audience 必须匹配 `POLICY_AUD`；
- JWT 签名使用 Cloudflare Access JWKS 校验。

Cloudflare Access 仍应在边缘层配置对应 Application 和 Policy。对于 MCP 客户端，可按实际需要启用 Managed OAuth。

### 删除能力被禁用

本项目不是“完整无约束 EDAM 代理”。以下危险能力不会注册或会被语义校验阻断：

- `deleteNote`
- 所有 `expunge*`
- `untagAll`
- `unsetNoteApplicationDataEntry`
- `unsetResourceApplicationDataEntry`
- `stopSharingNote`
- `updateNote` / `updateNoteIfUsnMatches` 中的 `active=false`
- 分享管理参数中的 unshare / 取消共享语义

因此通用执行器不能用来绕过这些限制。

## 环境要求

- Node.js 20+（建议当前 LTS）
- Cloudflare 账号
- Wrangler 4.x
- 印象笔记 Developer Token
- 对应账号的 NoteStore URL
- 一个 Cloudflare Access Application

## 安装

```bash
git clone https://github.com/happy2first/yinxiang-mcp-worker.git
cd yinxiang-mcp-worker
npm install
```

复制本地环境变量示例：

```bash
cp .dev.vars.example .dev.vars
```

`.dev.vars` 已加入 `.gitignore`，不要提交真实 Token。

## 环境变量

| 名称 | 类型 | 说明 |
|---|---|---|
| `YINXIANG_DEVELOPER_TOKEN` | **Secret** | 印象笔记 Developer Token |
| `TEAM_DOMAIN` | Variable | Cloudflare Zero Trust Team Domain，例如 `https://example.cloudflareaccess.com` |
| `POLICY_AUD` | Variable / Secret | Cloudflare Access Application Audience (AUD) Tag |
| `YINXIANG_NOTESTORE_URL` | Variable | NoteStore URL，默认示例为 `https://app.yinxiang.com/shard/s6/notestore` |
| `UPSTREAM_TIMEOUT_MS` | Variable | 上游 API 超时，默认 15000 ms |
| `MAX_RESPONSE_BYTES` | Variable | 最大响应体积，默认 950000 bytes |

### `TEAM_DOMAIN` 的正确格式

填写 Cloudflare Zero Trust Team Domain 的 **origin**：

```text
https://example.cloudflareaccess.com
```

不要填写：

```text
https://example.cloudflareaccess.com/cdn-cgi/access/certs
```

JWKS 路径由 Worker 自己拼接。

### NoteStore URL

Worker 只接受以下形式：

```text
https://app.yinxiang.com/shard/<shard-id>/notestore
```

请使用印象笔记为你的 Developer Token / 账号提供的实际 NoteStore URL。

## Cloudflare 配置

敏感 Token 建议使用 Wrangler Secret：

```bash
npx wrangler login
npx wrangler secret put YINXIANG_DEVELOPER_TOKEN
```

其余变量可以通过 Cloudflare Dashboard 设置，也可以使用你自己的部署流程管理。

`wrangler.jsonc` 中不会写入个人 `TEAM_DOMAIN` 或 `POLICY_AUD`。项目设置了 `keep_vars: true`，便于把实际运行配置保留在 Cloudflare 环境侧。

## 本地开发

```bash
npm run types
npm run dev
```

`npm run types` 会生成 `worker-configuration.d.ts`。该文件可能包含当前 Wrangler 环境中的具体变量值，因此**不纳入版本控制**。

完整检查：

```bash
npm run check
```

该命令会依次执行：

- Wrangler 类型生成
- TypeScript typecheck
- Vitest 测试
- Wrangler dry-run deploy

## 部署

```bash
npm run check
npm run deploy
```

Developer Token 到期或更换时，只覆盖 Cloudflare Secret，不需要修改代码：

```bash
npx wrangler secret put YINXIANG_DEVELOPER_TOKEN
```

## HTTP 入口

- `GET /`：公共状态页，仅表明服务存在。
- `GET /health`：受 Cloudflare Access 保护的健康检查。
- `POST /mcp`：受 Cloudflare Access 保护的 MCP Streamable HTTP 入口。

不要把 `/health` 或 `/mcp` 配置成绕过 Access 的公开路径。

## MCP 调用示例

### 1. 搜索可用 API

先使用 `yinxiang_search_api` 查询，例如搜索“笔记列表”或具体方法名。

客户端会得到匹配方法的：

- 方法名
- 参数列表
- 风险分类
- 简要用途

### 2. 执行 API

然后调用 `yinxiang_execute`：

```json
{
  "method": "findNotesMetadata",
  "arguments": {
    "filter": {
      "words": "project",
      "ascending": false
    },
    "offset": 0,
    "maxNotes": 20,
    "resultSpec": {
      "includeTitle": true,
      "includeUpdated": true,
      "includeNotebookGuid": true,
      "includeTagGuids": true
    }
  }
}
```

`arguments` 使用**具名参数**。Worker 会根据 registry 中的方法定义转换成 SDK 所需的参数顺序。

### 二进制数据

二进制输入输出统一使用：

```json
{
  "$base64": "..."
}
```

Worker 会在调用 SDK 前后进行 Base64 与二进制值转换。

## 开发与扩展

白名单方法及风险分类主要定义在 `src/registry.ts`。如果要扩展能力，建议同时检查：

1. 官方 NoteStore 方法签名。
2. 参数是否可能产生删除、撤销共享或其他高风险副作用。
3. `src/security.ts` 是否需要新增语义保护。
4. 测试是否覆盖新增风险边界。

不要通过简单地“开放所有 NoteStore 方法”来扩展本项目，否则会破坏当前安全模型。

## 已知限制

- Developer Token 的申请、有效期和权限由印象笔记平台决定。
- 当前依赖传统 EDAM / Thrift NoteStore API，而不是新的 REST API。
- MCP 侧没有为每个 EDAM 方法单独设置用户权限；权限边界主要由 allowlist、语义保护和 Cloudflare Access 共同组成。
- 大型资源或大批量查询可能触发 `MAX_RESPONSE_BYTES` 或 Worker / 上游限制。

## 参考资料

- [Evernote NoteStore API](https://dev.evernote.com/doc/reference/NoteStore.html)
- [Evernote JavaScript SDK](https://github.com/Evernote/evernote-sdk-js)
- [Cloudflare MCP / Streamable HTTP](https://developers.cloudflare.com/agents/model-context-protocol/)
- [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/)
- [Cloudflare Workers Best Practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/)

## 贡献

欢迎提交 Issue / Pull Request，尤其是：

- 补充 NoteStore API 的方法说明和风险分类。
- 改进 EDAM 类型定义。
- 增加更完整的测试。
- 改善 Cloudflare Access / Managed OAuth 接入说明。
- 在不放宽删除安全边界的前提下扩展功能。

## License

MIT
