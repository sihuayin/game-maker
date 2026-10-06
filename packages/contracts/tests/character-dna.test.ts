// 票 04 给 `CharacterDNA` 立的判据。
//
//   每条断言背后都有一个**被裁决过**的字段，不是顺手加的覆盖率。最要紧的三条：
//     §全必填、没有 optional —— R13 的「重生成一字不变」全靠它；
//       一个可选字段会让「这个角色确实没有脸」与「模型忘了填」在文件里长得一模一样。
//     §palette 是 PaletteRef —— 自由 hex 会**静默失效**（下游 quantize 把它量化掉）。
//     §bodyProportions 被拒 —— 它是**可派生的副本**（headCount(size.h)），不是零消费者。
import { describe, expect, it } from "vitest";
import { CHARACTER_DNA_FORMAT, CharacterDNAFileSchema, toolInputSchema } from "../src/index.js";

/** 一个**人形**角色：他**有**脸、**有**衣服、**有**装备。 */
const ODIN = {
  id: "player",
  identity: "中年店主 Odin Haraldsson，革命后仍守着自家杂货店",
  silhouette: "矮壮、方头、硬边，宽肩窄腿",
  face: "只用两个像素眼窝，没有五官细节",
  clothing: "绿毛线帽、灰绿旧夹克，袖口磨白",
  gear: ["胸口的 CRT 显示屏（改装过，会发光）", "挂在腰间的旧钥匙串"],
  palette: ["palette:0", "palette:3"],
  visualConstraints: ["描边比世界默认粗一像素"]
};

/** 一台**无人机**：它**没有**脸、**没有**衣服、**没有**装备。
 *  ⚠️ 这个 fixture 是 Q2 那一条的活证据 —— 不存在也必须**被写出来**。 */
const DRONE = {
  id: "e-drone",
  identity: "沿固定路线巡逻的旧警用无人机",
  silhouette: "扁平梭形，四角旋翼，无人体结构",
  face: "none",
  clothing: "none",
  gear: [],
  palette: ["palette:2"],
  visualConstraints: []
};

const file = (characters: unknown[]) => ({ format: CHARACTER_DNA_FORMAT, characters });
const parse = (characters: unknown[]) => CharacterDNAFileSchema.safeParse(file(characters));

describe("§判别式与文件形状（票 04 Q2）", () => {
  it("`format` 必填且是 literal；**不是裸数组** —— 裸数组没地方放它", () => {
    expect(parse([ODIN, DRONE]).success).toBe(true);
    expect(CharacterDNAFileSchema.safeParse([ODIN]).success).toBe(false); // 裸数组当场不过
    expect(CharacterDNAFileSchema.safeParse({ format: "1.0", characters: [] }).success).toBe(false);
    expect(CharacterDNAFileSchema.safeParse({ format: "visual-world/v1", characters: [] }).success).toBe(false);
  });

  it("每条记录**不带** `format`（一族一次就够）—— 带了会被封口拒掉", () => {
    expect(parse([{ ...ODIN, format: CHARACTER_DNA_FORMAT }]).success).toBe(false);
  });

  it("单文件装**全部**角色，并按 id 去重", () => {
    expect(parse([ODIN, DRONE]).success).toBe(true);
    const dup = parse([ODIN, { ...DRONE, id: "player" }]);
    expect(dup.success).toBe(false);
    if (!dup.success) expect(dup.error.issues[0]!.message).toContain("id 重复");
  });
});

describe("§全必填，一个 optional 都没有（票 04 Q2）", () => {
  it.each(Object.keys(ODIN))("缺 `%s` 就不过", (k) => {
    const { [k]: _drop, ...rest } = ODIN as Record<string, unknown>;
    expect(parse([rest]).success, `缺 ${k} 应当不过`).toBe(false);
  });

  it("**空串也不行** —— 「不允许省略」必须真的兑现，否则空串会变成第二个隐形缺省", () => {
    for (const k of ["identity", "silhouette", "face", "clothing"])
      expect(parse([{ ...ODIN, [k]: "" }]).success, `${k} 空串`).toBe(false);
  });
});

describe("§非人形：不存在必须**被说出来**（票 04 Q2）", () => {
  it("`face` / `clothing` 写 `\"none\"`、`gear` 写 `[]` ⇒ 通过", () => {
    expect(parse([DRONE]).success).toBe(true);
  });

  it("而**省掉**它们 ⇒ 不通过", () => {
    for (const k of ["face", "clothing", "gear"]) {
      const { [k]: _drop, ...rest } = DRONE as Record<string, unknown>;
      expect(parse([rest]).success, `省掉 ${k} 应当不过`).toBe(false);
    }
  });
});

describe("§palette 是 PaletteRef，不是颜色（票 04 Q4）", () => {
  it("只收 `palette:<下标>` —— 硬编码 hex 过不了（票 02 裁决 25 的同一刀）", () => {
    expect(parse([{ ...ODIN, palette: ["#a1b2c3"] }]).success).toBe(false);
    expect(parse([{ ...ODIN, palette: ["red"] }]).success).toBe(false);
    expect(parse([{ ...ODIN, palette: ["palette:0"] }]).success).toBe(true);
    expect(parse([{ ...ODIN, palette: [] }]).success).toBe(true);
  });
});

describe("§砍掉的字段真的进不来", () => {
  it("`bodyProportions` 被拒 —— 它是 `headCount(size.h)` 的可派生副本，不是零消费者", () => {
    expect(parse([{ ...ODIN, bodyProportions: "约 4 头身" }]).success).toBe(false);
  });

  it("`equipment` / `accessories` 被拒 —— 已合并为 `gear`（假边界，两者的消费者是同一段提示词）", () => {
    expect(parse([{ ...ODIN, equipment: ["钥匙串"] }]).success).toBe(false);
    expect(parse([{ ...ODIN, accessories: ["钥匙串"] }]).success).toBe(false);
  });
});

describe("§工具协议（R16 新）", () => {
  it("能转成 tool 的 input_schema，且封口", () => {
    const js = toolInputSchema(CharacterDNAFileSchema) as Record<string, unknown>;
    expect(js["additionalProperties"]).toBe(false);
    expect(js["required"]).toContain("characters");
  });
});

// ── 票 31 补上的那条顶层 gate：**空串不是「没有」**（`01-contracts.md` §7 早就写下、契约里没人兑现）──
//
//   ⚠️ 「必填」只挡得住**缺席** —— `.min(1)` 挡不住 `"   "`，`z.array(z.string())` 挡不住 `[""]`。
//   而这条判决是票 09 / 票 10 各立过一遍的**同一条 gate**（那两条在同名的 `*-gate.test.ts` 里）。
describe("§空值 gate：空串不许当第二个隐形缺省（票 31 的 Q4）", () => {
  it("⚠️ **trim 之后为空也算空** —— `.min(1)` 挡不住 `\"   \"`，gate 挡得住", () => {
    for (const k of ["identity", "silhouette", "face", "clothing"])
      expect(parse([{ ...ODIN, [k]: "   " }]).success, `${k} 三个空格`).toBe(false);
    expect(parse([{ ...ODIN, id: " " }]).success).toBe(false);
  });

  it("数组的**元素**不许是空串 —— 空串不是「没有这一条」，是占位符", () => {
    for (const k of ["gear", "visualConstraints"])
      expect(parse([{ ...ODIN, [k]: ["撬棍", "  "] }]).success, `${k} 里混了空串`).toBe(false);
  });

  it("⚠️ 但 **`\"none\"` 是合法值** —— gate 只查「空」、不查「是不是 none」", () => {
    // 票 04 Q2 的原话：非人形写 "none"。那是**写下来的不存在**，不是敷衍 ——
    // 判据只收「精确可算 + 错了一定不是设计」，而「这句话算不算敷衍」不是它判得了的。
    expect(parse([DRONE]).success).toBe(true);
    expect(parse([{ ...ODIN, silhouette: "none" }]).success).toBe(true);
  });

  it("三个数组**本身可空** —— 无人机没有装备、没有配色偏好（`[]` 就是一种「说出来」）", () => {
    expect(parse([{ ...ODIN, gear: [], visualConstraints: [], palette: [] }]).success).toBe(true);
  });

  it("⚠️ 它同时管**从磁盘上读回来的**文件：报错说得出口是第几个角色的哪一格", () => {
    const bad = parse([ODIN, { ...DRONE, identity: " " }]);
    expect(bad.success).toBe(false);
    if (!bad.success) {
      expect(bad.error.issues[0]!.path).toEqual(["characters", 1, "identity"]);
      expect(bad.error.issues[0]!.message).toContain("none");   // 提示「没有也要写出来」
    }
  });
});
