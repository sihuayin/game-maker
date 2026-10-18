import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseAssetPack, parseRecipe, type StyleSpec } from "@game-maker/contracts";
import { buildAssetPack, verifyPack } from "../src/index.js";

const ROOT = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const FIX = path.join(ROOT, "fixtures/e2e/wasteland-platformer");
const readJson = (p: string) => JSON.parse(fs.readFileSync(p, "utf8"));

describe("手写 import fixture：规则/pack 三路线中的 import 真的能执行（v3 票 09）", () => {
  it("固定 fixture 通过契约，buildAssetPack 产出一份 imported 包", async () => {
    const recipe = parseRecipe(readJson(path.join(FIX, "import-recipe.json")));
    expect(recipe.ok, recipe.ok ? "" : recipe.errors.join(" / ")).toBe(true);
    if (!recipe.ok) return;
    const out = fs.mkdtempSync(path.join(os.tmpdir(), "gm-import-fix-"));
    const res = await buildAssetPack({
      recipe: recipe.value,
      style: readJson(path.join(FIX, "stylespec.json")) as unknown as StyleSpec,
      outDir: out, recipeDir: FIX,
      generate: () => { throw new Error("这份 import 配方没有 drawlist 资源"); },
      sourceDateEpoch: 1790208000,
    });
    expect(res.manifest.assets).toHaveLength(1);
    expect(res.manifest.assets[0]!.id).toBe("import-demo");
    expect(res.manifest.provenance.mode).toBe("imported");
    const v = verifyPack({ packDir: res.packDir });
    expect(v.summary?.some((x) => x.includes("通过")), JSON.stringify(v)).toBe(true);
    const parsed = parseAssetPack(readJson(path.join(res.packDir, "manifest.json")));
    expect(parsed.ok).toBe(true);
  });
});
