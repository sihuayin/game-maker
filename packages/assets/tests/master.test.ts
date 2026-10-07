// 票 13 的**纯**那一半：母版那一发怎么问、画布规则、两条免费判据。
//
// ⚠️ 这一份里最要紧的两条：
//   ① **DNA 的八个字段一个都不许漏**（人类在这一轮把「七个」改成了「八个」）；
//   ② **母版的反向提示词不能复用 `imageNegativePrompt()`** —— 那一份里有 `"character"`，
//      而母版画的正是一个角色（拿它去配母版 = 一半在说「画这个人」、一半在说「不要人」）。
import { describe, expect, it } from "vitest";
import type { CharacterDNA, CharacterDNAFile, StyleSpec } from "@game-maker/contracts";
import { imageNegativePrompt } from "../src/prompt.js";
import { masterNegativePrompt, masterPrompt, masterRatioMismatch, referenceImagesOf, MASTER_SOURCES } from "../src/master.js";

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

describe("§比例判据（Q2：回来的图必须与 canonical 画布同比例）", () => {
  it("同比例（尺寸不同也算，只比比例）⇒ 过", () => {
    expect(masterRatioMismatch({ w: 64, h: 96 }, { width: 832, height: 1248 })).toBeNull();
  });

  it("不同比例 ⇒ 说得出两个比例", () => {
    const msg = masterRatioMismatch({ w: 64, h: 96 }, { width: 1024, height: 1024 });
    expect(msg).toContain("宽高比不一致");
    expect(msg).toContain("1024×1024");
    expect(msg).toContain("64×96");
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
