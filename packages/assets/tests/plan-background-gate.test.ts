// 票 09（FPVS-V1-P0 票 08）· **背景层覆盖闸**（`backgroundCoverageGate`）。
//
// 背景画布盖不住世界是**清单层的确定性缺口** —— Stage B 卡点：背景 320×180 < 视口 480×270，
// config 那一步的 `auditLayerCoverage` 在**花完生图钱之后**才拒。这道闸在花钱之前、抽签圈里就判。
//
// 口径（票 08 逐字）：高 ≥ 视口高 270、宽走 tileable.x（parallax 0 层宽 ≥ 480）；不 tileable.y。
//   ⇒ 这里钉四件：① 对齐的夹具（背景 1920×540、正视差层 tileable.x）照常过；
//   ② 高 < 视口高 ⇒ 拒、点名高；③ 正视差层不 tileable.x ⇒ 拒、点名该层；
//   ④ parallax 0 层宽 < 视口宽 ⇒ 拒。走的是那一条现成的重采样路（三发 `schema`）。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  STRUCTURED_CALL_ATTEMPTS, exitCodeOfError,
  type AssetRecipe, type GameDesignSpec, type VisualWorldSpec,
} from "@game-maker/contracts";
import { CommandError, planAssets } from "../src/index.js";

const ROOT = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const FIX = path.join(ROOT, "fixtures/e2e/wasteland-platformer");
const RECIPE = JSON.parse(fs.readFileSync(path.join(FIX, "asset-recipe.json"), "utf8")) as AssetRecipe;
const DESIGN = JSON.parse(fs.readFileSync(path.join(FIX, "game-design.json"), "utf8")) as GameDesignSpec;
const WORLD = JSON.parse(fs.readFileSync(path.join(FIX, "visual-world.json"), "utf8")) as VisualWorldSpec;
const IMAGE = { protocol: "gemini" as const, baseUrl: "http://x", apiKey: "k" };
const BG_ID = "level-downtown-ruins";

const stage = (recipe: unknown = RECIPE) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "gm-plan-bg-"));
  fs.writeFileSync(path.join(d, "game-design.json"), JSON.stringify(DESIGN));
  fs.writeFileSync(path.join(d, "visual-world.json"), JSON.stringify(WORLD));
  fs.copyFileSync(path.join(FIX, "style.png"), path.join(d, "style.png"));
  const seen: Record<string, unknown>[] = [];
  const fetchImpl = (async (_u: string, init: RequestInit) => {
    seen.push(JSON.parse(String(init.body)));
    return new Response(JSON.stringify({
      content: [{ type: "tool_use", name: "emit_asset_recipe", input: recipe }], stop_reason: "tool_use", model: "m",
    }), { status: 200, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
  return { d, seen, fetchImpl };
};
const run = (x: ReturnType<typeof stage>) =>
  planAssets({
    designPath: path.join(x.d, "game-design.json"),
    visualWorldPath: path.join(x.d, "visual-world.json"),
    outRoot: path.join(x.d, "out"),
    transport: { baseUrl: "http://x", apiKey: "k" }, fetchImpl: x.fetchImpl, imageTransport: IMAGE,
  });
const recipeFiles = (x: ReturnType<typeof stage>) => {
  const dir = path.join(x.d, "out", RECIPE.id, "recipes");
  return fs.existsSync(dir) ? fs.readdirSync(dir) : [];
};
const bg = (recipe: AssetRecipe) => recipe.assets.find((a) => a.spec.id === BG_ID)!;

describe("§背景层覆盖闸（票 09）", () => {
  it("阳性：夹具背景 1920×540、正视差层 tileable.x、parallax 0 层宽 ≥ 视口 ⇒ 照常落盘", async () => {
    const x = stage();
    await run(x);
    expect(recipeFiles(x).some((n) => /^v\d+\.json$/.test(n))).toBe(true);
  });

  it("背景高 180 < 视口高 270（probe-7 的失败形状）⇒ `invalid`（4），点名高，三发 `schema`，不落盘", async () => {
    const recipe = structuredClone(RECIPE);
    const b = bg(recipe);
    if (b.spec.kind !== "background") throw new Error("夹具里没找到 background");
    b.spec.size = { w: 1920, h: 180 };
    const x = stage(recipe);
    const e = await run(x).catch((err: unknown) => err);
    expect(e).toBeInstanceOf(CommandError);
    expect(exitCodeOfError(e)).toBe(4);
    expect((e as CommandError).message).toMatch(/高 180 < 视口高 270/);
    expect(x.seen, "重采样三发，不新增错误通路").toHaveLength(STRUCTURED_CALL_ATTEMPTS);
    const call = (e as CommandError).ledger![0]!;
    expect(call.failures).toEqual(Array(STRUCTURED_CALL_ATTEMPTS).fill("schema"));
    expect(recipeFiles(x), "一页都不落盘").toHaveLength(0);
  });

  it("正视差层（facade，parallax 0.6）不写 tileable.x ⇒ 拒、点名该层", async () => {
    const recipe = structuredClone(RECIPE);
    const b = bg(recipe);
    if (b.spec.kind !== "background") throw new Error("夹具里没找到 background");
    const facade = b.spec.layers!.find((l) => l.name === "facade")!;
    delete facade.tileable;
    const x = stage(recipe);
    const e = await run(x).catch((err: unknown) => err);
    expect((e as CommandError).kind).toBe("invalid");
    expect((e as CommandError).message).toMatch(/facade/);
    expect((e as CommandError).message).toMatch(/tileable\.x/);
  });

  it("parallax 0 层（sky/horizon）宽 320 < 视口宽 480 ⇒ 拒、点名宽", async () => {
    const recipe = structuredClone(RECIPE);
    const b = bg(recipe);
    if (b.spec.kind !== "background") throw new Error("夹具里没找到 background");
    b.spec.size = { w: 320, h: 540 };
    const x = stage(recipe);
    const e = await run(x).catch((err: unknown) => err);
    expect((e as CommandError).kind).toBe("invalid");
    expect((e as CommandError).message).toMatch(/宽 320 < 视口宽 480/);
  });
});
