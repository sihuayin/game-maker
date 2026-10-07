// 票 13 的**运行那一半**：母版前段、参考图的接线、失败传播 —— 全部用假端口（不发真请求、不花钱）。
//
// ⚠️ 这一份钉的是四条**决定**：
//   ① 母版前段**在资产之前**跑，而资产那一发把母版位图当 `reference` 递出去；
//   ② 失败的母版**只阻断引用它的**资产（不引用它的照造），而整包**仍然失败**（不静默）；
//   ③ `drawlist` 母版与「要 DNA 却没给」都是**开跑前**拒（免费）；
//   ④ 有 DNA 就把身份那一句**换掉**（不是叠加），没有就回落 —— 8 份 fixture 一字不改。
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import type { AssetRecipe, AuthoringAsset, CharacterDNAFile, DrawList, StyleSpec } from "@game-maker/contracts";
import { CharacterDNASchema } from "@game-maker/contracts";
import { buildAssetPack, type DrawListGenerator, type ImageGenerator, type ImageRequest } from "../src/index.js";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const BASE: AssetRecipe = JSON.parse(readFileSync(ROOT + "fixtures/recipes/shift-change-master.json", "utf8"));
const STYLE: StyleSpec = JSON.parse(readFileSync(ROOT + ".scratch/game-creation-v1/experiments/style-transfer-from-test-png/stylespec.json", "utf8"));
const EPOCH = 1790208000;
/** ⚠️ **配方文件所在的那个目录** —— `referenceImage` 与 `source.ref` 都相对它解析（契约 `InputPath`）。 */
const RECIPE_DIR = path.join(ROOT, "fixtures/recipes");

const ANIM = BASE.assets.find((a) => a.spec.id === "player-odin")!;
const CRATE = BASE.assets.find((a) => a.spec.id === "obstacle-crates")!;
const MASTER_IMPORT = BASE.authoring![0]!;
const CRATE_DESC = CRATE.spec.description;

const DNA: CharacterDNAFile = {
  format: "character-dna/v1",
  characters: [{
    id: "p-scavenger",
    identity: "沙暴废城里最后一个还在翻垃圾的人",
    silhouette: "比同类窄一号，左肩塌下去",
    face: "两个像素眼窝，没有五官",
    clothing: "深蓝长大衣，下摆撕掉一半",
    gear: ["半截撬棍"],
    palette: ["palette:0"],
    visualConstraints: ["帽檐必须在眼线上方投出一条深色横带"],
  }],
};

const dirs: string[] = [];
const tmp = () => { const d = mkdtempSync(path.join(tmpdir(), "packmaster-")); dirs.push(d); return d; };
afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });

/** 两份资产：一个**引用母版**的动画，一个**与母版无关**的箱子（失败传播的对照）。 */
const recipe = (over: { master?: AuthoringAsset | null } = {}): AssetRecipe => {
  const anim = structuredClone(ANIM);
  (anim.spec as { animations: unknown }).animations = [{ name: "idle", frames: 1, fps: 1, loop: true }];
  const authoring = over.master === undefined ? [structuredClone(MASTER_IMPORT)] : over.master === null ? [] : [over.master];
  return { ...structuredClone(BASE), assets: [anim, structuredClone(CRATE)], authoring };
};

const px = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
const key = () => px("#ff00ff");
/** 一张「有内容」的假图：纯色底 + 中间一块实心（抠底与裁框都过得去）。 */
const image = (w: number, h: number, fill: string): { width: number; height: number; data: Buffer } => {
  const data = Buffer.alloc(w * h * 4);
  const [kr, kg, kb] = key(), [fr, fg, fb] = px(fill);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = (y * w + x) * 4;
    const inner = x >= w * 0.25 && x < w * 0.75 && y >= h * 0.25 && y < h * 0.75;
    data[o] = inner ? fr : kr; data[o + 1] = inner ? fg : kg; data[o + 2] = inner ? fb : kb; data[o + 3] = 255;
  }
  return { width: w, height: h, data };
};

const drawlists = (spec: { id: string; size: { w: number; h: number }; kind: string; animations?: unknown }): DrawList[] => {
  const n = spec.kind === "animation" ? 1 : 1;
  return Array.from({ length: n }, (_, i) => ({
    format: "drawlist+curve/v1", id: spec.id, frame: `f${i}`,
    viewBox: [0, 0, spec.size.w, spec.size.h], expectedSize: [spec.size.w, spec.size.h],
    ops: [{ op: "rect", x: 0, y: 0, w: spec.size.w, h: spec.size.h, fill: "palette:0" }] as DrawList["ops"],
  }));
};
const stub: DrawListGenerator = (spec) => drawlists(spec as never);

/** 假生图端口：记下每一发的请求，并按 `which` 认出它是**哪一发**。
 *  ⚠️ 认的是**提示词**（请求里没有 id）：母版那一份的头一行就是「母版参考图」。 */
function recorder(over: { failMaster?: boolean; masterImage?: (req: ImageRequest) => { width: number; height: number; data: Buffer } } = {}) {
  const calls: { which: "master" | "anim" | "crate"; req: ImageRequest }[] = [];
  const gen: ImageGenerator = async (req) => {
    const which = req.prompt.includes("母版参考图") ? "master" : req.prompt.includes("这组动作是") ? "anim" : "crate";
    calls.push({ which, req });
    if (which === "master" && over.failMaster) throw new Error("母版那一发挂了（测试注入）");
    const img = which === "master" && over.masterImage !== undefined
      ? over.masterImage(req)
      : image(req.size.w, req.size.h, STYLE.palette[1]!);
    return { image: img, call: { protocol: "gemini", requestedSize: `${req.size.w}x${req.size.h}`, ms: 1, attempts: 1 } };
  };
  return { calls, gen, of: (w: "master" | "anim" | "crate") => calls.filter((c) => c.which === w) };
}

const build = (over: Partial<Parameters<typeof buildAssetPack>[0]> = {}) =>
  buildAssetPack({ recipe: recipe(), style: STYLE, outDir: tmp(), recipeDir: RECIPE_DIR, generate: stub, sourceDateEpoch: EPOCH, ...over });

/** ⚠️ **等一次「必须抛」的构建** —— `.catch((x) => x as Error)` 的返回类型是**联合**
 *  （`Error | BuildPackResult`），于是 `e.message` 是类型错；而那个联合里「成功」那一支
 *  **根本不该出现**（它出现就说明这一发**没抛**，是这张用例的失败）。 */
const failed = (o: Partial<Parameters<typeof buildAssetPack>[0]> = {}): Promise<Error> =>
  build(o).then(
    (ok) => { throw new Error(`这一步**应当抛**，但它成功了：${JSON.stringify(ok).slice(0, 120)}`); },
    (e: unknown) => e as Error
  );

describe("§母版前段：人作的母版走 `import`（零调用）", () => {
  it("⚠️ 引用母版的那一发**拿到的是那张位图**（832×1248），不引用的那一发**没有参考图**", async () => {
    const r = recorder();
    await build({ generateImage: r.gen, characterDna: DNA });
    expect(r.of("master"), "import 的母版**不该**产生任何生图调用").toHaveLength(0);
    const anim = r.of("anim")[0]!;
    expect(anim.req.reference?.width).toBe(832);
    expect(anim.req.reference?.height).toBe(1248);
    expect(r.of("crate")[0]!.req.reference, "箱子与这个角色无关").toBeUndefined();
  });

  it("母版位图被拷进包里（`authoring/masters/`），并把规范化的相对路径写进清单的出处", async () => {
    const r = recorder();
    const { packDir, manifest } = await build({ generateImage: r.gen, characterDna: DNA });
    expect(existsSync(path.join(packDir, "authoring/masters/player-master.png"))).toBe(true);
    const anim = manifest.assets.find((a) => a.id === "player-odin")!;
    // ⚠️ `masterAsset` **不进交付清单**（母版是创作态）—— 清单里说的是那一张**位图**
    expect(JSON.stringify(anim)).not.toContain("player-master");
  });
});

describe("§母版前段：`image` 的母版（⭐ DNA → 母版那条箭头）", () => {
  const asImage = (): AuthoringAsset => ({ ...structuredClone(MASTER_IMPORT), source: { kind: "image", background: { tolerance: 30 } } });

  it("一次调用 · canonical 画布 · 提示词是 DNA 的八个字段（不是资产那句 description）", async () => {
    const r = recorder();
    const { packDir } = await build({ recipe: recipe({ master: asImage() }), generateImage: r.gen, characterDna: DNA });
    expect(r.of("master")).toHaveLength(1);
    const req = r.of("master")[0]!.req;
    expect(req.size).toEqual({ w: 832, h: 1248 });            // canonical（Q2）
    for (const k of Object.keys(CharacterDNASchema.shape)) expect(req.prompt).toContain(`\`${k}\``);
    expect(req.prompt).toContain(DNA.characters[0]!.identity);
    expect(req.negativePrompt).not.toContain("human figure");
    expect(existsSync(path.join(packDir, "authoring/masters/player-master.png"))).toBe(true);
    expect(existsSync(path.join(packDir, "authoring/masters/player-master.prompt.txt"))).toBe(true);
  });

  it("账：`step:\"master\"` · `target` 是**母版 id**（不是引用它的资产 id）", async () => {
    const r = recorder();
    const ledger: never[] = [];
    await build({ recipe: recipe({ master: asImage() }), generateImage: r.gen, characterDna: DNA, ledger: ledger as never });
    const master = (ledger as unknown as { step: string; target: string }[]).find((c) => c.step === "master")!;
    expect(master.target).toBe("player-master");
  });

  it("⚠️ 回来的图**比例**与 canonical 对不上 ⇒ 硬失败（它是参考图，比例错了整条动画链一起错）", async () => {
    const r = recorder({ masterImage: () => image(1024, 1024, STYLE.palette[1]!) });
    const e = await failed({ recipe: recipe({ master: asImage() }), generateImage: r.gen, characterDna: DNA });
    expect(e).toBeInstanceOf(Error);
    expect(e.message).toContain("宽高比不一致");
    expect(r.of("anim"), "比例错的母版 ⇒ 引用它的资产不许上路").toHaveLength(0);
  });
});

describe("§失败传播（Q5：只阻断引用它的资产，而整包仍失败）", () => {
  it("母版挂了 ⇒ 引用它的资产**一次都没调**、不引用的箱子**照造**、整包仍然抛", async () => {
    const r = recorder({ failMaster: true });
    const e = await failed({ recipe: recipe({ master: { ...structuredClone(MASTER_IMPORT), source: { kind: "image" } } }), generateImage: r.gen, characterDna: DNA });
    expect(e).toBeInstanceOf(Error);
    expect(e.message).toContain("player-master");
    expect(r.of("anim"), "参考图不成立时发出去的那一笔是白花的钱").toHaveLength(0);
    expect(r.of("crate"), "与母版无关的资产照造").toHaveLength(1);
  });
});

describe("§免费拦停：全在**第一笔钱之前**", () => {
  it("⚠️ `drawlist` 的母版**没实现** ⇒ 一句说得清的话（不静默退回另一种画法）", async () => {
    const r = recorder();
    const e = await failed({ recipe: recipe({ master: { ...structuredClone(MASTER_IMPORT), source: { kind: "drawlist" } } }), generateImage: r.gen, characterDna: DNA });
    expect(e.message).toContain("没有实现");
    expect(r.calls, "拒在**任何一笔**之前").toHaveLength(0);
  });

  it("`image` 的母版但没给 `generateImage` ⇒ 调用方的 bug，不静默跳过", async () => {
    const e = await failed({ recipe: recipe({ master: { ...structuredClone(MASTER_IMPORT), source: { kind: "image" } } }) });
    expect(e.message).toContain("没给 generateImage");
  });

  it("⚠️ `image` 的母版**要 DNA**：没给文件 ⇒ 拒（母版是基因的一张渲染图）", async () => {
    const r = recorder();
    const e = await failed({ recipe: recipe({ master: { ...structuredClone(MASTER_IMPORT), source: { kind: "image" } } }), generateImage: r.gen });
    expect(e.message).toContain("没给 character-dna");
    expect(r.calls).toHaveLength(0);
  });

  it("⚠️ 给了文件却**缺那个角色** ⇒ 拒（文书自相矛盾，不是「没有基因」那种回落）", async () => {
    const r = recorder();
    const other: CharacterDNAFile = { ...DNA, characters: [{ ...DNA.characters[0]!, id: "nobody" }] };
    const e = await failed({ recipe: recipe({ master: { ...structuredClone(MASTER_IMPORT), source: { kind: "image" } } }), generateImage: r.gen, characterDna: other });
    expect(e.message).toContain("没有对家");
  });
});

describe("§资产的 DNA：有就**替换**身份那一句，没有就回落（Q3）", () => {
  const dnaOf = (which: "master" | "anim" | "crate") => (r: ReturnType<typeof recorder>) => r.of(which)[0]!.req.prompt;

  it("给了 DNA ⇒ 动画那一发是**八个字段**，而 `spec.description` 那一句**不在**里面（替换，不是叠加）", async () => {
    const r = recorder();
    await build({ generateImage: r.gen, characterDna: DNA });
    const p = dnaOf("anim")(r);
    for (const k of Object.keys(CharacterDNASchema.shape)) expect(p).toContain(`\`${k}\``);
    expect(p).not.toContain(ANIM.spec.description);
    expect(p).toContain(DNA.characters[0]!.identity);
  });

  it("**没有** DNA 文件 ⇒ 一字不改地回落（磁盘上那 8 份 fixture 与「人给一张图」那条老路）", async () => {
    const r = recorder();
    await build({ generateImage: r.gen });
    expect(dnaOf("anim")(r)).toContain(ANIM.spec.description);
  });

  it("与角色无关的资产（`characterId` 没写）⇒ 落回它自己的 description", async () => {
    const r = recorder();
    await build({ generateImage: r.gen, characterDna: DNA });
    expect(dnaOf("crate")(r)).toContain(CRATE_DESC);
  });
});
