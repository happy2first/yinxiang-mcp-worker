import { describe, expect, it } from "vitest";
import { BLOCKED_METHODS, METHOD_BY_NAME, METHODS, searchMethods } from "../src/registry";

describe("NoteStore registry", () => {
  it("contains every non-destructive official SDK method and no blocked method", () => {
    expect(METHODS).toHaveLength(64);
    expect(METHOD_BY_NAME.size).toBe(METHODS.length);
    for (const blocked of BLOCKED_METHODS) expect(METHOD_BY_NAME.has(blocked)).toBe(false);
  });

  it("supports compact capability discovery", () => {
    expect(searchMethods("note read").some((method) => method.name === "getNoteContent")).toBe(true);
    expect(searchMethods("send").map((method) => method.name)).toContain("emailNote");
  });
});
