import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

export interface AccessConfig {
  readonly TEAM_DOMAIN?: string;
  readonly POLICY_AUD?: string;
}

export function normalizeTeamDomain(value: string | undefined): string {
  if (!value) throw new Error("Missing TEAM_DOMAIN");
  const url = new URL(value);
  if (url.protocol !== "https:" || !url.hostname.endsWith(".cloudflareaccess.com") || url.pathname !== "/") {
    throw new Error("TEAM_DOMAIN must be an HTTPS cloudflareaccess.com origin");
  }
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

export async function verifyAccess(request: Request, env: AccessConfig): Promise<JWTPayload> {
  const teamDomain = normalizeTeamDomain(env.TEAM_DOMAIN);
  if (!env.POLICY_AUD) throw new Error("Missing POLICY_AUD");

  const token = request.headers.get("cf-access-jwt-assertion");
  if (!token) throw new Error("Missing Cloudflare Access JWT");

  const jwks = createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`));
  return (
    await jwtVerify(token, jwks, {
      issuer: teamDomain,
      audience: env.POLICY_AUD
    })
  ).payload;
}

export function validateNoteStoreUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== "app.yinxiang.com") {
    throw new Error("YINXIANG_NOTESTORE_URL must use HTTPS on app.yinxiang.com");
  }
  if (!/^\/shard\/[a-zA-Z0-9-]+\/notestore\/?$/.test(url.pathname)) {
    throw new Error("YINXIANG_NOTESTORE_URL has an unexpected NoteStore path");
  }
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

export function assertNoDeletionSemantics(method: string, args: Record<string, unknown>): void {
  if ((method === "updateNote" || method === "updateNoteIfUsnMatches") && isRecord(args.note) && args.note.active === false) {
    throw new Error("Deletion policy: setting Note.active=false is not allowed");
  }
  if (method === "manageNotebookShares" && isRecord(args.parameters)) {
    const parameters = args.parameters;
    if (
      nonEmptyArray(parameters.unshares) ||
      nonEmptyArray(parameters.sharedNotebookIdsToUnshare) ||
      nonEmptyArray(parameters.invitationsToUnshare) ||
      nonEmptyArray(parameters.membershipsToUnshare)
    ) {
      throw new Error("Deletion policy: unshare operations are not allowed");
    }
  }
}

function nonEmptyArray(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
