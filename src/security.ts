const encoder = new TextEncoder();

export function extractBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (!authorization) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  return match?.[1] ?? null;
}

export async function timingSafeEqual(left: string, right: string): Promise<boolean> {
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const maxLength = Math.max(leftBytes.length, rightBytes.length, 1);
  const paddedLeft = new Uint8Array(maxLength);
  const paddedRight = new Uint8Array(maxLength);
  paddedLeft.set(leftBytes);
  paddedRight.set(rightBytes);

  const [leftDigest, rightDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", paddedLeft),
    crypto.subtle.digest("SHA-256", paddedRight)
  ]);
  const leftHash = new Uint8Array(leftDigest);
  const rightHash = new Uint8Array(rightDigest);
  let mismatch = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < leftHash.length; index += 1) {
    mismatch |= leftHash[index]! ^ rightHash[index]!;
  }
  return mismatch === 0;
}

export async function isAuthorized(request: Request, expectedToken: string | undefined): Promise<boolean> {
  if (!expectedToken || expectedToken.length < 32) return false;
  const suppliedToken = extractBearerToken(request);
  return suppliedToken ? timingSafeEqual(suppliedToken, expectedToken) : false;
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
