// 票 19：`build` / `pack` 的 `--reuse-from` flag 解析。
import { describe, expect, it } from "vitest";
import { parseArgs } from "../src/cli.js";

describe("--reuse-from（票 19）", () => {
  it("build / pack 都接受 --reuse-from <packDir>", () => {
    expect(parseArgs(["build", "run/v1", "--reuse-from", "pack/v1"]).flags["reuse-from"]).toBe("pack/v1");
    expect(parseArgs(["pack", "--recipe", "r.json", "--reuse-from", "pack/v1"]).flags["reuse-from"]).toBe("pack/v1");
    expect(parseArgs(["build", "run/v1", "--reuse-config", "run/v1/game-config.json"]).flags["reuse-config"]).toBe("run/v1/game-config.json");
  });
});
