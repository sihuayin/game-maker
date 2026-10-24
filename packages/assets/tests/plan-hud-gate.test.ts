// recipe-config-gap-v1 票 04 · **HUD ui 资源闸**。
//
// platformer/v1 的 config **结构上必填** hud（`game-config.ts:217`），`hud.panel` / `hud.pip` 的 asset
// 都必须是 `kind:"ui"`（`:361-362`）。清单若没有这两类 ui 资源，config 那一步只能拿 sprite 顶 HUD、
// 必被「是 sprite，这里要的是 ui」拒收（付费重跑 5 条硬失败的 3 条就是这么来的）。
// ⇒ 这里钉三件：① 对齐的夹具（带 ninePatch 的 ui 面板 + 不带 ninePatch 的 ui 图标）照常过；
//   ② 缺面板 / 缺图标 / 全缺 ⇒ 拒，并点名缺哪一类；③ 走那一条现成的重采样路（三发 `schema`）。
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

const stage = (recipe: unknown = RECIPE) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "gm-plan-hud-"));
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

describe("§HUD ui 资源闸（recipe-config-gap-v1 票 04）", () => {
  it("阳性：夹具带 ninePatch 面板 + 非 ninePatch 图标 ⇒ 照常落盘", async () => {
    const x = stage();
    await run(x);
    expect(recipeFiles(x).some((n) => /^v\d+\.json$/.test(n))).toBe(true);
  });

  it("缺带 ninePatch 的 ui 面板 ⇒ `invalid`（4），点名面板，三发 `schema`，不落盘", async () => {
    const recipe = structuredClone(RECIPE);
    recipe.assets = recipe.assets.filter((a) => a.spec.id !== "ui-scrap-counter");
    const x = stage(recipe);
    const e = await run(x).catch((err: unknown) => err);
    expect(e).toBeInstanceOf(CommandError);
    expect(exitCodeOfError(e)).toBe(4);
    expect((e as CommandError).message).toMatch(/ninePatch/);
    expect(x.seen, "重采样三发，不新增错误通路").toHaveLength(STRUCTURED_CALL_ATTEMPTS);
    const call = (e as CommandError).ledger![0]!;
    expect(call.failures).toEqual(Array(STRUCTURED_CALL_ATTEMPTS).fill("schema"));
    expect(recipeFiles(x), "一页都不落盘").toHaveLength(0);
  });

  it("缺不带 ninePatch 的 ui 图标 ⇒ 拒，点名图标", async () => {
    const recipe = structuredClone(RECIPE);
    recipe.assets = recipe.assets.filter((a) => a.spec.id !== "ui-scrap-icon");
    const x = stage(recipe);
    const e = await run(x).catch((err: unknown) => err);
    expect((e as CommandError).kind).toBe("invalid");
    expect((e as CommandError).message).toMatch(/图标/);
  });

  it("两件 ui 全缺 ⇒ 拒", async () => {
    const recipe = structuredClone(RECIPE);
    recipe.assets = recipe.assets.filter((a) => a.spec.kind !== "ui");
    const x = stage(recipe);
    const e = await run(x).catch((err: unknown) => err);
    expect((e as CommandError).kind).toBe("invalid");
    expect((e as CommandError).message).toMatch(/ui/);
  });
});
