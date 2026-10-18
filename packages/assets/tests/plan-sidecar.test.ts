import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseAssetPlan, parseRecipe, type GameDesignSpec, type VisualWorldSpec } from "@game-maker/contracts";
import { CommandError, planAssets } from "../src/index.js";

const ROOT = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const FIX = path.join(ROOT, "fixtures/e2e/wasteland-platformer");
const RECIPE = JSON.parse(fs.readFileSync(path.join(FIX, "asset-recipe.json"), "utf8"));
const DESIGN: GameDesignSpec = JSON.parse(fs.readFileSync(path.join(FIX, "game-design.json"), "utf8"));
const WORLD: VisualWorldSpec = JSON.parse(fs.readFileSync(path.join(FIX, "visual-world.json"), "utf8"));
const IMAGE = { protocol: "gemini" as const, baseUrl: "http://x", apiKey: "k" };

const stage = (recipe: unknown = structuredClone(RECIPE)) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "gm-plan-sidecar-"));
  fs.writeFileSync(path.join(d, "game-design.json"), JSON.stringify(DESIGN));
  fs.writeFileSync(path.join(d, "visual-world.json"), JSON.stringify(WORLD));
  fs.copyFileSync(path.join(FIX, "style.png"), path.join(d, "style.png"));
  const seen: any[] = [];
  const fetchImpl = (async (_u: string, init: RequestInit) => {
    seen.push(JSON.parse(String(init.body)));
    return new Response(JSON.stringify({
      content: [{ type: "tool_use", name: "emit_asset_recipe", input: recipe }], stop_reason: "tool_use", model: "m",
    }), { status: 200, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
  return { d, seen, fetchImpl };
};
const run = (x: ReturnType<typeof stage>, over: Record<string, unknown> = {}) =>
  planAssets({
    designPath: path.join(x.d, "game-design.json"),
    visualWorldPath: path.join(x.d, "visual-world.json"),
    outRoot: path.join(x.d, "out"),
    transport: { baseUrl: "http://x", apiKey: "k" }, fetchImpl: x.fetchImpl,
    imageTransport: IMAGE,
    ...over,
  });
const readPlan = (x: ReturnType<typeof stage>, r: Awaited<ReturnType<typeof planAssets>>) => {
  const planPath = path.join(x.d, "out", String(r.data["plan"]));
  const plan = parseAssetPlan(JSON.parse(fs.readFileSync(planPath, "utf8")));
  expect(plan.ok, plan.ok ? "" : plan.errors.join(" / ")).toBe(true);
  const recipePath = path.join(x.d, "out", String(r.data["plan"]).replace(/\.plan\.json$/, ".json"));
  const recipe = parseRecipe(JSON.parse(fs.readFileSync(recipePath, "utf8")));
  expect(recipe.ok, recipe.ok ? "" : recipe.errors.join(" / ")).toBe(true);
  return { plan: plan.ok ? plan.value : null!, recipe: recipe.ok ? recipe.value : null!, planPath, recipePath };
};

describe("planAssets：模型候选 → resolver 最终 route → sidecar", () => {
  it("硬信号覆盖候选；sidecar 与 Recipe 逐项一致；候选/participated 记录", async () => {
    const recipe = structuredClone(RECIPE);
    // 让 player / background 的候选是 drawlist —— resolver 应覆盖为 image。
    for (const a of recipe.assets) if (["player-scavenger", "level-downtown-ruins"].includes(a.spec.id)) a.source = { kind: "drawlist" };
    const x = stage(recipe);
    const r = await run(x);
    const { plan, recipe: final } = readPlan(x, r);
    expect(plan.capabilities.routes).toEqual({ image: true, drawlist: true, import: false });
    expect(plan.capabilities.runtime.profile).toBe("platformer");
    expect(plan.plannerVersion).toBe("1");
    expect(plan.recipeVersion).toBe(1);
    expect(plan.inputs.styleRef).toBe("stylespec.json");
    expect(plan.inputs.referenceImage).toBe("reference.png");
    expect(plan.assets.map((a) => a.id).sort()).toEqual(final.assets.map((a) => a.spec.id).sort());
    for (const a of plan.assets) {
      const f = final.assets.find((e) => e.spec.id === a.id)!;
      expect(f.source.kind, `${a.id} sidecar route`).toBe(a.route);
    }
    const player = plan.assets.find((a) => a.id === "player-scavenger")!;
    expect(player.route).toBe("image");
    expect(player.reason.code).toBe("image:character");
    expect(player.candidate).toBe("drawlist");
    expect(player.participated).toBe(false);
    const bg = plan.assets.find((a) => a.id === "level-downtown-ruins")!;
    expect(bg.route).toBe("image");
    expect(bg.reason.code).toBe("image:background");
    const chest = plan.assets.find((a) => a.id === "chest-ruined-city")!;
    expect(chest.route).toBe("image");
    expect(chest.reason.code).toBe("image:candidate");
    expect(chest.participated).toBe(true);
    const ui = plan.assets.find((a) => a.id === "ui-scrap-counter")!;
    expect(ui.route).toBe("drawlist");
    expect(ui.reason.code).toBe("drawlist:ui-ninepatch");
    expect(ui.participated).toBe(false);
    expect(r.artifacts.map((a) => a.kind).sort()).toEqual(["asset-plan", "asset-recipe"]);
  });

  it("能力缺失：image 不可用 ⇒ usage，且不生成 sidecar", async () => {
    const x = stage();
    await expect(run(x, { imageTransport: undefined })).rejects.toMatchObject({ kind: "usage" });
    const recipes = path.join(x.d, "out", "wasteland-scavenger-assets", "recipes");
    expect(fs.existsSync(recipes) ? fs.readdirSync(recipes).some((n) => n.endsWith(".plan.json")) : false).toBe(false);
  });

  it("import fixture：mustReuse + 可访问 ⇒ import，recipe/sidecar 同步", async () => {
    const x = stage();
    const recipes = path.join(x.d, "out", "wasteland-scavenger-assets", "recipes");
    fs.mkdirSync(recipes, { recursive: true });
    fs.copyFileSync(path.join(FIX, "import-frame.png"), path.join(recipes, "frame.png"));
    const r = await run(x, { existingAssets: [{ id: "chest-ruined-city", ref: "frame.png", mustReuse: true }] });
    const { plan, recipe } = readPlan(x, r);
    const chest = plan.assets.find((a) => a.id === "chest-ruined-city")!;
    expect(chest.route).toBe("import");
    expect(chest.reason.code).toBe("import:explicit-ref");
    expect(chest.inputs).toEqual({ importRef: "frame.png" });
    expect(plan.capabilities.routes.import).toBe(true);
    expect(recipe.assets.find((a) => a.spec.id === "chest-ruined-city")!.source).toEqual({ kind: "import", ref: "frame.png" });
  });

  it("import ref 不可访问 ⇒ invalid", async () => {
    const x = stage();
    await expect(run(x, { existingAssets: [{ id: "chest-ruined-city", ref: "missing.png", mustReuse: true }] }))
      .rejects.toMatchObject({ kind: "invalid" });
  });

  it("dashscope-mcp + 角色母版 ⇒ usage（参考图能力缺失）", async () => {
    const x = stage();
    await expect(run(x, { imageTransport: { protocol: "dashscope-mcp", baseUrl: "http://x", apiKey: "k" } }))
      .rejects.toBeInstanceOf(CommandError);
    const x2 = stage();
    await expect(run(x2, { imageTransport: { protocol: "dashscope-mcp", baseUrl: "http://x", apiKey: "k" } }))
      .rejects.toMatchObject({ kind: "usage" });
  });
});
