// 角色基因那一步的**问话面** —— 三条**结构性**判据住在这里：
//   ① 八个键**逐个点名**（① 档欠条：没在模板里露脸的字段当场出局）；
//   ② 「**类**」与「**个体**」两个输入都**按值**插进去了（不是只提了个名字）；
//   ③ 那条**守门人**的语义说法（类 vs 个体）真的在提示词与工具说明里。
import { describe, expect, it } from "vitest";
import { CharacterDNASchema } from "@game-maker/contracts";
import {
  CHARACTER_DNA_TOOL_DESCRIPTION, CHARACTER_DNA_TOOL_NAME, characterDnaPrompt,
} from "../src/index.js";
import { DESIGN, VWS_CLASS } from "./fixtures.js";

const KEYS = Object.keys(CharacterDNASchema.shape);
const prompt = (over: Partial<Parameters<typeof characterDnaPrompt>[0]> = {}) =>
  characterDnaPrompt({ design: DESIGN, vws: VWS_CLASS, ...over });

describe("提示词骨架", () => {
  it("⚠️ **契约的每一个键都在骨架里被点名**（① 档欠条要的「逐个点名」）", () => {
    const p = prompt();
    expect(KEYS.filter((k) => !p.includes(`\`${k}\``))).toEqual([]);
    const hints = p.split("# 逐字段")[1]!.split("\n\n#")[0]!;
    expect(hints.split("\n").filter((l) => l.startsWith("- `"))).toHaveLength(KEYS.length);
  });

  it("⚠️ 世界那**五格**逐个具名，且**真值**插进去了（票 04 那张硬约束的对照面）", () => {
    const p = prompt();
    for (const k of ["proportions", "silhouette", "poseLanguage", "clothing", "faceAbstraction"])
      expect(p).toContain(`\`character.${k}\``);
    expect(p).toContain(VWS_CLASS.character.proportions!);
    expect(p).toContain(VWS_CLASS.character.poseLanguage!);
  });

  it("⚠️ **六桶与 `materials` 真的被读了**（票 32 说它们零消费者 —— 那句话现在只对生图那一步成立）", () => {
    const p = prompt();
    expect(p).toContain("#2e3b4e");                 // 色板原值（`style.palette` 的有序数组）
    expect(p).toContain("0=#2e3b4e");
    for (const bucket of ["primary", "secondary", "accent", "background", "shadow", "highlight"])
      expect(p).toContain(bucket);
    expect(p).toContain("锈蚀的金属");               // materials[].appearance 的原话
  });

  it("⚠️ 个体那一半：设计层每条实体的**行为字段**与 **id** 都在（id 沿用的兑现方式）", () => {
    const p = prompt();
    expect(p).toContain(DESIGN.player.role);
    expect(p).toContain(DESIGN.player.goals[0]!);
    expect(p).toContain(DESIGN.enemies[0]!.threat);
    expect(p).toContain(DESIGN.npcs[0]!.interaction);
    for (const id of ["p-scavenger", "e-drone", "e-mutant", "n-merchant"]) expect(p).toContain(id);
    expect(p).toContain(DESIGN.world.setting);
  });

  it("⚠️ **没有基因的那些也要被点名**（免得模型顺手给木条箱写一份）", () => {
    const p = prompt();
    expect(p).toContain("i-terminal");
    expect(p).toContain("r-scrap");
    expect(p).toContain("没有基因");
  });

  it("⚠️ 「类 vs 个体」那条**语义**说法必须在（守门人挡不住语义，提示词才挡得住）", () => {
    const p = prompt();
    expect(p).toContain("这一类共有");
    expect(p).toContain("不许");
    expect(p).toContain("落到这一个身上");
  });

  it("非人形那段：`\"none\"` 与「不许省」都写清了（Q4 要兑现的那条）", () => {
    const p = prompt();
    expect(p).toContain('`face` 写 `"none"`');
    expect(p).toContain('`gear` 写 `[]`');
    expect(p).toContain("省掉一个键与「确实没有」在文件里长得一模一样");
  });

  it("颜色是从世界色板里**选** —— 明说只能写 `palette:<下标>`", () => {
    expect(prompt()).toContain("`palette:<下标>`");
  });
});

describe("工具说明：schema 说不清的那五条", () => {
  it("里面写全了「不许空串」「恰好一条」「世界那五格不许整句抄」「palette 是引用」「叠加不是替代」", () => {
    for (const s of ["不许拿空串占位", "恰好一条", "不许整句抄进某个角色的 DNA", "palette:<下标>", "叠加"])
      expect(CHARACTER_DNA_TOOL_DESCRIPTION).toContain(s);
  });

  it("⚠️ 守门人那条说的是**语义规矩**，不是「我们查得出来」（说成天网只会教会模型绕）", () => {
    expect(CHARACTER_DNA_TOOL_DESCRIPTION).toContain("把共有的画法**落到这一个身上**");
    expect(CHARACTER_DNA_TOOL_DESCRIPTION).not.toContain("逐字");
  });

  it("工具名只此一份，且提示词收在它上面", () => {
    expect(CHARACTER_DNA_TOOL_NAME).toBe("emit_character_dna");
    expect(prompt()).toContain(`只调 ${CHARACTER_DNA_TOOL_NAME} 工具`);
  });
});

// ── 票 68 · 「写 hex 会怎样」那半句，今天说反了（人裁 Q1(a) + Q4(a)）────────────────────
//
// ⚠️ 旧文案（两处**都**是它）：工具说明第 4 条**不提后果**，而字段台账写「写了下游会被量化掉，
//   **等于没写**」—— 那句把因果**接到了一个碰不到这个字段的模块上**（`quantize` 吃的是**位图**，
//   唯一调用点 `import.ts:383` 走的是导入那条路；`dna.palette` 到不了它眼前）。
//   真实后果是：那一格是**正则** ⇒ 过不了 `CharacterDNAFileSchema` ⇒ 整份判失败、退 4。
// ⚠️ **反向断言今天必红**（探针 ⑯）⇒ 它不能单独加 —— 花的代价就是把 Q1 与 Q4 绑成一次施工。
describe("⚠️ 票 68：`palette` 的后果**照实说**，而那句错因果不许再回来", () => {
  it("两处（工具说明 + 字段台账）都写清真实后果：整份判失败 · 退出码 4 · 下游换不回来", () => {
    for (const [face, s] of [
      ["工具说明", CHARACTER_DNA_TOOL_DESCRIPTION],
      ["字段台账", prompt()],
    ] as const) {
      expect(s, `${face}：说得出「整份判失败」`).toContain("判失败");
      expect(s, `${face}：说得出退出码`).toContain("退出码 4");
      expect(s, `${face}：说得出下游那个模块碰不到这一格`).toContain("碰不到这一格");
      expect(s, `${face}：规矩那半句照旧（本票不动它）`).toContain("palette:<下标>");
    }
  });

  it("⚠️ **反向**：旧的「会被量化掉 / 等于没写」一个字都不许留 —— 那是把后果接到了错的模块上", () => {
    for (const s of [CHARACTER_DNA_TOOL_DESCRIPTION, prompt()]) {
      expect(s).not.toContain("等于没写");
      expect(s, "「量化掉」只许出现在**否定**它的句子里").not.toMatch(/会被量化掉/);
    }
  });
});

// ── 票 69 · `palette:N` 的**下标范围**也要写出来（人裁 Q3(a)：两处都补，与票 68 同一格）──────
//
// ⚠️ 正则是只管**形状**的（`palette:<下标>`）：`palette:9` 在一份 2 色世界里**形状完全合法**，
//   契约那一层收得下 —— 拦住它的是装配步那只**跨文书**的引用判据（`paletteRefBounds`）。
//   ⇒ 模型得**先知道**范围，才谈得上不去撞它；而「范围」这件事**只有散文说得出**（schema 说不出）。
describe("⚠️ 票 69：下标范围（从 0 起 · 严格小于色板长度）两处都要写，且色板在提示词里**数得出来**", () => {
  it("工具说明与字段台账**都**写着「从 0 起」与「严格小于色板长度」", () => {
    for (const [face, s] of [
      ["工具说明", CHARACTER_DNA_TOOL_DESCRIPTION],
      ["字段台账", prompt()],
    ] as const) {
      expect(s, `${face}：从 0 起`).toContain("从 0 起");
      expect(s, `${face}：严格小于色板长度`).toContain("严格小于色板长度");
    }
  });

  it("⚠️ 而**色板本身在提示词里是逐项摊开的** —— 不然「小于色板长度」这句话无从计算", () => {
    const p = prompt();
    // ⚠️ 这两项就是 `VWS.style.palette` 的两项（探针 ⑮：这一行是模型唯一看得见色板长度的地方）
    expect(p).toContain("0=#2e3b4e");
    expect(p).toContain("1=#4a6076");
    // ⚠️ 与 VWS 那条**同一条色板**（读了同一个字段 ⇒ 两处不可能漂）
    for (const [i, hex] of VWS_CLASS.style.palette.entries()) expect(p).toContain(`${i}=${hex}`);
  });

  it("⚠️ 两处**不许打架**：都既说「不许写 hex」又说「下标有范围」（票 68 与票 69 落在同一格）", () => {
    for (const s of [CHARACTER_DNA_TOOL_DESCRIPTION, prompt()]) {
      expect(s).toContain("不许");
      expect(s).toContain("palette:<下标>");
      expect(s, "票 69 那半句在").toContain("严格小于色板长度");
      expect(s, "票 68 那半句也在").toContain("退出码 4");
    }
  });
});
