# 印象笔记 NoteStore MCP（Cloudflare Worker）

把印象笔记（Yinxiang）EDAM/Thrift NoteStore API 发布为受保护的 Streamable HTTP MCP。服务使用官方 JavaScript SDK 2.0.5，并采用两个工具控制模型上下文体积：

- `yinxiang_search_api`：按方法名、参数、风险或用途检索接口。
- `yinxiang_execute`：用具名参数调用一个白名单接口，Developer Token 由 Worker 注入。

## 安全边界

- 使用与 `personal-mail-mcp` 相同的 Cloudflare Access 认证：边缘策略先拦截，Worker 再验证 `Cf-Access-Jwt-Assertion` 的签名、issuer 和 audience。
- `YINXIANG_DEVELOPER_TOKEN` 使用 Cloudflare Secret，不写入代码或日志。
- NoteStore URL 只允许 `https://app.yinxiang.com/shard/{id}/notestore`，避免 SSRF。
- 删除、永久删除、批量去标签、删除应用数据项、取消共享等方法不注册。
- `updateNote`/`updateNoteIfUsnMatches` 不能设置 `active=false`；分享管理不能携带 unshare 列表。
- 请求参数拒绝缺失字段和未知字段；响应默认限制为 950,000 字节。

> Cloudflare Access 可在控制台为 MCP 客户端启用 Managed OAuth；Worker 端不保存共享访问密码，只验证 Access 签发的短期 JWT。

## 环境变量

| 名称 | 类型 | 说明 |
|---|---|---|
| `YINXIANG_DEVELOPER_TOKEN` | Secret | 一周有效的 Developer Token |
| `POLICY_AUD` | Variable | Cloudflare Access 应用的 Application Audience (AUD) Tag |
| `TEAM_DOMAIN` | Variable | Cloudflare Zero Trust Team Domain；默认与个人邮箱 Worker 相同 |
| `YINXIANG_NOTESTORE_URL` | Variable | 默认 `https://app.yinxiang.com/shard/s6/notestore` |
| `UPSTREAM_TIMEOUT_MS` | Variable | 默认 15000 |
| `MAX_RESPONSE_BYTES` | Variable | 默认 950000 |

## 本地开发

```bash
npm install
cp .dev.vars.example .dev.vars
# 编辑 .dev.vars，切勿提交
npm run types
npm run dev
```

公共状态页：`GET /`。受 Cloudflare Access 保护的健康检查：`GET /health`。MCP 地址：`POST /mcp`。

## 部署

```bash
npx wrangler login
printf '%s' "$YINXIANG_DEVELOPER_TOKEN" | npx wrangler secret put YINXIANG_DEVELOPER_TOKEN
npm run check
npm run deploy
```

Token 到期后只需覆盖 Secret，无需重新提交代码：

```bash
printf '%s' "$NEW_YINXIANG_DEVELOPER_TOKEN" | npx wrangler secret put YINXIANG_DEVELOPER_TOKEN
```

## 调用约定

先调用 `yinxiang_search_api`，再按照返回的 `params` 向 `yinxiang_execute` 提供具名参数。二进制输入输出统一使用：

```json
{ "$base64": "..." }
```

例如搜索笔记：

```json
{
  "method": "findNotesMetadata",
  "arguments": {
    "filter": { "words": "智慧统计", "ascending": false },
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

## 已排除的接口

`deleteNote`、所有 `expunge*`、`untagAll`、两个 `unset*ApplicationDataEntry`、`stopSharingNote`。这些能力不会出现在 MCP 搜索结果中，也不能通过通用执行器绕过。

## 依据

- [印象笔记/Evernote NoteStore API](https://dev.evernote.com/doc/reference/NoteStore.html)
- [Evernote 官方 JavaScript SDK](https://github.com/Evernote/evernote-sdk-js)
- [Cloudflare MCP Streamable HTTP](https://developers.cloudflare.com/agents/model-context-protocol/protocol/transport/)
- [Cloudflare Workers 最佳实践](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/)
