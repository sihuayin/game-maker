// `character-dna/v1` —— **某一个角色是谁**（票 04，依据 R14）。
//
// ⚠️ **本文件是 V2 契约 ⇒ 用 `zod/v4`**（票 28 定的边界：旧契约 `zod`、V2 新契约 `zod/v4`，
//   两边**不许互相嵌套** —— `toolInputSchema` 只吃 v4，v3 的 `ZodObject` 连 `_zod` 都没有）。
// ⚠️ **封口一律 `z.strictObject`**（票 28 实测：`io: "input"` 下普通 `z.object` **不产出**
//   `additionalProperties: false`）。
//
// ─────────────────────────────────────────────────────────────────────────────
// ⚠️ **DNA 的消费者：R13 的重生成（主）+ 提示词（次）。**
//
//   R13 定了「修复 = **资源级重生成**」。若重生成时没有一份**一字不变的**角色描述，
//   重画出来的就**不是同一个角色** —— 修复会**静默地换掉主角**。
//   那是今天**买不到**的东西：今天「这个角色是谁」住在 `AssetSpec.description` + `role` 里，
//   而**每个资产各自重打一遍**（`prompt.ts:360`），两处措辞不同就是两个角色。
//
//   ⚠️ **跨资产一致性不是 DNA 的功劳** —— 那个今天已经有了：
//     原图内联进每一次生图调用（`pack.ts:328-329`）。把它算进来是**重复记账**。
//
// ─────────────────────────────────────────────────────────────────────────────
// ⚠️ **三层的关系：世界 = 类 · DNA = 个体 · 资产 = 一次渲染。**
//
//     `VisualWorldSpec.character`  ← 「这个世界的角色都矮壮、方头、硬边」（管**所有**角色）
//     `CharacterDNA`               ← 「Odin 本人戴绿毛线帽」（管**一个**角色）
//     `AssetSpec`                  ← 「这个资产画什么」（待机三帧 / 行走六帧）
//
//   ⇒ 硬约束：**`VWS.character` 的五个字段一个都不许机械复制进 DNA**
//     （`proportions` / `silhouette` / `poseLanguage` / `clothing` / `faceAbstraction`）。
//     若 `VWS.character.proportions` 与 `CharacterDNA` 里的某格可以是同一句话，
//     它们就是**同一件事的粗细两版** —— 那正是票 09 删 `GameSpec` 的理由。
//
//   ⇒ 于是 `identity` 这一格是**必须的**：它说的是「**这一个**是谁」，
//     而那在世界语法里**根本没有**（世界语法规格化了「角色怎么画」，不规格化「谁」）。
//
// ─────────────────────────────────────────────────────────────────────────────
// ⚠️ **砍掉的 `bodyProportions`**（票 04 Q3）—— 它不是一个「零消费者」字段，
//   它是**更糟的一种：一个会与事实分叉的副本**。
//
//   票 22 已经量过（`prompt.ts:58-68`）：**自由文本的比例指令模型不执行** ——
//   实测参考图写 "~6 heads"，生成出来是 ~3 头身的积木人；而 32×48 的画布本来就画不下 6 头身。
//   ⇒ 头身比是**算出来的**：`headCount(size.h) = clamp(round(h/12), 2, 5)`，
//     真正的约束是**画布尺寸**。
//
//   `coverage.ts` 的文件头正引着「票 24 原则 2：**不重复可派生的内容**」——
//   把 `headCount(size.h)` 的结果再抄一份进 DNA，尺寸一改两边就说不到一块去了。
import { z } from "zod/v4";
import { PaletteRefShape } from "./visual-world.js";

/** 判别式。⚠️ **用 `format` 而不是自由字符串的 `schemaVersion`**
 *  （票 02 的 R1-Q7 → 票 03 Q4 → 票 04 Q2，三次沿用）：
 *  自由字符串**判别式写不出来**，「`format` 这个字段存在的意义就是把契约变了这件事说出来」。 */
export const CHARACTER_DNA_FORMAT = "character-dna/v1" as const;

/** 一个角色的基因。
 *
 *  ⚠️ **全部必填，没有 `.optional()`**（票 04 Q2）—— 包括非人形角色。
 *  理由直接来自 R13：**DNA 的全部意义是重生成时一字不变**。
 *  一个可选字段会让「**这个角色确实没有脸**」与「**模型忘了填**」在文件里**长得一模一样** ——
 *  而重生成时前者应当维持、后者会被模型自由发挥。
 *  ⇒ **「没有」也必须被说出来**（`face` / `clothing` 写 `"none"`，`gear` 写 `[]`）。
 *  与票 02 的裁决 22（六桶**必填、允许 `[]`**、**不用** `.default([])`）是同一条取向。
 */
export const CharacterDNASchema = z.strictObject({
  /** ⚠️ **沿用 `GameDesignSpec` 那个实体的 `id`**（票 04 Q3），一对一。
   *  于是三个契约的引用族是**一条链**：
   *    `GameDesignSpec.player.id` = `character-dna[].id` = `AssetSpec.characterId`
   *  ⇒ 与票 03 给实体定的同一条规矩（不加回指字段，靠 **id 延续**）一致，
   *    而不是另发明一套映射表（那是**第四个事实源**）。
   *  ⚠️ 有 DNA 的实体：`player` + `enemies[]` + `npcs[]`；
   *    `interactables[]` / `resources[]` 默认没有（木条箱没有基因）。 */
  id: z.string().min(1),

  /** 「**这一个**是谁」。⚠️ **DNA 是它唯一的家** ——
   *  `AssetSpec.role` / `description` 已降格为**资产级**（「待机三帧」），不再表示角色身份。 */
  identity: z.string().min(1),

  /** 形态语言。⚠️ 留 ① 档（提示词具名插值）。
   *  票 22 证伪的是**数值**指令（"~6 heads" 模型不听），
   *  而这一格是**画法**（「方头、无渐变、硬边」）—— ⚠️ 这个区分是**推的，不是量的**。
   *  它没在模板里具名出现就出局。 */
  silhouette: z.string().min(1),

  /** 脸部画法。无脸时写 **`"none"`**（票 04 Q2：明确值，不允许省略）。 */
  face: z.string().min(1),

  /** 穿着，**一段散文**。⚠️ 与 `gear` 的分野是**真**边界：穿着是「看起来怎样」，
   *  携带物是「带了什么」。无服装时写 **`"none"`**。 */
  clothing: z.string().min(1),

  /** 携带物 / 器械 / 佩戴物，**一张清单**。无则 `[]`。
   *  ⚠️ 由 §7 的 `equipment` + `accessories` **合并**而来（票 04 Q5①）——
   *  那两个之间是**假**边界：两者的消费者都是 ①（同一段提示词），
   *  差别只在标签，而「装备：X／配件：Y」与「装备：X、Y」对模型是**同一个提示**。 */
  gear: z.array(z.string()),

  /** 这个角色的颜色。⚠️ **`PaletteRef[]`，不是自由 hex**（票 04 Q4）。
   *  票 02 的裁决 25 已经判过一模一样的形状（`materials.*.color`）：
   *  「否则这个世界就有了**第二套颜色来源**，而 `palette:N` 的一元性正是整票最硬的那条原则」。
   *  票 39 的那句话在这里同样成立：**选**色对、**排**色错 —— 所以这是**从世界色板里选**。
   *  ⚠️ 写成自由 hex 会**静默失效**：下游 `quantize.ts` 会把色板外的颜色量化掉。 */
  palette: z.array(PaletteRefShape),

  /** 角色**特有**的追加约束。
   *  ⚠️ **叠加在世界约束之上，不是替代**（票 04 Q5③）—— 否则它就是一个能
   *  **偷偷关掉世界约束**（"严禁抗锯齿与柔边" 那类）的后门。 */
  visualConstraints: z.array(z.string())
});

/** `run/v<N>/character-dna.json` 的**文件形状**。
 *
 *  ⚠️ **不是裸数组**（票 04 Q2）：裸数组**没地方放 `format`**，落盘之后就没有任何东西
 *  能证明它属于哪一族 —— 而 `format` 这个字段存在的意义正是这个。
 *  ⚠️ 一族一次就够 ⇒ **每条记录不带 `format`**。
 *
 *  ⚠️ **单文件装全部角色**（票 04 Q3），与 `asset-recipe.json` 一个文件装全部资产同形 ——
 *  而不是一个角色一份文件。 */
export const CharacterDNAFileSchema = z.strictObject({
  format: z.literal(CHARACTER_DNA_FORMAT),
  characters: z.array(CharacterDNASchema)
}).superRefine((f, ctx) => {
  const seen = new Set<string>();
  for (const [i, c] of f.characters.entries()) {
    if (seen.has(c.id))
      ctx.addIssue({
        code: "custom",
        path: ["characters", i, "id"],
        message: `角色 id 重复："${c.id}" —— characterId 会变得含糊（它靠 id 命中）`
      });
    seen.add(c.id);
  }
});

export type CharacterDNA = z.infer<typeof CharacterDNASchema>;
export type CharacterDNAFile = z.infer<typeof CharacterDNAFileSchema>;
