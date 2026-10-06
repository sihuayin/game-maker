// 票 31 装配步的判据：**一条构造性 gate + 一个守门人**（两条都算 `schema` ⇒ 重采样）。
//
// ⚠️ 这份文件里最要紧的不是「happy path」，是**两条检查的称谓分得清不清**：
//   · 集合相等是**构造性 gate**（这一票的核心，票 31 Q3 的人类收紧）；
//   · 逐字那条只是**守门人、必要不充分**（Q1 的人类收紧）——
//     ⇒ 它**换一个标点就绕过**，而那件事在这里有一条**测试**钉着（不是一句注释）。
import { describe, expect, it } from "vitest";
import {
  CHARACTER_SET_GATE, COPY_GUARD, buildCharacterDna, characterEntities, verbatimCopyGuard,
} from "../src/index.js";
import { DESIGN, VWS, VWS_CLASS, dnaFile, dnaRecord } from "./fixtures.js";

const build = (over: Partial<Parameters<typeof buildCharacterDna>[0]> = {}) =>
  buildCharacterDna({ fromModel: dnaFile(), design: DESIGN, vws: VWS, ...over });

const detail = (o: ReturnType<typeof build>): string => (o.ok ? "" : o.detail);

describe("§成果：`format` 由装配补、记录原样交出去", () => {
  it("默认那一族**恰好**覆盖设计层的四个角色 ⇒ 过，且 `format` 是字面量", () => {
    const r = build();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.file.format).toBe("character-dna/v1");
      expect(r.file.characters.map((c) => c.id)).toEqual(["p-scavenger", "e-drone", "e-mutant", "n-merchant"]);
    }
  });

  it("⚠️ **一个注入都没有** —— 与票 10 的三个照抄值相反：这里七格全是模型的（`id` 是**核**出来的，不是覆盖的）", () => {
    const r = build({ fromModel: dnaFile([...dnaFile().characters].map((c) => ({ ...c, identity: "模型自己写的这一句" }))) });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.file.characters[0]!.identity).toBe("模型自己写的这一句");
  });
});

describe("§核心构造性 gate：每个角色实体**恰好**一条（票 31 的 Q3）", () => {
  it("`player` + `enemies[]` + `npcs[]` 就是那一族 —— `interactables` / `resources` **不在**", () => {
    expect(characterEntities(DESIGN).map((e) => e.id))
      .toEqual(["p-scavenger", "e-drone", "e-mutant", "n-merchant"]);
    expect(characterEntities(DESIGN).map((e) => e.where))
      .toEqual(["player", "enemies[0]", "enemies[1]", "npcs[0]"]);
  });

  it("**少一条** ⇒ 报「做丢了」，且说得出是设计层哪一格", () => {
    const r = build({ fromModel: dnaFile(dnaFile().characters.filter((c) => c.id !== "n-merchant")) });
    expect(r.ok).toBe(false);
    expect(detail(r)).toContain(CHARACTER_SET_GATE);
    expect(detail(r)).toContain("npcs[0]");
    expect(detail(r)).toContain("没有 DNA");
  });

  it("**多一条** ⇒ 报「没有对家」，并把「哪些东西没有基因」这条规矩说出来", () => {
    const r = build({ fromModel: dnaFile([...dnaFile().characters, dnaRecord("i-terminal")]) });
    expect(r.ok).toBe(false);
    expect(detail(r)).toContain("没有对家");
    expect(detail(r)).toContain("没有基因");
  });

  it("**改一个 id**（`e-drone` → `e-drone-2`）⇒ 两头都报（少的那头 + 多的那头），因为它们不是同一种错", () => {
    const r = build({
      fromModel: dnaFile(dnaFile().characters.map((c) => (c.id === "e-drone" ? { ...c, id: "e-drone-2" } : c)))
    });
    expect(r.ok).toBe(false);
    const d = detail(r);
    expect(d).toContain("`e-drone`");
    expect(d).toContain("没有 DNA");
    expect(d).toContain("`e-drone-2`");
    expect(d).toContain("没有对家");
  });

  it("⚠️ 两条检查**都在 `schema` 那一档**（Q5 的裁定：两条都阻断，但称谓分明）", () => {
    const missing = build({ fromModel: dnaFile([]) });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.kind).toBe("schema");
  });
});

describe("§守门人：世界那五格不许被整句抄进某个角色（票 31 的 Q1）", () => {
  it("`silhouette` 逐字相同 ⇒ 响，且**自称守门人**", () => {
    const r = build({
      vws: VWS_CLASS,
      fromModel: dnaFile([dnaRecord("p-scavenger", { silhouette: VWS_CLASS.character.silhouette! }),
        ...dnaFile().characters.slice(1)])
    });
    expect(r.ok).toBe(false);
    expect(detail(r)).toContain(COPY_GUARD);
    expect(detail(r)).toContain("逐字相同");
    expect(detail(r)).toContain("守门人");
  });

  it("⚠️ 第三对**名字不同、语义对应**：`dna.face` ↔ `vws.character.faceAbstraction`", () => {
    const r = build({
      vws: VWS_CLASS,
      fromModel: dnaFile([dnaRecord("p-scavenger", { face: VWS_CLASS.character.faceAbstraction! }),
        ...dnaFile().characters.slice(1)])
    });
    expect(r.ok).toBe(false);
    expect(detail(r)).toContain("faceAbstraction");
  });

  it("⚠️ **它必要不充分 —— 换一个标点就绕过**（这条噪声**测试钉着**，不是只在注释里）", () => {
    const copied = VWS_CLASS.character.clothing!;
    const exact = build({ vws: VWS_CLASS, fromModel: dnaFile([dnaRecord("p-scavenger", { clothing: copied }), ...dnaFile().characters.slice(1)]) });
    const smudged = build({ vws: VWS_CLASS, fromModel: dnaFile([dnaRecord("p-scavenger", { clothing: `${copied}，袖口磨白` }), ...dnaFile().characters.slice(1)]) });
    expect(exact.ok).toBe(false);
    expect(smudged.ok).toBe(true);          // ← 逐字比较绕得过去：所以它挡的只是最赤裸那种复制
  });

  it("世界那**一格缺席** ⇒ 无可比、跳过（不是通过也不是失败）", () => {
    // `VWS` 的 `character` 是空的（那份 fixture 一个外观字段都没有）⇒ 三对全都没得比。
    expect(verbatimCopyGuard(dnaFile(), VWS)).toEqual([]);
  });

  it("世界那格**是空白串** ⇒ 同样跳过（空白不是「这一类共有的画法」）", () => {
    expect(verbatimCopyGuard(dnaFile(), { ...VWS_CLASS, character: { ...VWS_CLASS.character, clothing: "   " } })).toEqual([]);
  });

  it("⚠️ **只比整句，不比相似** —— 差一个字就不响（阈值 = 分数，R3 不让它进来）", () => {
    const p = dnaFile().characters;
    const close = build({ vws: VWS_CLASS, fromModel: dnaFile([{ ...p[0]!, silhouette: `${VWS_CLASS.character.silhouette!}。` }, ...p.slice(1)]) });
    expect(close.ok).toBe(true);
  });
});

describe("§装配步仍要**重过一遍契约**（顶层那条空值 gate 的落点）", () => {
  it("空串（trim 后为空）在装配时被拦下 —— 它的报错来自契约那一条，不是两条检查", () => {
    const r = build({ fromModel: dnaFile([dnaRecord("p-scavenger", { identity: "   " }), ...dnaFile().characters.slice(1)]) });
    expect(r.ok).toBe(false);
    expect(detail(r)).toContain("identity");
    expect(detail(r)).toContain("是空的");
    expect(detail(r)).not.toContain(COPY_GUARD);
  });

  it("⚠️ 为什么要在装配步再过一次：`superRefine` 只在**整份文件**这个形状上跑得起来", () => {
    // 模型那一份是 `parseToolUse` 里过的（一次），而这一层也吃**从磁盘读回来的**文件 ——
    // 手改过的 `character-dna.json` 在这里就该响（与 `game-design` 的装配步同一条理由）。
    const r = build({ fromModel: { format: "character-dna/v1", characters: [{ ...dnaRecord("p-scavenger"), gear: [""] }, ...dnaFile().characters.slice(1)] } as never });
    expect(r.ok).toBe(false);
    expect(detail(r)).toContain("空串");
  });
});
