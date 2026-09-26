import { describe, expect, it } from "vitest";
import {
  AssetPackManifest, AssetPackRef, derivePackMode, parseAssetPack, resolvePackRef,
  StyleSpecSchema, PaletteSchema,
  type AssetPackManifest as Manifest,
} from "../src/index.js";

const SHA = (c: string) => "sha256:" + c.repeat(64);

/** 一个最小的、合法的包。**每一处 mutation 都从它深拷一份** —— 反例才有意义。 */
function validManifest(): Manifest {
  return {
    format: "assetpack/v2",
    id: "dystopian-shop",
    version: 1,
    createdAt: new Date(1790208000_000).toISOString(),
    generator: { name: "game-maker", version: "0.0.0", run: "test" },
    provenance: {
      mode: "mixed",
      style: { origin: "human-in-session", ref: "authoring/stylespec.json", stylespecId: "style-ref", checksum: SHA("b") },
      // ⚠️ 这里曾有 `degradations: []` —— 随降级链于 2026-09-25 删除（format 因此升到 v2）
    },
    palette: {
      ref: "authoring/stylespec.json#/palette", size: 3, values: ["#7c968e", "#55685f", "#ead8a6"],
      coverage: { exact: 1, composited: 1, quantized: 1, unbound: 0 },
    },
    atlases: [
      { id: "animations", kind: "animation", meta: "delivery/atlas.animations.json", image: "delivery/atlas.animations.png", size: { w: 24, h: 64 }, frames: 2, assets: ["player"], checksum: SHA("c") },
      { id: "sprites", kind: "sprite", meta: "delivery/atlas.sprites.json", image: "delivery/atlas.sprites.png", size: { w: 64, h: 16 }, frames: 1, assets: ["platform"], checksum: SHA("d") },
      { id: "backgrounds", kind: "background", meta: "delivery/atlas.backgrounds.json", image: "delivery/atlas.backgrounds.png", size: { w: 320, h: 180 }, frames: 1, assets: ["shop"], checksum: SHA("e") },
    ],
    assets: [
      {
        id: "player", kind: "animation", role: "protagonist", origin: "generated", paletteBinding: "composited",
        required: true, size: { w: 24, h: 32 }, anchor: { x: 0.5, y: 0.92 }, atlasId: "animations",
        frames: [{ name: "player.idle" }, { name: "player.walk1" }],
        // 票 26：动画是 Asset 内部唯一的分组概念 —— 多于一帧时每帧都必须归组。
        // 「状态」就是一个单帧动画，所以 idle 是动画而不是另一个字段。
        animations: [
          { name: "idle", frames: ["player.idle"], fps: 1, loop: true },
          { name: "walk", frames: ["player.walk1"], fps: 8, loop: true },
        ],
        authoring: [{ kind: "drawlist", ref: "authoring/drawlist/player.idle.json" }, { kind: "drawlist", ref: "authoring/drawlist/player.walk1.json" }],
      },
      {
        id: "platform", kind: "sprite", role: "ground-tile", origin: "generated", paletteBinding: "exact",
        required: true, size: { w: 64, h: 16 }, anchor: { x: 0, y: 0 }, atlasId: "sprites",
        frames: [{ name: "platform" }],
        authoring: [{ kind: "drawlist", ref: "authoring/drawlist/platform.json" }],
      },
      {
        id: "shop", kind: "background", role: "scene-backdrop", origin: "imported", paletteBinding: "quantized",
        required: true, size: { w: 320, h: 180 }, anchor: { x: 0, y: 0 }, atlasId: "backgrounds",
        frames: [{ name: "shop" }],
        authoring: [{ kind: "bitmap", ref: "authoring/imported/shop.png", original: "fixtures/reference/test.png" }],
      },
    ],
    files: [
      "authoring/drawlist/platform.json", "authoring/drawlist/player.idle.json", "authoring/drawlist/player.walk1.json",
      "authoring/imported/shop.png", "authoring/stylespec.json",
      "delivery/atlas.animations.json", "delivery/atlas.animations.png",
      "delivery/atlas.backgrounds.json", "delivery/atlas.backgrounds.png",
      "delivery/atlas.sprites.json", "delivery/atlas.sprites.png",
    ].map((path, i) => ({ path, bytes: 100 + i, checksum: SHA("f") })),
  };
}

const mutate = (f: (m: Manifest) => void): unknown => { const m = structuredClone(validManifest()); f(m); return m; };
const errorsOf = (input: unknown): string => {
  const r = parseAssetPack(input);
  expect(r.ok, "本该被拒，却通过了").toBe(false);
  return r.ok ? "" : r.errors.join("\n");
};

describe("AssetPackManifest —— 合法包必须通过", () => {
  it("最小合法包通过校验", () => {
    const r = parseAssetPack(validManifest());
    expect(r.ok, r.ok ? "" : r.errors.join(" / ")).toBe(true);
  });

  it("provenance.mode 与来源一致时通过（全 generated / 全 fixture）", () => {
    expect(parseAssetPack(mutate((m) => {
      m.assets = m.assets.filter((a) => a.origin === "generated");
      m.provenance.mode = "generated";
      m.atlases = m.atlases.filter((at) => at.id !== "backgrounds");
      m.palette.coverage = { exact: 1, composited: 1, quantized: 0, unbound: 0 };
      m.files = m.files.filter((f) => !f.path.includes("backgrounds") && !f.path.includes("shop"));
    })).ok).toBe(true);
  });
});

describe("derivePackMode —— 包级身份的**唯一**派生处", () => {
  it("单一来源各自映射到自己", () => {
    expect(derivePackMode(["generated", "generated"])).toBe("generated");
    expect(derivePackMode(["imported"])).toBe("imported");
    expect(derivePackMode(["fixture", "fixture"])).toBe("fixture");
  });
  it("混了才是 mixed", () => {
    expect(derivePackMode(["generated", "imported"])).toBe("mixed");
    expect(derivePackMode(["fixture", "imported"])).toBe("mixed");
  });
  it("空数组不落在 fixture 上（旧写法 `every` 对空集恒真，会把它判成 fixture 包）", () => {
    expect(derivePackMode([])).toBe("mixed");
  });
});

describe("⚠️ 纯导入的包 —— 2026-09-25 之前它在结构上无法诚实", () => {
  /** `validManifest()` 的每一项都改成人工导入。 */
  const allImported = (m: Manifest): Manifest => {
    for (const a of m.assets) { a.origin = "imported"; a.paletteBinding = "quantized"; }
    m.palette.coverage = { exact: 0, composited: 0, quantized: m.assets.length, unbound: 0 };
    return m;
  };

  it('mode 写 "imported" → 通过', () => {
    const m = mutate((x) => { allImported(x); x.provenance.mode = "imported"; });
    const r = parseAssetPack(m);
    expect(r.ok, r.ok ? "" : r.errors.join(" / ")).toBe(true);
  });

  it('⚠️ mode 写 "mixed" → 拒收（此前这是唯一一个能通过的写法，而它是假话）', () => {
    // validManifest 的 mode 本来就是 "mixed" —— 不改它，直接换来源
    expect(errorsOf(mutate(allImported))).toMatch(/矛盾/);
  });

  it('⚠️ mode 写 "generated" → 拒收（谎报自己是管线生成的）', () => {
    expect(errorsOf(mutate((x) => { allImported(x); x.provenance.mode = "generated"; }))).toMatch(/矛盾/);
  });
});

describe("反例 —— 票 24 那 9 条，原样搬成测试", () => {
  it("① 硬编码颜色混进 manifest 的色板", () => {
    expect(errorsOf(mutate((m) => { m.palette.values[0] = "#FF00FF"; }))).toMatch(/palette|色值/);
  });

  it("② 包版本号写成 0（绝不覆盖要求版本是正整数）", () => {
    expect(errorsOf(mutate((m) => { m.version = 0; }))).toContain("version");
  });

  it("③ 资源指向不存在的图集", () => {
    expect(errorsOf(mutate((m) => { m.assets[0]!.atlasId = "nope"; }))).toMatch(/不存在的图集/);
  });

  it("④ 动画引用不存在的帧", () => {
    expect(errorsOf(mutate((m) => { m.assets[0]!.animations![0]!.frames = ["player.nope"]; }))).toMatch(/不存在的帧/);
  });

  it("⑤ 绝对路径混进包", () => {
    expect(errorsOf(mutate((m) => { m.assets[0]!.authoring[0]!.ref = "/etc/passwd"; }))).toMatch(/相对/);
  });

  it("⑥ files[] 里漏掉一张图集", () => {
    expect(errorsOf(mutate((m) => { m.files = m.files.filter((f) => f.path !== m.atlases[0]!.image); }))).toMatch(/不在 files\[\] 里/);
  });

  it("⑦ 色板出现重复色", () => {
    expect(errorsOf(mutate((m) => { m.palette.values[1] = m.palette.values[0]!; }))).toMatch(/重复色/);
  });

  it("⑧（已废）paletteBinding 是 unbound 却没记降级 —— 那条规则随降级链一起删了", () => {
    // 2026-09-25：`unbound` 不再与「必须有降级记录」绑定。它现在是一个**独立成立的状态**：
    // 「不量化、颜色不受色板约束」。删掉规则、不删状态 —— 删状态会让这类包无法诚实。
    // ⚠️ 因此这条用的是**直接断言**，不是 `errorsOf`（那个助手的语义是「本该被拒」）。
    expect(parseAssetPack(mutate((m) => { m.assets[0]!.paletteBinding = "unbound"; })).ok).toBe(true);
  });

  it("⑨ 包谎报自己是 generated（来源里混着 imported）", () => {
    expect(errorsOf(mutate((m) => { m.provenance.mode = "generated"; }))).toMatch(/矛盾/);
  });
});

describe("反例 —— 落地时新增的几条", () => {
  it("路径里的 `..` 被拒（包必须能整体搬走）", () => {
    expect(errorsOf(mutate((m) => { m.assets[0]!.authoring[0]!.ref = "../outside/x.json"; }))).toMatch(/\.\./);
  });

  it("palette.size 与 values.length 不一致被拒", () => {
    expect(errorsOf(mutate((m) => { m.palette.size = 9; }))).toMatch(/不一致/);
  });

  it("图集声称包含不存在的资源被拒", () => {
    expect(errorsOf(mutate((m) => { m.atlases[0]!.assets.push("ghost"); }))).toMatch(/不存在的资源/);
  });

  it("checksum 格式不对被拒", () => {
    expect(errorsOf(mutate((m) => { m.files[0]!.checksum = "mock-abc-1"; }))).toMatch(/checksum|sha256/);
  });

  it("资源 id 重复被拒", () => {
    expect(errorsOf(mutate((m) => { m.assets.push(structuredClone(m.assets[1]!)); }))).toMatch(/id 重复/);
  });

  it("帧名重复被拒", () => {
    expect(errorsOf(mutate((m) => { m.assets[1]!.frames.push({ name: "platform" }); }))).toMatch(/帧名重复/);
  });

  it("⚠️ 多于一帧却不归组被拒 —— 那一帧是不可达的（票 26）", () => {
    const e = errorsOf(mutate((m2) => { m2.assets[0]!.animations = [{ name: "walk", frames: ["player.walk1"], loop: true }]; }));
    expect(e).toMatch(/不属于任何动画/);
  });

  it("单帧资源不需要动画分组（它本身就是「一个单帧动画」）", () => {
    const r = parseAssetPack(mutate((m2) => { delete m2.assets[0]!.animations; m2.assets[0]!.frames = [{ name: "player.idle" }]; }));
    expect(r.ok, r.ok ? "" : r.errors.join(" / ")).toBe(true);
  });

  it("size 为 null 被拒（票 27 收紧：每个资源都有帧，每个帧都有尺寸）", () => {
    expect(errorsOf(mutate((m2) => { (m2.assets[0] as unknown as { size: unknown }).size = null; }))).toContain("size");
  });

  it("未知的顶层字段被拒（strict）", () => {
    expect(errorsOf(mutate((m) => { (m as unknown as Record<string, unknown>).备注 = "AI 顺手加的"; }))).toBeTruthy();
  });

  it("锚点越界（不在 0..1）被拒", () => {
    expect(errorsOf(mutate((m) => { m.assets[0]!.anchor.x = 1.5; }))).toContain("anchor");
  });
});

describe("StyleSpec 的色板规范化（票 24 Q3 定的落点）", () => {
  const spec = (palette: string[]) => ({
    id: "s", identity: [], palette, confidence: 1,
  });

  it("大写 hex 被拒 —— 一个色值只能有一种拼法", () => {
    expect(StyleSpecSchema.safeParse(spec(["#7C968E"])).success).toBe(false);
  });

  it("三位缩写被拒", () => {
    expect(PaletteSchema.safeParse(["#abc"]).success).toBe(false);
  });

  it("重复色被拒 —— 否则 palette:3 与 palette:7 等价", () => {
    const r = StyleSpecSchema.safeParse(spec(["#7c968e", "#7c968e"]));
    expect(r.success).toBe(false);
  });

  it("规范化的小写 hex 通过", () => {
    expect(StyleSpecSchema.safeParse(spec(["#7c968e", "#ead8a6"])).success).toBe(true);
  });
});

describe("resolvePackRef —— 构建期静态解析，解不到就失败", () => {
  const m = validManifest();

  it("静态单状态资源：只给 asset 就够", () => {
    const r = resolvePackRef({ asset: "platform" }, m);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.frames.map((f) => f.name)).toEqual(["platform"]);
  });

  it("按动画引用：拿到的是帧的有序列表", () => {
    const r = resolvePackRef({ asset: "player", anim: "walk" }, m);
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.frames.map((f) => f.name)).toEqual(["player.walk1"]); expect(r.animation?.fps).toBe(8); }
  });

  it("单帧动画（原「状态」）：给 anim 拿到的就是那一帧", () => {
    const r = resolvePackRef({ asset: "player", anim: "idle" }, m);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.frames.map((f) => f.name)).toEqual(["player.idle"]);
  });

  it("引用语法里**不再有 state** —— 传了会被 strict 拒", () => {
    expect(AssetPackRef.safeParse({ asset: "player", state: "idle" }).success).toBe(false);
    expect(AssetPackRef.safeParse({ asset: "player", anim: "idle" }).success).toBe(true);
  });

  it("⚠️ 只给 asset 但资源有多个可画的东西 → 必须失败（fail fast，不留到运行时）", () => {
    const r = resolvePackRef({ asset: "player" }, m);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/必须指明/);
  });

  it("引用了不存在的资源 / 动画，各自给出可定位的错（并列出可选值）", () => {
    const a = resolvePackRef({ asset: "ghost" }, m);
    const c = resolvePackRef({ asset: "player", anim: "run" }, m);
    expect(a.ok || c.ok).toBe(false);
    if (!a.ok) expect(a.error).toMatch(/没有资源/);
    if (!c.ok) { expect(c.error).toMatch(/没有名为 "run" 的动画/); expect(c.error).toMatch(/idle, walk/); }
  });
});
