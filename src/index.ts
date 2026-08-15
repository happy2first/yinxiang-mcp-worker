import { createMcpHandler } from "agents/mcp/server";
import { capabilitySummary, createServer } from "./server";
import { isAuthorized } from "./security";

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health" && request.method === "GET") {
      return Response.json({
        ...capabilitySummary(),
        configured: {
          developerToken: Boolean(env.YINXIANG_DEVELOPER_TOKEN),
          noteStoreUrl: Boolean(env.YINXIANG_NOTESTORE_URL),
          accessToken: Boolean(env.MCP_ACCESS_TOKEN)
        }
      });
    }
    if (url.pathname !== "/mcp") return new Response("Not Found", { status: 404 });
    if (!(await isAuthorized(request, env.MCP_ACCESS_TOKEN))) {
      return Response.json(
        { error: "unauthorized" },
        { status: 401, headers: { "WWW-Authenticate": "Bearer realm=\"yinxiang-mcp\"", "Cache-Control": "no-store" } }
      );
    }
    return createMcpHandler(() => createServer(env))(request, env, ctx);
  }
} satisfies ExportedHandler<Env>;
