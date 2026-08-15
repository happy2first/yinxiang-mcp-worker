import { describe, expect, it } from "vitest";
import { assertExactArguments, decodeBinaryMarkers, encodeBinaryValues } from "../src/edam";
import { METHOD_BY_NAME } from "../src/registry";

describe("EDAM adapter", () => {
  it("enforces exact named arguments", () => {
    const method = METHOD_BY_NAME.get("getNotebook");
    expect(method).toBeDefined();
    expect(() => assertExactArguments(method!, { guid: "g" })).not.toThrow();
    expect(() => assertExactArguments(method!, {})).toThrow(/missing/);
    expect(() => assertExactArguments(method!, { guid: "g", token: "leak" })).toThrow(/unknown/);
  });

  it("round-trips binary values through base64 markers", () => {
    const decoded = decodeBinaryMarkers({ body: { $base64: "aGk=" } }) as { body: Uint8Array };
    expect(new TextDecoder().decode(decoded.body)).toBe("hi");
    expect(encodeBinaryValues(decoded)).toEqual({ body: { $base64: "aGk=" } });
  });
});
