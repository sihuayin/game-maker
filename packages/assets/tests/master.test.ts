// 票 13 的**纯**那一半：母版那一发怎么问、画布规则、两条免费判据。
//
// ⚠️ 这一份里最要紧的两条：
//   ① **DNA 的八个字段一个都不许漏**（人类在这一轮把「七个」改成了「八个」）；
//   ② **母版的反向提示词不能复用 `imageNegativePrompt()`** —— 那一份里有 `"character"`，
//      而母版画的正是一个角色（拿它去配母版 = 一半在说「画这个人」、一半在说「不要人」）。
import { describe, expect, it } from "vitest";
import type { CharacterDNA, CharacterDNAFile, StyleSpec } from "@game-maker/contracts";
import { imageNegativePrompt } from "../src/prompt.js";
import { masterNegativePrompt, masterPrompt, masterRatioLine, masterRatioNotes, masterRatioReading, referenceImagesOf, MASTER_SOURCES } from "../src/master.js";

const STYLE: StyleSpec = {
  id: "halt-dusk", identity: ["低饱和、硬边"], camera: {}, composition: {},
  palette: ["#2e3b4e", "#4a6076", "#c9b18a", "#8c3b2e"],
  lighting: {}, shapeLanguage: ["方形、硬边"], material: ["锈蚀金属"], environment: [],
  characterStyle: [], constraints: ["严禁抗锯齿与柔边"], confidence: 0.5
};

const DNA: CharacterDNA = {
  id: "p-scavenger",
  identity: "沙暴废城里最后一个还在翻垃圾的人",
  silhouette: "比同类窄一号，左肩塌下去",
  face: "两个像素眼窝，没有五官",
  clothing: "深蓝长大衣，下摆撕掉一半",
  gear: ["半截撬棍", "背上的方盒包"],
  palette: ["palette:1", "palette:3"],
  visualConstraints: ["帽檐必须在眼线上方投出一条深色横带"]
};

const MASTER = { id: "player-master", role: "玩家角色母版", description: "一张全身参考图" };
const prompt = (over: { dna?: CharacterDNA; canvas?: { w: number; h: number } } = {}) =>
  masterPrompt({ master: MASTER, dna: over.dna ?? DNA, style: STYLE, canvas: over.canvas ?? { w: 832, h: 1248 } });

describe("§母版的提示词：DNA 的**八个字段**逐个具名", () => {
  it("⚠️ **八个，不是七个** —— `id` 也在台账里（人类这一轮把这一条收紧了）", () => {
    const p = prompt();
    const keys = Object.keys(DNA) as (keyof CharacterDNA)[];
    expect(keys).toHaveLength(8);
    expect(keys.filter((k) => !p.includes(`\`${k}\``))).toEqual([]);
  });

  it("⚠️ `id` **要给出来，但明写不许画进图里**（模型会照着字面把文字画上去）", () => {
    const p = prompt();
    expect(p).toContain("`p-scavenger`");
    expect(p).toContain("不要把它画进图里");
  });

  it("⚠️ `palette:N` **翻译成色值** —— 模型不认 `palette:1` 这个说法，它认颜色", () => {
    const p = prompt();
    expect(p).toContain("#4a6076");     // palette:1
    expect(p).toContain("#8c3b2e");     // palette:3
    expect(p).not.toContain("palette:1");   // 引用本身不该出现在「它身上的颜色」那一行
  });

  it("`\"none\"` 是**写下来的不存在**，要翻成人话（别原样丢给模型）", () => {
    const drone = { ...DNA, face: "none", clothing: "none", gear: [] } as CharacterDNA;
    const p = prompt({ dna: drone });
    expect(p).toContain("**没有**");
    expect(p).toContain("别画它");
    expect(p).toContain("清单是空的");
  });

  it("canonical 画布的比例进了提示词（Q2：尺寸是 canonical、上游尺寸是派生值）", () => {
    expect(prompt()).toContain("832 : 1248");
    expect(prompt()).toContain("832×1248 像素");
  });

  it("⚠️ 不再说「外接矩形比例必须精确」「两方向独立缩放就是硬拉伸」（票 11）", () => {
    const p = prompt();
    expect(p).not.toContain("外接矩形");
    expect(p).not.toContain("两方向独立缩放");
    expect(p).not.toContain("硬拉伸");
    expect(p).toContain("画布是 832×1248 像素");
    expect(p).toContain("照这张图的头身比与形象");
  });

  it("人写的那两格（`role` / `description`）也进 —— 它们是**这一张图**的说法", () => {
    const p = prompt();
    expect(p).toContain(MASTER.role);
    expect(p).toContain(MASTER.description);
  });
});

describe("§母版的反向提示词：**不能**复用单物体那一份", () => {
  it("⚠️ `imageNegativePrompt()` 里有 `character` / `human figure` —— 那是给箱子定的", () => {
    expect(imageNegativePrompt()).toContain("character");
    expect(imageNegativePrompt()).toContain("human figure");
  });

  it("母版那一份**没有**它们，而**有**「不许画成一排三视图」（那是模型最容易犯的错）", () => {
    const neg = masterNegativePrompt();
    // ⚠️ 逐**项**比，不是逐子串：母版那一份**故意**带着 `character sheet`（那正是要禁的：
    //   模型见到「角色参考图」很容易画成一排三视图），而它**不许**带上那三条**裸**的词。
    const items = neg.split(", ");
    expect(items).not.toContain("human figure");
    expect(items).not.toContain("character");
    expect(items).not.toContain("hands");
    expect(neg).toContain("character sheet");
    expect(neg).toContain("three views");
    expect(neg).toContain("text");
  });
});

describe("§比例读数（票 39：它从**判据**降成**观察**）", () => {
  const line = (c: { w: number; h: number }, i: { width: number; height: number }, id = "m") =>
    masterRatioLine({ master: id, ...masterRatioReading(c, i) });

  it("同比例（尺寸不同也算，只比比例）⇒ `match: true`", () => {
    const r = masterRatioReading({ w: 64, h: 96 }, { width: 832, height: 1248 });
    expect(r.match).toBe(true);
    expect(r.ratioDelta).toBe(0);
  });

  it("不同比例 ⇒ 说得出两个读数、差多少、以及**往哪边差**", () => {
    const l = line({ w: 64, h: 96 }, { width: 1024, height: 1024 });
    expect(l).toContain("1024×1024");
    expect(l).toContain("64×96");
    expect(l).toContain("1.000");            // 回来的比例
    expect(l).toContain("0.667");            // canonical 的比例
    expect(l).toContain("50.0%");
    expect(l).toContain("回来的更宽");
  });

  it("⚠️ 判「一致」是**零容差整数判定**，不是浮点比较 —— 差一个像素就是不一致（票 39 的 Q3）", () => {
    expect(masterRatioReading({ w: 64, h: 96 }, { width: 833, height: 1248 }).match).toBe(false);
    expect(masterRatioReading({ w: 64, h: 96 }, { width: 832, height: 1248 }).match).toBe(true);
  });

  it("⚠️ 第六跑那一发（请求 32×24 · 回来 1184×864）⇒ 差 2.8%（读数要对得上现场）", () => {
    const l = line({ w: 32, h: 24 }, { width: 1184, height: 864 }, "master-rubble-hound");
    expect(l).toContain("1184×864");
    expect(l).toContain("2.8%");
  });

  it("⚠️ C2 现场（请求 48×64 · 回来 858×1178）⇒ 差 2.9%（读数要对得上现场）", () => {
    const r = masterRatioReading({ w: 48, h: 64 }, { width: 858, height: 1178 });
    expect(r.match).toBe(false);
    expect(r.ratioDelta * 100).toBeCloseTo(-2.886, 2);
    const l = line({ w: 48, h: 64 }, { width: 858, height: 1178 }, "master-probe-player");
    expect(l).toContain("858×1178");
    expect(l).toContain("2.9%");
  });

  it("⚠️ 10% 漂移（请求 48×64 · 回来 66×80）⇒ `match:false`、差 10.0%，仍然是观察", () => {
    const r = masterRatioReading({ w: 48, h: 64 }, { width: 66, height: 80 });
    expect(r.match).toBe(false);
    expect(r.ratioDelta).toBeCloseTo(0.1, 10);
    expect(line({ w: 48, h: 64 }, { width: 66, height: 80 })).toContain("10.0%");
  });

  it("⚠️ 文案里**没有**那两条出路（票 39 的 Q2）—— 它只陈述读数，不指路", () => {
    const l = line({ w: 64, h: 96 }, { width: 1024, height: 1024 });
    expect(l).not.toContain("重出");
    expect(l).not.toContain("authoring[].size");
  });

  it("⚠️ 报给人看的那几行**先报小计**（票 39 的 Q5）—— 「全对」与「压根没量」要分得开", () => {
    const good = { master: "a", ...masterRatioReading({ w: 64, h: 96 }, { width: 832, height: 1248 }) };
    const bad = { master: "b", ...masterRatioReading({ w: 64, h: 96 }, { width: 1024, height: 1024 }) };
    expect(masterRatioNotes([])).toEqual([]);
    // 一张都没有 vs 有一张全对 —— 都不能长得像「什么都不说」
    expect(masterRatioNotes([good]).join()).toMatch(/1 张都量过.*全部一致/);
    const mixed = masterRatioNotes([good, bad]).join("\n");
    expect(mixed).toMatch(/一致 1 张 · \*\*不一致 1 张\*\*/);
    expect(mixed).toContain("b");            // 只逐条列**不一致**的
    expect(mixed).not.toContain("母版 \"a\"");
  });
});

describe("§`referenceImagesOf`：这份配方会递出去哪些**图**（Q6 的免费拦停）", () => {
  const base = { assets: [{ spec: { id: "a" }, source: { kind: "drawlist" as const } }] };

  it("⚠️ **`styleRef` 不是图，永远不触发**（人类这一轮专门点了这一条）", () => {
    expect(referenceImagesOf({ ...base, styleRef: "stylespec.json" } as never)).toEqual([]);
  });

  it("三样都算：世界风格图 · `source.reference` · `masterAsset`", () => {
    expect(referenceImagesOf({ ...base, referenceImage: "../reference/test.png" } as never))
      .toEqual([expect.stringContaining("referenceImage")]);
    expect(referenceImagesOf({ assets: [{ spec: { id: "a" }, source: { kind: "image", reference: "m.png" } }] } as never))
      .toEqual([expect.stringContaining("source.reference")]);
    expect(referenceImagesOf({ assets: [{ spec: { id: "a", masterAsset: "player-master" }, source: { kind: "image" } }] } as never))
      .toEqual([expect.stringContaining("player-master")]);
  });

  it("母版今天**实现了**两条（`image` / `import`），`drawlist` 不在里面", () => {
    expect([...MASTER_SOURCES]).toEqual(["image", "import"]);
  });
});

/** 只是让 `CharacterDNAFile` 的类型在这里也被用到（落盘形状与契约对齐）。 */
export const DNA_FILE: CharacterDNAFile = { format: "character-dna/v1", characters: [DNA] };
