// 票 02（P0-06）· **`frames` 候选不再被静默折叠成 `image`**（CAP-ASSET-01）。
//
// ⚠️ 旧行为：`planAssets` 把候选 `frames` 映射成 `image`，落盘的清单与 sidecar 都看不出
//   模型原本选了什么 —— 一次**静默降级**。P0 的口径是**明确失败**（人裁 2026-10-21）：
//   不重采样、不参数化保留、不落 sidecar；代价是这条候选在规划期不可用（人要逐帧就手改清单）。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { exitCodeOfError, type AssetRecipe, type GameDesignSpec, type VisualWorldSpec } from "@game-maker/contracts";
import { CommandError, planAssets } from "../src/index.js";

const ROOT = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const FIX = path.join(ROOT, "fixtures/e2e/wasteland-platformer");
const RECIPE = JSON.parse(fs.readFileSync(path.join(FIX, "asset-recipe.json"), "utf8")) as AssetRecipe;
const DESIGN = JSON.parse(fs.readFileSync(path.join(FIX, "game-design.json"), "utf8")) as GameDesignSpec;
const WORLD = JSON.parse(fs.readFileSync(path.join(FIX, "visual-world.json"), "utf8")) as VisualWorldSpec;
const IMAGE = { protocol: "gemini" as const, baseUrl: "http://x", apiKey: "k" };

const stage = (recipe: unknown) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "gm-plan-frames-"));
  fs.writeFileSync(path.join(d, "game-design.json"), JSON.stringify(DESIGN));
  fs.writeFileSync(path.join(d, "visual-world.json"), JSON.stringify(WORLD));
  fs.copyFileSync(path.join(FIX, "style.png"), path.join(d, "style.png"));
  const seen: Record<string, unknown>[] = [];
  const fetchImpl = (async (_u: string, init: RequestInit) => {
    seen.push(JSON.parse(String(init.body)));
    return new Response(JSON.stringify({
      content: [{ type: "tool_use", name: "emit_asset_recipe", input: recipe }], stop_reason: "tool_use", model: "m",
      usage: { input_tokens: 10, output_tokens: 10 },
    }), { status: 200, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
  return { d, seen, fetchImpl };
};
const run = (x: ReturnType<typeof stage>) =>
  planAssets({
    designPath: path.join(x.d, "game-design.json"), visualWorldPath: path.join(x.d, "visual-world.json"),
    outRoot: path.join(x.d, "out"), transport: { baseUrl: "http://x", apiKey: "k" },
    fetchImpl: x.fetchImpl, imageTransport: IMAGE,
  });
const outputs = (x: ReturnType<typeof stage>) => {
  const dir = path.join(x.d, "out", RECIPE.id, "recipes");
  return fs.existsSync(dir) ? fs.readdirSync(dir) : [];
};

describe("§`frames` 候选：明确失败，不折叠、不落盘", () => {
  it("资产写 `source.kind:\"frames\"` ⇒ `invalid`（4），消息点名 id 与「逐帧模式」，一发就收", async () => {
    const recipe = structuredClone(RECIPE);
    const player = recipe.assets.find((a) => a.spec.kind === "animation")!;
    player.source = { kind: "frames" };
    const x = stage(recipe);
    const e = await run(x).catch((err: unknown) => err);
    expect(e).toBeInstanceOf(CommandError);
    expect((e as CommandError).kind).toBe("invalid");
    expect(exitCodeOfError(e)).toBe(4);
    expect((e as CommandError).message).toMatch(/frames/);
    expect((e as CommandError).message).toMatch(/逐帧模式/);
    expect((e as CommandError).message).toContain(player.spec.id);
    expect(x.seen, "不重采样（盲重发只会重复同一件事）").toHaveLength(1);
    expect((e as CommandError).ledger?.[0]?.attempts).toBe(1);
    expect(outputs(x), "清单与 sidecar 一个都不落").toHaveLength(0);
  });

});
