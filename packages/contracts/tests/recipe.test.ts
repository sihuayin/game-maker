import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseRecipe, type AssetRecipe as Recipe, type AssetSpec } from "../src/index.js";

const RECIPE_DIR = fileURLToPath(new URL("../../../fixtures/recipes/", import.meta.url));
/** **由真实需求推导出来的**清单实例（见 experiments/recipe-derivation/）。 */
const DERIVED: Recipe = JSON.parse(readFileSync(RECIPE_DIR + "shift-change.json", "utf8"));

const clone = (): Recipe => structuredClone(DERIVED);
const errors = (r: unknown): string => {
  const p = parseRecipe(r);
  expect(p.ok, "本该被拒，却通过了").toBe(false);
  return p.ok ? "" : p.errors.join("\n");
};

describe("清单接收真实推导出来的实例", () => {
  it("一次通过（这份清单是模型从需求文本+StyleSpec 推出来的，不是我手写的）", () => {
    const r = parseRecipe(DERIVED);
    expect(r.ok, r.ok ? "" : r.errors.join(" / ")).toBe(true);
  });

  it("形状确实是 {spec, source} 两层", () => {
    for (const e of DERIVED.assets) {
      expect(Object.keys(e).sort()).toEqual(["source", "spec"]);
      expect(e.source.kind).toBe("generate");
    }
  });

  it("⚠️ 同一个角色的多个动作是**一个资源**（票 26 + 票 22 的帧间一致性）", () => {
    // ⚠️ `.filter()` 不收窄元素类型 —— 得用类型谓词，否则 `spec.animations` 在联合类型上取不到。
    type Animated = Extract<AssetSpec, { kind: "animation" }>;
    const players = DERIVED.assets.map((e) => e.spec).filter((s): s is Animated => s.kind === "animation");
    expect(players).toHaveLength(1);
    expect(players[0]!.animations.map((a) => a.name).sort()).toEqual(["idle", "jump", "run"]);
  });

  it("世界里的招牌是 sprite，不是 ui（票 27 的裁决）", () => {
    expect(DERIVED.assets.find((a) => a.spec.id.includes("sign"))!.spec.kind).toBe("sprite");
  });
});

describe("反例 —— 清单的自洽性", () => {
  it("资源 id 重复被拒", () => {
    expect(errors((() => { const r = clone(); r.assets.push(structuredClone(r.assets[0]!)); return r; })())).toMatch(/id 重复/);
  });

  it("依赖了清单里没有的资源被拒（依赖跨出清单就无处兑现）", () => {
    expect(errors((() => { const r = clone(); r.assets[0]!.spec.dependencies = ["ghost"]; return r; })())).toMatch(/清单里没有/);
  });

  it("依赖自己也被拒", () => {
    expect(errors((() => { const r = clone(); r.assets[0]!.spec.dependencies = [r.assets[0]!.spec.id]; return r; })())).toMatch(/依赖它自己/);
  });

  it("版本号写错被拒", () => {
    expect(errors((() => { const r = clone() as unknown as { format: string }; r.format = "asset-recipe/v2"; return r; })())).toContain("format");
  });

  it("多出的顶层字段被拒（strict）", () => {
    expect(errors((() => { const r = clone() as unknown as Record<string, unknown>; r.备注 = "顺手加的"; return r; })())).toBeTruthy();
  });
});

describe("导入源 —— 与规格的一致性", () => {
  /** 把 player 改成一个 sheet 导入，用来测导入侧的规则。 */
  const withSheet = (over: Record<string, unknown> = {}): Recipe => {
    const r = clone();
    const e = r.assets.find((a) => a.spec.kind === "animation")!;
    e.source = {
      kind: "import", ref: "fixtures/import/sheet.png",
      sheet: {
        columns: 4, rows: 3, frameWidth: 32, frameHeight: 48,
        names: Array.from({ length: 12 }, (_, i) => `player.f${i}`),
        animations: [
          { name: "idle", frames: ["player.f0"] },
          { name: "run", frames: ["player.f1", "player.f2", "player.f3", "player.f4"] },
          { name: "jump", frames: ["player.f5", "player.f6", "player.f7", "player.f8"] },
        ],
      },
      ...over,
    } as never;
    // 让 spec 的帧数与 sheet 分组对上（4/4/4）
    e.spec = { ...e.spec, animations: [
      { name: "idle", frames: 1, loop: true }, { name: "run", frames: 4, loop: true }, { name: "jump", frames: 4, loop: false },
    ] } as never;
    return r;
  };

  it("网格格数与给的名字数对不上被拒", () => {
    const r = withSheet();
    (r.assets.find((a) => a.spec.kind === "animation")!.source as { sheet: { names: string[] } }).sheet.names.pop();
    expect(errors(r)).toMatch(/网格有 12 格，却给了 11 个帧名/);
  });

  it("sheet 的帧名重复被拒", () => {
    const r = withSheet();
    const sheet = (r.assets.find((a) => a.spec.kind === "animation")!.source as { sheet: { names: string[] } }).sheet;
    sheet.names[1] = sheet.names[0]!;
    expect(errors(r)).toMatch(/帧名有重复/);
  });

  it("spec 声明了动画却没给分组被拒", () => {
    const r = withSheet();
    delete (r.assets.find((a) => a.spec.kind === "animation")!.source as { sheet: Record<string, unknown> }).sheet.animations;
    expect(errors(r)).toMatch(/sheet 却没给 animations 分组/);
  });

  it("分组里的动画名与 spec 对不上被拒", () => {
    const r = withSheet();
    const sheet = (r.assets.find((a) => a.spec.kind === "animation")!.source as { sheet: { animations: { name: string }[] } }).sheet;
    sheet.animations[1]!.name = "sprint";
    expect(errors(r)).toMatch(/sheet 分了动画 "sprint"，spec 里没有/);
  });

  it("分组里的帧数与 spec 声明的对不上被拒", () => {
    const r = withSheet();
    const sheet = (r.assets.find((a) => a.spec.kind === "animation")!.source as { sheet: { animations: { name: string; frames: string[] }[] } }).sheet;
    sheet.animations[1]!.frames = sheet.animations[1]!.frames.slice(0, 2);
    expect(errors(r)).toMatch(/spec 要 4 帧，sheet 分组给了 2 帧/);
  });

  it("animation 类走导入却没给 sheet 被拒（单张独立 PNG 只有一帧）", () => {
    const r = clone();
    const e = r.assets.find((a) => a.spec.kind === "animation")!;
    e.source = { kind: "import", ref: "fixtures/import/one.png" } as never;
    expect(errors(r)).toMatch(/必须给 sheet/);
  });

  it("sprite 走导入（单张 PNG）是合法的 —— 那份真实背景就是这么进来的", () => {
    const r = clone();
    const e = r.assets.find((a) => a.spec.kind === "background")!;
    e.source = { kind: "import", ref: "fixtures/reference/test.png", background: { tolerance: 30 } } as never;
    const p = parseRecipe(r);
    expect(p.ok, p.ok ? "" : p.errors.join(" / ")).toBe(true);
  });
});

describe("AssetRecipe 与 AssetPackManifest 不共用类型（Spec 与 Artifact 是两层）", () => {
  it("清单里没有 manifest 才有的字段：没有 atlasId / files / checksum / paletteBinding", () => {
    const text = JSON.stringify(DERIVED);
    for (const key of ["atlasId", "checksum", "paletteBinding", "files", "provenance"]) {
      expect(text).not.toContain(`"${key}"`);
    }
  });

  it("拿一份 **manifest 形状**的对象当清单喂进去会被拒 —— 两者不共用类型", () => {
    // 一个最小的「包自描述」：有 atlasId / paletteBinding / checksum，没有 spec / source
    const manifestShaped = {
      format: "assetpack/v1", id: "x", version: 1,
      assets: [{ id: "player", kind: "animation", paletteBinding: "exact", atlasId: "animations" }],
    };
    expect(parseRecipe(manifestShaped).ok).toBe(false);
    // 反过来也一样：清单也不是合法的 manifest（清单里的 source 在 manifest 里不存在）
    expect(JSON.stringify(DERIVED)).toContain('"source"');
    expect(JSON.stringify(DERIVED)).not.toContain('"atlasId"');
  });
});
