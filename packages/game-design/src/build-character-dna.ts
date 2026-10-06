// 票 31 的**纯**那一半：装配 + 两条检查。I/O 在 `compile-character-dna.ts`。
//
// 拆开的理由与票 08 的 `build-visual-world.ts`、票 10 的 `build-design.ts` 一样：
// 这一半**不碰网络**，所以「集合对不对」「守门人响不响」可以**不用假 `fetch` 直接测**。
//
// ⚠️ **与票 10 的装配步有一处结构性不同：这里**一个注入都没有**。
//   `GameDesignSpec` 有三个「调用方才知道」的值（`runtimeProfile` / `genre` / `camera`）要覆盖，
//   而 `CharacterDNA` 里**没有一个**：`format` 是字面量（模型照抄，契约自己判）、
//   `id` 由提示词给 + 装配时**核集合**（见下）、其余七格全是模型写的。
//   ⚠️ 与票 09（`GameIntentSpec`，也没有装配步）是**同一种干净**，只是理由相反：
//   那里是「模型全知」，这里是「**身份由设计层给，不由模型观察**」（票 02 裁决 21 的原则，
//   形状从「标量覆盖」换成了「键集校验」—— 见本文件 `CHARACTER_SET_GATE`）。
//   ⇒ **装配步仍然要**：两条检查（下面那两条）与契约的重过都住在那里。
//
// ⚠️ **两条检查的档位是同一档**（票 31 第 1 轮 Q5 的人类裁定：「**两条都阻断，但称谓分明**」）：
//   都算 `schema` 失败 ⇒ 调用方**重采样**。但**名字、错误消息、注释一律分得清清楚楚** ——
//   因为一条是**构造性 gate**，另一条只是**守门人**（必要不充分）。混着叫就是让后者冒充前者。
import {
  CHARACTER_DNA_FORMAT, CharacterDNAFileSchema,
  type CharacterDNAFile, type GameDesignSpec, type VisualWorldSpec
} from "@game-maker/contracts";

/** 本票**最核心的那条构造性 gate** 的称谓（票 31 第 1 轮 Q3 的人类收紧）。
 *
 *  ⚠️ **它是构造性的，不是引用族的**：说的是「**每个**角色实体**恰好**有一条 DNA」——
 *  多一条、少一条、改一条都算不成立。票 04 §5 把这条判据交给了本票，而 Q3 把它从
 *  「顺带的一条校验」升格成**这一票的核心**（原文：「Q3 的集合相等则应直接成为本票最核心的构造性 gate」）。
 *
 *  ⚠️ **两条集合关系方向不对称，别写成一条 `⊆`**：
 *    · 少一条（设计层的角色实体没有 DNA）= **做丢了** —— 与票 10 的 `intent-entity-missing` 同一种病；
 *    · 多一条（DNA 里的 id 在设计层没有对家）= **凭空造了一个角色**（或抄错了 id）。
 *  两条都要报，且**报出来的话不一样** —— 人改的时候要知道是哪一头错了。 */
export const CHARACTER_SET_GATE = "构造性 · 每个角色实体恰好一条 DNA";

/** ⚠️ **守门人**的称谓（票 31 第 1 轮 Q1 的人类收紧）。
 *
 *  ⚠️ **它是必要不充分的**：模型换一个标点、加一个「的」，逐字比较就绕过去了。
 *  ⇒ 它**挡的是最赤裸那种复制**（把 `vws.character.silhouette` 整句搬进 `dna.silhouette`）。
 *  ⚠️ **不许**把它引用成「『不许复制』这条语义规矩的判据」——
 *  真正管住那层语义的是**提示词**（世界说「类」、DNA 说「个体」）。
 *  这条已知噪声**留档**：它是票 02 裁决 21 / 票 10 的「不可机械判定」那条纪律的同款，
 *  区别是这里**仍然做了一次精确可算的检查** —— 因为「逐字相同」本身精确可算，
 *  且它**错了一定不是设计**（世界那一类的画法不该是这一个角色的全部描述）。 */
export const COPY_GUARD = "守门人 · 必要不充分（换一个标点就绕过）";

/** 守门人比的那**三对**。⚠️ 第三对**名字不同、语义对应**（`face` ↔ `faceAbstraction`）——
 *  这正是票 04 那条硬约束的原话里点名的五个字段，其中：
 *  · `proportions` / `poseLanguage` 在 DNA 里**没有同名字段**（`bodyProportions` 已被票 04 Q3 砍掉）
 *    ⇒ **无可比**，它们只作为提示词的输入进这一发（写了这条注释，免得下一个人以为漏了）；
 *  · 剩下三个各有一个直接对家 —— 就是下面这三行。 */
export const COPY_GUARD_PAIRS: readonly { dna: keyof CharacterDNALike; vws: keyof VisualWorldSpec["character"] }[] = [
  { dna: "silhouette", vws: "silhouette" },
  { dna: "clothing", vws: "clothing" },
  { dna: "face", vws: "faceAbstraction" }
];

/** 只为了给上面那张表一个**够窄**的类型 —— 「能被比的三格」就是这三个。 */
type CharacterDNALike = { silhouette: string; clothing: string; face: string };

/** 设计层里**配得上一条 DNA**的那些实体（票 04 裁决 13）。
 *
 *  ⚠️ `interactables[]` / `resources[]` **不在**：木条箱与补给**没有基因**。
 *  ⚠️ `player` 是**必填**的 ⇒ 这一族**永远不会空** —— 于是上面那条集合相等永远有内容可查
 *  （反过来，若这一族可能为空，那条 gate 就会在「没有角色」时**恒真**，那是条永远绿的判据）。
 *  ⚠️ 名字里的 `where` 是给**人**看的：报错要说得出「设计层哪一格里的那个实体没拿到 DNA」。 */
export function characterEntities(design: GameDesignSpec): { id: string; where: string }[] {
  return [
    { id: design.player.id, where: "player" },
    ...design.enemies.map((e, i) => ({ id: e.id, where: `enemies[${i}]` })),
    ...design.npcs.map((e, i) => ({ id: e.id, where: `npcs[${i}]` }))
  ];
}

/** ⚠️ 报错里引用的原话最多引这么长 —— 那五格可能是整段散文。 */
const QUOTE = 60;

export type BuildCharacterDnaInput = {
  /** 模型吐出来的那一份（已过契约）。 */
  fromModel: CharacterDNAFile;
  design: GameDesignSpec;
  vws: VisualWorldSpec;
};

export type BuildCharacterDnaOutcome =
  /** 过完契约（含顶层那条空值 gate）与**两条检查**的成品。 */
  | { ok: true; file: CharacterDNAFile }
  /** 模型没干好 ⇒ 调用方**重采样**（⚠️ 两条检查**都在这一档**，Q5 的裁定）。 */
  | { ok: false; kind: "schema"; detail: string };

/**
 * **核心构造性 gate**：设计层的角色实体 ⟷ `characters[].id` **恰好相等**（票 31 的 Q3）。
 *
 * ⚠️ **两头都报、且报的话不一样**：少一条是「**做丢了**」（与票 10 的 `intent-entity-missing` 同源），
 * 多一条是「**凭空造了一个**」（或 id 抄错）。只报一头会让人以为错在另一头。
 *
 * ⚠️ **多出来的那一头有一种特别常见的形状**要认出来：模型给 `interactables[]` / `resources[]`
 * 里的东西也写了 DNA（木条箱、补给 —— 它们**没有基因**）。所以那句话要把这条规矩说出来。
 */
export function characterSetGate(design: GameDesignSpec, file: CharacterDNAFile): string[] {
  const want = characterEntities(design);
  const wantIds = new Set(want.map((e) => e.id));
  const haveIds = new Set(file.characters.map((c) => c.id));
  const out: string[] = [];

  for (const e of want)
    if (!haveIds.has(e.id))
      out.push(
        `【${CHARACTER_SET_GATE}】设计层的 \`${e.where}\`（\`${e.id}\`）**没有 DNA** —— ` +
        "每一个角色实体**恰好一条**，少一条就是**把用户见过的那个角色做丢了**（记了它，却没有任何东西" +
        "能说明它长什么样）。⚠️ 你漏写的每一个 id，重生成时都**没有一字不变的描述可用**。"
      );

  for (const c of file.characters)
    if (!wantIds.has(c.id))
      out.push(
        `【${CHARACTER_SET_GATE}】\`characters[].id\` 里的 \`${c.id}\` 在设计层**没有对家** —— ` +
        "要么 id 抄错了，要么**凭空造了一个角色**。⚠️ 有 DNA 的**只有** `player` + `enemies[]` + `npcs[]`：" +
        "`interactables[]` / `resources[]`（木条箱、补给、终端）**没有基因**，别给它们写。"
      );

  return out;
}

/**
 * ⚠️ **守门人**（**必要不充分**）：三对逐字比较。
 *
 * 比的是「世界那一类共有的画法」有没有被**整句**搬进这一个角色的 DNA：
 * `dna.silhouette` vs `vws.character.silhouette` · `dna.clothing` vs `…clothing` ·
 * `dna.face` vs `…faceAbstraction`（⚠️ **最后一对名字不同、语义对应**）。
 *
 * ⚠️ **只比「整句相同」**（trim 之后）：换一个标点、加一个「的」就绕过去了 ——
 * **这是已知的、留档的噪声**，不是疏忽。它挡的是最赤裸那种复制；语义那一层由提示词管。
 * ⚠️ 世界那格**缺席或为空** ⇒ **无可比，跳过**（不是通过也不是失败）。
 * ⚠️ **别把它扩成「相似度」**：那需要阈值，而阈值就是**分数** —— R3 把「不评分」钉在判定层上，
 * 这条检查之所以还能存在，正是因为它只做**精确可算**的那一半（票 02 裁决 21 的同款取舍）。
 */
export function verbatimCopyGuard(file: CharacterDNAFile, vws: VisualWorldSpec): string[] {
  const out: string[] = [];
  for (const [i, c] of file.characters.entries())
    for (const pair of COPY_GUARD_PAIRS) {
      const fromWorld = vws.character[pair.vws];
      if (typeof fromWorld !== "string" || fromWorld.trim() === "") continue;
      if (c[pair.dna].trim() !== fromWorld.trim()) continue;
      out.push(
        `【${COPY_GUARD}】\`characters[${i}].${pair.dna}\` 与 \`vws.character.${pair.vws}\` **逐字相同**：` +
        `"${fromWorld.slice(0, QUOTE)}${fromWorld.length > QUOTE ? "…" : ""}" —— ` +
        "⚠️ 世界那五格说的是**这一类共有**的画法（管所有角色），DNA 说的是**这一个**。" +
        "整句抄下来，这一格就没有说出任何关于它的新东西（票 04 的硬约束）。" +
        "⚠️ 这条检查只是**守门人**（换一个标点就绕过），所以真正该做的是**重写这一格**——" +
        `把世界给的那套画法**落到这一个身上**（它比同类胖/缺一条胳膊/帽檐压得更低…），` +
        `而不是把它抄一遍。`
      );
    }
  return out;
}

/**
 * 重过契约 → **核心构造性 gate** → 守门人 → 交成品。
 *
 * ⚠️ **顺序是有意的**：契约先过（连契约都不过的文书，谈「集合对不对」没有意义）——
 *   与票 10 的 `buildDesign` 同一条理由。
 *
 * ⚠️ **为什么要重过一遍契约**：`fromModel` 在 `compile-character-dna` 里已经过过一次
 *   （`parseToolUse` 里那次）。这里再过一次不是重复：
 *   ① 本函数是**导出的**、也可以吃一份从磁盘读回来的 `character-dna.json`
 *     （契约自己那条 gate 的注释就写着「它同时也管从磁盘上读回来的」）；
 *   ② 顶层那条空值 gate 是 `superRefine` —— **它只在「整份文件」这个形状上才跑得起来**，
 *     而装配步正是**唯一**那个「整份文件」的落点（与票 10 让 gate 响在重过那一次同款）。
 */
export function buildCharacterDna(input: BuildCharacterDnaInput): BuildCharacterDnaOutcome {
  const candidate = { format: CHARACTER_DNA_FORMAT, characters: input.fromModel.characters };

  const parsed = CharacterDNAFileSchema.safeParse(candidate);
  if (!parsed.success)
    return {
      ok: false, kind: "schema",
      detail: parsed.error.issues.slice(0, 4).map((i) => `${i.path.join(".")}: ${i.message}`).join("；")
    };

  const file = parsed.data;
  const problems = [
    ...characterSetGate(input.design, file),
    ...verbatimCopyGuard(file, input.vws)
  ];
  if (problems.length > 0)
    return { ok: false, kind: "schema", detail: problems.join("\n") };

  return { ok: true, file };
}
