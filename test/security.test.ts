import { describe, expect, it } from "vitest";
import { assertNoDeletionSemantics, normalizeTeamDomain, validateNoteStoreUrl, verifyAccess } from "../src/security";

describe("security policy", () => {
  it("pins the upstream to the Yinxiang NoteStore host and path", () => {
    expect(validateNoteStoreUrl("https://app.yinxiang.com/shard/s6/notestore")).toBe("https://app.yinxiang.com/shard/s6/notestore");
    expect(() => validateNoteStoreUrl("https://example.com/shard/s6/notestore")).toThrow();
    expect(() => validateNoteStoreUrl("https://app.yinxiang.com/evil")).toThrow();
  });

  it("blocks semantic note deletion and unsharing", () => {
    expect(() => assertNoDeletionSemantics("updateNote", { note: { active: false } })).toThrow(/Deletion policy/);
    expect(() => assertNoDeletionSemantics("manageNotebookShares", { parameters: { unshares: [{ longIdentifier: 1 }] } })).toThrow(/Deletion policy/);
  });

  it("pins the Cloudflare Access issuer and requires its JWT", async () => {
    expect(normalizeTeamDomain("https://example.cloudflareaccess.com/")).toBe("https://example.cloudflareaccess.com");
    expect(() => normalizeTeamDomain("https://example.com")).toThrow();
    const request = new Request("https://worker.example/mcp");
    await expect(
      verifyAccess(request, {
        TEAM_DOMAIN: "https://example.cloudflareaccess.com",
        POLICY_AUD: "test-audience"
      })
    ).rejects.toThrow(/Missing Cloudflare Access JWT/);
  });
});
