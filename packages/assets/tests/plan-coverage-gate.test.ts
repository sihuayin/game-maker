// 票 01（P0-04）· **设计 → 清单的覆盖闸**（CAP-SPEC-12）＋ **空色板前移**（CAP-SPEC-17，plan 入口）。
//
// ⚠️ 覆盖闸的判据是**集合关系**，不是提示词质量：设计层四桶里每个 id 都必须有一件资产
//   的 `spec.id` 或 `spec.characterId` **逐字**等于它。人裁 2026-10-21：严格全覆盖、无豁免。
//   ⇒ 这里钉三件：① 对齐的夹具照常过（不误伤）；② 漏一个 / 改名一个字 ⇒ 拒，并**点名那个 id**；
//   ③ 它走的是**那一条现成的重采样路**（三发 `schema`，不新增错误通路）。
//
// ⚠️ 第二节问的是另一件事：**空色板必须在 `planAssets` 入口就拒**（CAP-SPEC-17），
//   而且一次上游调用都不发 —— 色板是下游一切的调色盘，空着编不出任何颜色。
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

const stage = (recipe: unknown = RECIPE, design: unknown = DESIGN, world: unknown = WORLD) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "gm-plan-cover-"));
  fs.writeFileSync(path.join(d, "game-design.json"), JSON.stringify(design));
  fs.writeFileSync(path.join(d, "visual-world.json"), JSON.stringify(world));
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

describe("§设计 → 清单的覆盖闸（CAP-SPEC-12）", () => {
  it("阳性：夹具的设计与清单逐 id 对齐 ⇒ 照常落盘（不误伤）", async () => {
    const x = stage();
    const r = await run(x);
    expect(recipeFiles(x).some((n) => /^v\d+\.json$/.test(n))).toBe(true);
    expect(r.data["assetCount"]).toBe(RECIPE.assets.length);
  });

  it("敌人缺资源 ⇒ `invalid`（退出码 4），消息**点名那个 id**，且三发都是 `schema`", async () => {
    const recipe = structuredClone(RECIPE);
    recipe.assets = recipe.assets.filter((a) => a.spec.id !== "enemy-wasteland");
    const x = stage(recipe);
    const e = await run(x).catch((err: unknown) => err);
    expect(e).toBeInstanceOf(CommandError);
    expect(exitCodeOfError(e)).toBe(4);
    expect((e as CommandError).message).toMatch(/enemy-wasteland/);
    expect(x.seen, "重采样三发，不新增错误通路").toHaveLength(STRUCTURED_CALL_ATTEMPTS);
    const call = (e as CommandError).ledger![0]!;
    expect(call.attempts).toBe(STRUCTURED_CALL_ATTEMPTS);
    expect(call.failures).toEqual(Array(STRUCTURED_CALL_ATTEMPTS).fill("schema"));
    expect(recipeFiles(x), "一页都不落盘").toHaveLength(0);
  });

  it("可交互物**改名**（`chest-ruined-city` → `chest-ruined-city-closed`）⇒ 同样拒：精确相等，不做前缀", async () => {
    const recipe = structuredClone(RECIPE);
    const chest = recipe.assets.find((a) => a.spec.id === "chest-ruined-city")!;
    chest.spec.id = "chest-ruined-city-closed";
    const x = stage(recipe);
    const e = await run(x).catch((err: unknown) => err);
    expect((e as CommandError).kind).toBe("invalid");
    expect((e as CommandError).message).toMatch(/chest-ruined-city/);
  });

  it("拾取物缺资源 ⇒ 拒", async () => {
    const recipe = structuredClone(RECIPE);
    recipe.assets = recipe.assets.filter((a) => a.spec.id !== "scrap-resource");
    const x = stage(recipe);
    const e = await run(x).catch((err: unknown) => err);
    expect((e as CommandError).kind).toBe("invalid");
    expect((e as CommandError).message).toMatch(/scrap-resource/);
  });

  it("NPC 桶同样受管：设计里多一个 `n-trader`、清单里没有它 ⇒ 拒", async () => {
    const design = structuredClone(DESIGN);
    design.npcs = [{ id: "n-trader", role: "废土商人", interaction: "用零件换补给" }];
    const x = stage(RECIPE, design);
    const e = await run(x).catch((err: unknown) => err);
    expect((e as CommandError).kind).toBe("invalid");
    expect((e as CommandError).message).toMatch(/n-trader/);
  });
});

describe("§空色板前移（CAP-SPEC-17 · 单独 `plan` 入口）", () => {
  it("`style.palette` 为空 ⇒ 入口就拒（`invalid` / 4），**一次上游调用都不发**", async () => {
    const world = structuredClone(WORLD);
    world.style = { ...world.style, palette: [] };
    const x = stage(RECIPE, DESIGN, world);
    const e = await run(x).catch((err: unknown) => err);
    expect(e).toBeInstanceOf(CommandError);
    expect((e as CommandError).kind).toBe("invalid");
    expect(exitCodeOfError(e)).toBe(4);
    expect((e as CommandError).message).toMatch(/palette/);
    expect(x.seen, "下游一次都没发").toHaveLength(0);
    expect(recipeFiles(x)).toHaveLength(0);
  });
});
