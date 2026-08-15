import { createMcpHandler } from "agents/mcp/server";
import { capabilitySummary, createServer } from "./server";
import { verifyAccess } from "./security";

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/") {
      return Response.json({ ok: true, service: "yinxiang-mcp-worker" });
    }
    if (url.pathname !== "/mcp" && url.pathname !== "/health") {
      return new Response("Not Found", { status: 404 });
    }

    let identity;
    try {
      identity = await verifyAccess(request, env);
    } catch (error) {
      return Response.json(
        {
          error: "access_denied",
          message: error instanceof Error ? error.message : String(error)
        },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (url.pathname === "/health" && request.method === "GET") {
      return Response.json({
        ...capabilitySummary(),
        user: identity.email ?? identity.sub ?? "authenticated",
        configured: {
          developerToken: Boolean(env.YINXIANG_DEVELOPER_TOKEN),
          noteStoreUrl: Boolean(env.YINXIANG_NOTESTORE_URL),
          cloudflareAccess: Boolean(env.TEAM_DOMAIN && env.POLICY_AUD)
        }
      });
    }

    return createMcpHandler(() => createServer(env))(request, env, ctx);
  }
} satisfies ExportedHandler<Env>;
