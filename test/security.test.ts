import { describe, expect, it } from "vitest";
import { assertNoDeletionSemantics, isAuthorized, validateNoteStoreUrl } from "../src/security";

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

  it("requires a long bearer access token", async () => {
    const token = "a".repeat(48);
    const request = new Request("https://worker.example/mcp", { headers: { Authorization: `Bearer ${token}` } });
    await expect(isAuthorized(request, token)).resolves.toBe(true);
    await expect(isAuthorized(request, "short")).resolves.toBe(false);
  });
});
