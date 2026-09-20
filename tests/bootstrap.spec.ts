import { describe, it, expect } from "vitest";
import { PLUGIN_ID, PLUGIN_VERSION } from "../src/constants.js";

describe("plugin bootstrap", () => {
  it("exports expected plugin identification constants", () => {
    expect(PLUGIN_ID).toBe("zaruba.vans-web-tools");
    expect(PLUGIN_VERSION).toBe("0.1.0");
  });
});
