import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { executeEdamMethod } from "./edam";
import { BLOCKED_METHODS, METHOD_BY_NAME, METHODS, searchMethods } from "./registry";

const argumentsSchema = z.record(z.string(), z.unknown());

export function createServer(env: Env): McpServer {
  const server = new McpServer({ name: "yinxiang-notestore", version: "1.0.0" });

  server.registerTool(
    "yinxiang_search_api",
    {
      description: "Search the allowed Yinxiang NoteStore API registry by method, parameter, risk, or purpose. Call this before execute.",
      inputSchema: { query: z.string().max(200).default("") },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true }
    },
    async ({ query }) => textResult({
      apiVersion: "2.0.5",
      count: searchMethods(query).length,
      methods: searchMethods(query),
      blockedMethods: BLOCKED_METHODS,
      binaryConvention: "Use {$base64: '...'} for binary input; binary output uses the same shape."
    })
  );

  server.registerTool(
    "yinxiang_execute",
    {
      description: "Execute one allowlisted Yinxiang NoteStore EDAM method. Authentication is injected server-side. Deletion semantics are blocked.",
      inputSchema: {
        method: z.string().refine((name) => METHOD_BY_NAME.has(name), "Method is not allowlisted"),
        arguments: argumentsSchema.default({})
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false }
    },
    async ({ method, arguments: namedArgs }) => {
      try {
        const result = await executeEdamMethod(
          {
            developerToken: requireEnv(env.YINXIANG_DEVELOPER_TOKEN, "YINXIANG_DEVELOPER_TOKEN"),
            noteStoreUrl: requireEnv(env.YINXIANG_NOTESTORE_URL, "YINXIANG_NOTESTORE_URL"),
            timeoutMs: parsePositiveInt(env.UPSTREAM_TIMEOUT_MS, 15_000),
            maxResponseBytes: parsePositiveInt(env.MAX_RESPONSE_BYTES, 950_000)
          },
          method,
          namedArgs
        );
        return textResult({ method, result });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown EDAM failure";
        console.error(JSON.stringify({ event: "edam_call_failed", method, errorType: error instanceof Error ? error.name : "Unknown" }));
        return { isError: true, content: [{ type: "text", text: JSON.stringify({ method, error: message }) }] };
      }
    }
  );

  return server;
}

export function capabilitySummary(): object {
  return {
    service: "yinxiang-notestore-mcp",
    apiVersion: "2.0.5",
    allowedMethodCount: METHODS.length,
    blockedMethodCount: BLOCKED_METHODS.length,
    endpoints: { mcp: "/mcp", health: "/health" }
  };
}

function textResult(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

function requireEnv(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
