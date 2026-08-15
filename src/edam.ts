import { Client as EvernoteClient, type NoteStoreClient } from "evernote";
import { METHOD_BY_NAME, type MethodSpec } from "./registry";
import { assertNoDeletionSemantics, validateNoteStoreUrl } from "./security";

export interface EdamConfig {
  readonly developerToken: string;
  readonly noteStoreUrl: string;
  readonly timeoutMs: number;
  readonly maxResponseBytes: number;
}

export async function executeEdamMethod(
  config: EdamConfig,
  methodName: string,
  namedArgs: Record<string, unknown>
): Promise<unknown> {
  const method = METHOD_BY_NAME.get(methodName);
  if (!method) throw new Error(`Method is not allowed: ${methodName}`);
  assertExactArguments(method, namedArgs);
  assertNoDeletionSemantics(methodName, namedArgs);

  const client = new EvernoteClient({
    token: config.developerToken,
    sandbox: false,
    china: true,
    serviceHost: "app.yinxiang.com"
  });
  const noteStore: NoteStoreClient = client.getNoteStore(validateNoteStoreUrl(config.noteStoreUrl));
  const callable = noteStore[methodName];
  if (typeof callable !== "function") throw new Error(`Official SDK does not implement: ${methodName}`);

  const positionalArgs = method.params.map((name) => decodeBinaryMarkers(namedArgs[name]));
  const result = await withTimeout(
    callable.apply(noteStore, positionalArgs) as Promise<unknown>,
    config.timeoutMs,
    methodName
  );
  const json = JSON.stringify(encodeBinaryValues(result));
  if (Buffer.byteLength(json, "utf8") > config.maxResponseBytes) {
    throw new Error(`Response exceeds MAX_RESPONSE_BYTES (${config.maxResponseBytes})`);
  }
  return JSON.parse(json) as unknown;
}

export function assertExactArguments(method: MethodSpec, args: Record<string, unknown>): void {
  const expected = new Set(method.params);
  const missing = method.params.filter((name) => !(name in args));
  const unknown = Object.keys(args).filter((name) => !expected.has(name));
  if (missing.length || unknown.length) {
    throw new Error(`Invalid arguments for ${method.name}; missing=[${missing.join(", ")}], unknown=[${unknown.join(", ")}]`);
  }
}

export function decodeBinaryMarkers(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decodeBinaryMarkers);
  if (!isRecord(value)) return value;
  if (Object.keys(value).length === 1 && typeof value.$base64 === "string") {
    return Buffer.from(value.$base64, "base64");
  }
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, decodeBinaryMarkers(child)]));
}

export function encodeBinaryValues(value: unknown): unknown {
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return { $base64: Buffer.from(value).toString("base64") };
  }
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(encodeBinaryValues);
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, encodeBinaryValues(child)]));
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, methodName: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${methodName} timed out after ${timeoutMs} ms`)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
