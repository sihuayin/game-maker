// 这一步的**问话面**：工具名 / 工具说明 / 读需求的提示词（票 09）。
//
// ⚠️ 与 `vision/prompts.ts` 同款的**两半分工**：
//   · `intentPrompt` 管「**怎么读这段需求**」—— 逐字段点名的骨架（票 09 第 2 轮 R2-Q4 的 (b)：
//     需求文本**永远**嵌在骨架里，短输入因此不会以「一句话」的形态发出去）；
//   · `TOOL_DESCRIPTION` 管「**schema 说不清的东西**」—— 08 的 R2-Q5 立的那个杠杆，
//     对这一步同样适用。它同时是**唯一**告诉模型那条 gate 存在的地方
//     （`toJSONSchema` 静默丢掉 `superRefine`，模型看不见 gate）。
//
// ⚠️ 提示词里**不出现的字段**就是出局的字段（票 03 的「① 档欠条」）——
//   下面那段骨架把 16 个键**逐个点名**，所以 `subgenre` / `camera` 这类可选档也活在台账上
//   （票 09 第 2 轮 R2-Q3：① 档那两个要求「尽力填」，其余推不出就省）。
import {
  CAPABILITIES, MECHANICS,
  type CharacterDNA, type GameDesignSpec, type GameIntentSpec, type VisualWorldSpec
} from "@game-maker/contracts";

export const TOOL_NAME = "emit_game_intent";

/**
 * 工具说明 = **schema 说不清的东西唯一的家**（票 08 的 R2-Q5）。
 *
 * 这里写的每一条都是「`input_schema` 表达不出来的」：封口、必填性、枚举值域都能由 JSON Schema
 * 说清，而下面前四条**不能** —— 所以它们只能住在这里。⚠️ 别把它当第二份契约抄一遍。
 *
 * ⚠️ **2026-10-13（票 54）：加了「**先分家**」那一段，并把第 6 条从「写着但没人看」升成 gate。**
 *   第八次真跑那份意图（`.scratch/.../run-out-2026-10-13a/.failed-.../game-intent.json`）
 *   把需求里「游戏需要有：…」那张清单**逐条抄进了 `mechanics[]`** ⇒ `chest` / `resource` / `enemy`
 *   同时躺在 `entities[]` 与 `mechanics[]` 里（第 6 条逐字禁止这件事，而当时**没有 gate 看着它**：
 *   盘上 7 份真实意图 **6 份**都这么写）；`wasteland-bg` / `final-goal` 更是**根本不属于** `mechanics[]`
 *   （它们的家是 `world` 与 `winConditions`）。⇒ 那条 `wasteland-bg` 在设计层找不到枚举对家，
 *   于是**独立**拒掉了那一跑（R12 · 退 4 · 链断）。
 *   ⚠️ 坏的不是判据（`intent-coverage` 与 R12 都对），是**意图层把东西记错了格子**。
 *   ⇒ 本票**只改这一层**：散文给出「哪句话归哪一格」的判据 + 拆两条的出路，判据那条 gate 加在
 *   `contracts/game-intent.ts` 的 ⑤b。**R 表一个字没动**（真机制做不出来照样记，第 1 条不变）。
 *
 * ⚠️ **2026-10-13（票 52）：加了第 7 条（`entities[].id` 不许写成它自己的 `type`），并把它也升成 gate ⑤c。**
 *   盘上**九份**真实意图里 **7 份**把实体 id 写成了「这一类」的名字
 *   （`{id:"enemy",type:"enemy"}` —— 单数 7/9 · 复数 1/9 · 干净 1/9），
 *   而设计层按票 03 Q2(b) **原样沿用、不许改名** ⇒ 那个名字一写下去就冻住。
 *   ⚠️ **它今天零尸体**（没有任何一跑因此死过）；先例是 08 的「色板不得重色」：形状口味被判据化。
 *   ⚠️ **第 7 条只是「让重采样有机会改对」的辅助，不是一条被声明有效的防线**（人类裁定）：
 *     R16 的重采样**重发同一个 body**、模型看不到理由 ⇒ 判据与这句话**必须成对**；
 *     而「模型真会听话」**没有任何免费手段能证明**，那件事归票 23 的下一次真跑。
 *   ⚠️ **射程就这一条**：`{id:"chest",type:"interactable"}` 这类**照样过**
 *     （「这是个类名」在本层没有可计算的定义）—— 别把它当成那件事的判据。
 */
export const TOOL_DESCRIPTION = `输出一份 GameIntentSpec —— 把一段**游戏需求**读成「用户说了什么」。
⚠️ 这是**记录**，不是设计：需求没说的别编具体事实。

四条 schema 表达不出来的规矩：

1. \`mechanics[].name\` 是**自由文本**。用户要二段跳、要攻击、要血量条，就**照原话记**下来 ——
   **不许**因为「这个大概做不出来」就把它删掉、改小或换个说法。
   做不做得了是**后面**那一步的判断，不是你这一步的 —— 你删掉的每一条，下游都**再也看不到**。

2. \`entities[].type\` 四选一，含义是封的：
   \`enemy\`（敌人）· \`npc\`（会说话、会给东西的角色）· \`interactable\`（能操作的东西：机关、箱子、终端）·
   \`resource\`（**可拾取、可消耗之物**：补给、废料、金币、罐头）。
   ⚠️ \`resource\` 这一档是「资源」**唯一**的地方 —— 这份契约**没有**另一个收资源的字段。

3. \`title\` **可空**：用户没起名就整个省掉。**别为了填满而编一个名字。**

4. \`ambiguity[]\` 写「**用户没说清**的地方」，**一条一句、每句必须以这份契约的字段名开头**，
   形如 \`camera：需求没提，暂按横版默认\`。
   ⚠️ 只写「用户没说」，**不要**写：
     · 「我们没做」那类缺项（那是另一回事）；
     · 设计细节 —— 关卡数量、数值平衡、资源用途、Boss 有几个阶段 —— **那些不是这份契约的字段**，
       写进去检查点也拿它没办法。

**先分家** —— 需求里的一句话，先判它说的是**哪一类东西**，再放进对应那一格。
⚠️ 放错格的代价不是「不好看」：同一个东西会被记成两遍，而下游**按 \`id\` 认东西**（第 6 条会当场拦下）。

 · **有一个东西在那儿**（敌人、会说话的 NPC、宝箱、机关、可拾取之物）⇒ 记进 \`entities[]\`。
 · **玩家怎么玩**（怎么移动、怎么跳、怎么收集、怎么打，以及规则与交互本身）⇒ 记进 \`mechanics[]\`。
 · **那个地方是什么样**（题材、场景、氛围）⇒ 记进 \`world\` 那三格。
 · **最终目标是什么**（赢了算怎么回事）⇒ 记进 \`winConditions[]\`。

⚠️ 一句话**同时说了「一个东西」和「对它的操作」**时（例如「宝箱能打开」），**拆成两条、各起一个 id**：
   实体那条进 \`entities[]\`（\`chest\`），操作那条进 \`mechanics[]\` 并**换一个说法**（\`open-chest\`）。
   **不许**两边用同一个 id，也**不许**为了躲开冲突把实体删掉 —— 那是真的丢东西。
⚠️ 分家分的是**这句话在说哪一类东西**，**不是「做不做得了」** ——
   外壳做不了的真机制（二段跳、Boss 战、对话）照样按第 1 条**照原话记进 \`mechanics[]\`**。
   「废土背景」不是机制（它归 \`world\`），「二段跳」是机制（哪怕做不出来）—— 这两件事别混。

另外三条硬规矩（违反了这一发会被判失败、当场重来）：

5. **不许有空串**：必填的字符串字段都得有内容，数组里也不许留空串占位。
   「用户没说」走 \`ambiguity[]\`，**不是**空串 —— 空串与「用户要的就是这样」在文件里长得一样。
   \`coreLoopSteps\` / \`player.goals\` / \`mechanics\` **至少一条**；
   \`entities\` / \`winConditions\` / \`loseConditions\` / \`ambiguity\` **可以是空数组**（空就说「没有」）。

6. \`entities[].id\` 与 \`mechanics[].id\` **不许重复** —— ⚠️ 不只是各自数组**内部**，**两张表之间**也不许。
   下游按 id 认东西，同一个 id 躺在两处，就说不出「是哪一个」。
   ⚠️ 撞上了**别删实体**（那是丢东西）：照上面**先分家**那条，把「那个东西」与「对它的操作」拆成两条、
   各起一个 id（\`chest\` 与 \`open-chest\`）。

7. \`entities[].id\` **要说的是「这一个」，不是「这一类」** —— 别把它写成它自己的 \`type\`：
   \`{id:"enemy",type:"enemy"}\` 与 \`{id:"enemies",type:"enemy"}\` 都不合格。
   设计层照这个 id **原样延续、不许改名** ⇒ 这个名字写下去就冻住了，
   所以起一个说得出**是哪一个**的名字（如 \`enemy-wasteland\` / \`scrap-resource\`）。
   ⚠️ 别为了躲这一条把实体删掉 —— 那是真的丢东西。

只调这个工具，不要解释。`;

/**
 * 把一段需求读成 `GameIntentSpec` 的提示词。
 *
 * ⚠️ **需求文本永远嵌在骨架里**（票 09 第 2 轮 R2-Q4）：这既是 16 个字段的台账
 * （① 档欠条要的「逐个点名」就是它），也让「`--intent "做一个废土横版寻宝游戏"`」
 * 那种一句话输入**不再以一句话的形态**发出去 —— 探针里两发一句话输入**全灭**
 * （`empty-input`，代理把入参丢了），那是这一改的直接动因（n=2，**不构成因果**，别当结论）。
 */
export function intentPrompt(input: { requirementText: string }): string {
  return `你在把一段**游戏需求**读成一份 \`GameIntentSpec\` —— 记的是「**用户说了什么**」。
⚠️ 需求没说的**别编具体事实**：能保守地推出来就推、并把它写进 \`ambiguity[]\`；
可选字段推不出来就**整个省掉**。

# 需求
${input.requirementText.trim()}

# 逐字段（${Object.keys(FIELD_HINTS).length} 个名字，一个都不许漏）
${Object.entries(FIELD_HINTS).map(([k, v]) => `- \`${k}\` —— ${v}`).join("\n")}

只调 ${TOOL_NAME} 工具，不要解释。`;
}

/** 骨架里的字段台账。⚠️ **键集必须与 `GameIntentSpecSchema` 逐字对齐**（下面有一条测试盯着）。 */
const FIELD_HINTS: Record<keyof GameIntentSpec, string> = {
  format: `固定写 "game-intent/v1"`,
  title: "用户起了名才填，**没提就整个省掉**（别为填满而编）",
  genre: "题材，一句话",
  subgenre: "细分题材。需求提了、或能可靠推出来就填；**推不出来就省掉**",
  camera: "用户想要的视角。同上 —— 提了或推得出就填，推不出就省掉",
  targetExperience: "「想要什么感觉」—— 氛围、情绪，一句话",
  coreLoopSteps: "核心循环，**一条一句**，**至少一条**",
  player: "`{ role, goals }`：他是谁、他要什么（`goals` **至少一条**）",
  world: "`{ theme, setting, atmosphere }`：题材 / 场景 / 氛围，各一句",
  mechanics: "用户说的机制（**玩家怎么玩**：移动 / 跳跃 / 收集 / 战斗，以及规则与交互本身），" +
    "一条一个 `{ id, name }`，**至少一条**。⚠️ `name` 照原话记，别按外壳能力筛；" +
    "⚠️ 但**世界设定 / 胜利条件 / 「有个东西在那儿」都不是机制**（见工具说明里「先分家」那条）",
  entities: "世界里**有身份的东西**（敌人 / 会说话的 NPC / 能操作的东西 / 可拾取之物），" +
    "一条一个 `{ id, type, role }`；`type` 四选一：" +
    "`enemy` 敌人 · `npc` 会说话给东西的 · `interactable` 能操作的 · `resource` **可拾取可消耗之物**" +
    "（⚠️ 资源只有这一个家）。**可以是空数组** —— 障碍跑式关卡就是空的。" +
    "⚠️ 这里的 `id` 与 `mechanics[].id` **不许撞**：一句话同时说了「东西」与「对它的操作」就拆成两条",
  progression: "`{ type, description }`：进阶。需求提了才填，给一句就够；**推不出就整个省掉**",
  challenge: "`{ type, description }`：难度来源。同上",
  winConditions: "胜利条件，**一条一句**；「没有终点」就留空数组",
  loseConditions: "失败条件，**一条一句**；「不会死」就留空数组",
  ambiguity: "**用户没说清的地方**，一条一句、**每句以本契约的字段名开头**" +
    "（如 `camera：需求没提，暂按横版默认`）。⚠️ 只写「用户没说」，不写「我们没做」、也不写设计细节",
};

// ═════════════════════════════════════════════════════════════════════════════
// 票 10：设计编译那一步的问话面（与票 09 那一段**同一个形状**，两段各管各的）
// ═════════════════════════════════════════════════════════════════════════════

export const DESIGN_TOOL_NAME = "emit_game_design";

/**
 * 工具说明 = **schema 说不清的东西唯一的家**（票 08 的 R2-Q5）。
 *
 * ⚠️ 下面第 1 条同时是**唯一**告诉模型「契约带一条 gate」的地方 ——
 *   `toJSONSchema` 把 `superRefine` 静默丢掉（08 实测），所以模型**看不见**那条规矩。
 *
 * ⚠️ **2026-10-13（票 53）：第 4 条那半句改过口 —— 只改散文，判据一条没动。**
 *   票 42 加的那句原文是「**别在 `npcs[]` 里再写一条「玩家本人」**」，它**只说了「不许复制」**，
 *   而模型把它读成了「**把意图层那条删掉**」——于是撞上第 3 条（「意图里已有的 `id` **不许删**」，
 *   由 `auditIntentCoverage` 执行）⇒ 第八次真跑段 A **7/7 跑**都死在 `intent-entity-missing`、退 4。
 *   ⚠️ 坏的不是那两条判据（第 3 条保覆盖、gate ⑤ 保唯一，两条都**对**），是**散文没说清要改哪一个**：
 *   `player.id` 才是那个必须另起的，而意图层登记过的那条 npc **要原样留着**。
 *
 * ⚠️ **2026-10-13（票 54）：第 2 条那半句改过口 —— 还是只改散文，判据一条没动。**
 *   原文「省掉之后由 `compile-design` 判：那正是『外壳做不了它』被说出来的一刻」读起来像
 *   「判 = 一个中性的观察」，而实际是「**判 = 拒绝整份设计、退 4、链就断在这儿**」——
 *   更糟的是它与同一份提示词里的字段台账打架：那条写着 `id` **照抄意图层**，
 *   于是**所有真的过了 `compile-design` 的设计**都是靠「挑一个近似的顶上去」活下来的
 *   （盘上 3 份 + 第七跑），而**唯一听了话的那一条死了**（`wasteland-bg`）。
 *   ⇒ 改口只做一件事：把「省掉**之后**会发生什么」写明白（整份拒绝 / 退 4 / 点名哪条机制），
 *     并明说顶替是把它换成一次**没人看见的丢东西**。
 *   ⚠️ **这不是给 R12 开口子**（那要按 R17 另开票）—— 一个字的语义都没松，只是把后果说清。
 */
export const DESIGN_TOOL_DESCRIPTION = `输出一份 GameDesignSpec —— 把「用户要什么」**做成一个具体的设计**。
⚠️ 与上一步不同：这一层是**我们做成的**，所以**每个字段都必须完整**（没有「不知道」这个选项）。

四条 schema 表达不出来的规矩：

1. **不许有空串、也不许有空的必填数组**。必填字符串（\`game.genre\` · \`game.camera\` · \`player.role\` ·
   \`world.*\` · \`progression.*\` · 四个桶与 \`levels\` 里每一条的每一项）都得有内容；
   \`coreLoopSteps\` · \`player.abilities\` · \`player.goals\` · \`mechanics\` · \`levels\` **至少一条**。
   ⚠️ 但**四个桶本身可以是空的**：只有平台、没有敌人/拾取物/交互物的关卡是真的。

2. \`mechanics[].mechanic\` 是**封闭枚举**（下面给了全部 8 个值）。⚠️
   **意图里哪条机制在这个表里找不到对家，就整条省掉** ——
   **不许**挑一个「近似的」顶上去（把「二段跳」写成 \`jump\` 是**静默丢东西**，比省掉更糟）。
   ⚠️ **省掉之后会发生什么，说清楚**：这一份会被 \`compile-design\` **整份拒绝** —— 退出码 4、
   这条链**就停在这儿**，而且拒绝的理由里会**点名**少了哪条机制（连用户的原话一起报出来）。
   那不是惩罚，是「**外壳做不了它**」被**说出口**的那一刻：把它交回给上游，比悄悄糊过去强。
   ⇒ 所以**更不许**为了让这一份「能过」去填一个近似的值 —— 省掉至少会**当场叫停**，
     顶替则是把一次叫停换成一次**没人看见的丢东西**。

3. \`id\` 分两种，**别混**：
   · **意图里已经有的**（下面逐条给了）—— \`id\` **原样沿用**：**不许改、不许删、不许换桶**
     （意图层的 \`type\` 已经定了它在哪一桶）。⚠️ 改名不是「难看」，是让下游**说不出
     「用户要的那个东西做成了没有」**。
   · **这一层新加的** —— **允许**：需求里说得出来、而意图层没点名的东西（补给、危险、机关），
     给它们起**新**的 \`id\` 就是你的活。
   ⚠️ **但新东西的依据是需求，不是「你觉得游戏里应该有」。** 需求没说、你只是觉得
   「一个游戏总该有 X」的 —— **别加**。（先例：意图层的 \`coreLoopSteps\` 说了「收集废料与净水」，
   而 \`entities[]\` 里只有废料 ⇒ 补一个净水是**对的**；凭空加一个 Boss 是**错的**。）

4. \`levels[].entities\` 是**引用**：每一项都必须是**玩家或上面四个桶里**真的存在的 \`id\` ——
   这一关里有玩家，就写 \`player.id\`（\`layout\` 本来就在说玩家怎么走）。
   ⚠️ 写到不存在的 id 会被判失败、当场重来。
   ⚠️ **也**不许把玩家**复制**进任何一个桶：\`player.id\` 与桶里某个 id 相同会被判失败、当场重来 ——
   要**另起**的是 \`player.id\`（给它一个不与任何桶重名的 id）。
   ⚠️ **这句说的是 \`player.id\`，不是「把桶里那条删掉」**：若意图层**就是**把主角登记成了某个桶里的
   一条（\`role\` 写着「玩家控制的…」），那条**留着**、\`id\` 按第 3 条**原样沿用** ——
   它是意图层登记过的实体，删了它，下游就**再也说不出「用户要的那个东西做成了没有」**。

只调这个工具，不要解释。`;

/** 骨架里的字段台账。⚠️ **键集必须与 `GameDesignSpecSchema` 逐字对齐**（下面有一条测试盯着）。 */
/** 四个桶共用的那半句（票 10 的 R2-Q1：**覆盖 + 补全**，不是镜像）。 */
const BUCKET_ID_RULE = "（意图里给的 `id` **原样沿用**；需求说得出来、意图没点名的**可以新加**，起新 `id`）";
const DESIGN_FIELD_HINTS: Record<keyof GameDesignSpec, string> = {
  format: `固定写 "game-design/v1"`,
  game: "`{ title, genre, camera, runtimeProfile }` —— ⚠️ **后三个照抄下面给的值**，别自己编；`title` 是你给它起的名字（必填）",
  coreLoopSteps: "核心循环，**一条一句**，**至少一条**（对着意图层那条写，可以改写得更具体）",
  player: "`{ id, role, abilities, goals }` —— ⚠️ `player.role` 与 `player.abilities` 是**具名生产**的字段：能力一条一句（至少要有一条），`goals` 也至少一条",
  enemies: "`{ id, behavior, threat }[]` —— ⚠️ `enemies[].behavior` 与 `enemies[].threat` 是**具名生产**的：它怎么动、它怎么威胁" + BUCKET_ID_RULE,
  npcs: "`{ id, role, interaction }[]` —— ⚠️ `npcs[].role` 与 `npcs[].interaction` 是**具名生产**的：他是谁、能跟他做什么" +
    "（⚠️ **玩家的身份在 `player.id` 那一格**：**别为它新写一条** —— 要让关卡点名玩家，直接在 `levels[].entities` 里写 `player.id`；" +
    "⚠️ 而**意图层已经登记过的那条要留着**、`id` 原样沿用 —— 要另起的是 `player.id`，不是删掉它）" + BUCKET_ID_RULE,
  interactables: "`{ id, type, behavior }[]` —— ⚠️ `interactables[].type` 与 `interactables[].behavior` 是**具名生产**的：它是什么类、碰它会怎样" + BUCKET_ID_RULE,
  resources: "`{ id, purpose }[]` —— 每个可拾取之物**拿来干嘛**（可以是空数组：这一关没有可拾之物）" + BUCKET_ID_RULE,
  world: "`{ theme, setting, structure }` —— ⚠️ `world.theme` / `world.setting` / `world.structure` **三个都具名生产**；`structure` 说的是**空间怎么分层**（前景/中景/背景、纵向几段），**照参考图那个世界的结构写**",
  levels: "`{ id, purpose, layout, entities }[]` —— ⚠️ `levels[].purpose` 具名生产；`layout` 说清**从左到右怎么走**、`entities` 只填**玩家或上面四个桶里真有的 id**（玩家写 `player.id`，**不要**为它**新开**一条 NPC —— ⚠️ 而意图层登记过的那条**留着**）。**至少一关**",
  progression: "`{ model, description }` —— 进阶是怎么发生的",
  difficulty: "`{ model, description }` —— **可选**，需求里没提就整个省掉",
  mechanics: "`{ id, mechanic }[]` —— `id` **照抄意图层**（⚠️ **只在你能给它挑出一个对家时**才写这一条；" +
    "挑不出对家就**整条省掉**，见第 2 条 —— **不许**拿近似的值占位），`mechanic` 从下面那 8 个值里挑；**至少一条**",
  winConditions: "胜利条件，**一条一句**（可以是空数组：「没有终点」）",
  loseConditions: "失败条件，**一条一句**（可以是空数组：「不会死」）",
  runtimeRequirements: "这一关**用得上**的外壳能力，从下面 8 个能力名里挑（没有就留空数组）",
};

/**
 * 把「意图 + 这个世界的视觉语法」读成 `GameDesignSpec` 的提示词。
 *
 * ⚠️ **意图层那 6 个 ① 档字段必须在这里具名插值**（票 03 的欠条，票 10 落地时的裁定）：
 *   `subgenre` · `camera` · `targetExperience` · `world.atmosphere` · `player.role` · `entities[].role`。
 *   设计层那 12 个 ① 档字段是**本提示词要求模型生产**的，它们的具名插值发生在**下游**（票 12 / 票 14）。
 *
 * ⚠️ **`VisualWorldSpec` 落在四处**（票 10 的 Q1）：`world.structure` ← `composition`；
 *   `levels[].layout` ← `environment.architecture` / `environment.terrain` / `composition.background`；
 *   实体的做派 ← `environment.props` / `character.*`；以及**相机那条拒绝面**（不在本提示词里，在装配处）。
 *   ⇒ 不喂它，「结构」与「关卡怎么排」就只能瞎编 —— 那就是票 03 砍掉 `visualRequirements` 之后
 *     VWS 在这道编译里**唯一**的落脚处。
 */
export function designPrompt(input: {
  intent: GameIntentSpec;
  vws: VisualWorldSpec;
  /** ⚠️ 三个**照抄**值（票 10 的 Q5）：装配时会被强制覆盖，与票 08 让模型照抄 `style.id` 同款。 */
  echo: { gameTitleHint?: string; runtimeProfile: string; genre: string; camera: string };
}): string {
  const { intent, vws } = input;
  const e = input.echo;
  return `你在把一份**已经写下来的意图**做成一个**具体的设计**（\`GameDesignSpec\`）。
⚠️ 这一层是「**我们做成了什么**」，不是「用户说了什么」—— 所以**每个字段都要有内容**，
别复制空泛的原话，要把意图**落实成可执行的东西**。

# 用户要什么（GameIntentSpec）
- 题材：${intent.genre}${intent.subgenre === undefined ? "" : `（细分：${intent.subgenre}）`}
- 想要的视角：${intent.camera ?? "（用户没说，按这个世界与外壳的实际情况定）"}
- **想要什么感觉**：${intent.targetExperience}
- 核心循环：${intent.coreLoopSteps.join(" / ")}
- 玩家：${intent.player.role}；他要的是 ${intent.player.goals.join(" / ")}
- 世界：${intent.world.theme} · ${intent.world.setting} · **氛围**：${intent.world.atmosphere}
- 用户说的机制：${intent.mechanics.map((m) => `\`${m.id}\`=${m.name}`).join(" · ")}
- 世界里的东西 —— 这几个 \`id\` 与 \`type\` **原样沿用**（不许改、不许删、不许换桶）：
${intent.entities.map((x) => `  · \`${x.id}\` · ${x.type} · ${x.role}`).join("\n")}

⚠️ **这一层可以「补全」**：需求里说得出来、而上面这些没点名的东西（补给、危险、机关），
   给它们起**新**的 \`id\` 加进去 —— 那是你的活。
⚠️ **但依据是需求，不是「你觉得游戏里应该有」**：需求没说、你只是觉得「一个游戏总该有 X」的，**别加**。
⇒ 这一层是「**意图覆盖 + 需求补全**」，**不是**意图的镜像：**可以多，不可以少、不可以改**。
${intent.ambiguity.length === 0 ? "" : `- ⚠️ 需求里**没说清**的地方（你自己拿主意，但别和它打架）：\n${intent.ambiguity.map((a) => `  · ${a}`).join("\n")}\n`}
# 这个世界长什么样（VisualWorldSpec —— **结构与关卡排布照它写**）
- 视觉身份：${vws.styleIdentity.description}
- 相机模式：${vws.camera.mode}
- **空间结构**（→ 你要写进 \`world.structure\`）：${describeComposition(vws)}
- 环境：${[vws.environment.architecture, vws.environment.terrain, vws.environment.props].filter(Boolean).join("；") || "（没写）"}
- 物象与角色：${[vws.environment.textureDensity, vws.character.silhouette, vws.character.proportions].filter(Boolean).join("；") || "（没写）"}
- 这个世界的样子（原话）：${vws.styleIdentity.keywords.join(" / ")}

# 必须**逐条生产**的字段（${Object.keys(DESIGN_FIELD_HINTS).length} 个键，一个都不许漏）
${Object.entries(DESIGN_FIELD_HINTS).map(([k, v]) => `- \`${k}\` —— ${v}`).join("\n")}

# 照抄这三个值（⚠️ 装配时会被**强制覆盖**，所以别自己编）
- \`game.runtimeProfile\` = \`{"id":"${e.runtimeProfile.split("/v")[0]}","version":"${e.runtimeProfile.split("/v")[1] ?? "1"}"}\`
- \`game.genre\` = \`${e.genre}\`
- \`game.camera\` = \`${e.camera}\`
${e.gameTitleHint === undefined ? "" : `- \`game.title\` 建议用 \`${e.gameTitleHint}\`（用户起的名字，照抄）\n`}
# 两张封闭词表（\`mechanic\` 与 \`runtimeRequirements\` 只能从这里挑）
- 机制：${MECHANICS.join(" · ")}
- 外壳能力：${CAPABILITIES.join(" · ")}

只调 ${DESIGN_TOOL_NAME} 工具，不要解释。`;
}

/** 把 VWS 的空间语言摊成一句话，给 `world.structure` 用。⚠️ **具名插值**：字段名逐个点出来。 */
function describeComposition(vws: VisualWorldSpec): string {
  const c = vws.composition;
  const parts = [c.foreground, c.midground, c.background, c.objectScale, c.density].filter(
    (x): x is string => typeof x === "string" && x.trim() !== ""
  );
  return parts.length === 0 ? "（参考图没给出分层信息 —— 按需求自己定，但要说清纵向几段）" : parts.join(" · ");
}

// ═════════════════════════════════════════════════════════════════════════════
// 票 31：角色基因那一步的问话面（与上面两段**同一个形状**，三段各管各的）
// ═════════════════════════════════════════════════════════════════════════════

export const CHARACTER_DNA_TOOL_NAME = "emit_character_dna";

/**
 * 工具说明 = **schema 说不清的东西唯一的家**（票 08 的 R2-Q5）。
 *
 * ⚠️ 第 1 条同时是**唯一**告诉模型「契约带一条空值 gate」的地方，
 *   第 3 条是**唯一**告诉它「有一个守门人在比那三对」的地方 ——
 *   `toJSONSchema` 把 `superRefine` 静默丢掉（票 08 实测），而守门人住在装配步、**根本不在 schema 里**。
 *
 * ⚠️ 但**说辞要老实**：第 3 条写的是**语义规矩**（类 vs 个体），不是「我们查得出来」——
 *   那条检查是**守门人、必要不充分**（票 31 第 1 轮 Q1），把它说成天网会让模型学会绕、
 *   而不是学会不抄（票 10 的「做不了就整条省掉」是同一种诚实的写法）。
 */
export const CHARACTER_DNA_TOOL_DESCRIPTION = `输出一份 character-dna/v1 —— 给这个游戏里的**每一个**角色一份基因。
⚠️ 这一层问的是「**这一个是谁**」（个体），不是「这个世界的角色都长什么样」（类）—— 后者已经有了。

五条 schema 表达不出来的规矩：

1. **八个键一个都不许省**，包括「确实没有」的那种：\`face\` / \`clothing\` 写 \`"none"\`、
   \`gear\` / \`visualConstraints\` / \`palette\` 写 \`[]\`。
   ⚠️ 省掉与「确实没有」在文件里长得**一模一样**，而这份文件存在的意义正是**让重生成一字不变** ——
   省掉的那一格会被重新自由发挥。⚠️ 也**不许拿空串占位**（\`""\` 或 \`"  "\`）：那是第二个隐形缺省。
   \`gear[]\` / \`visualConstraints[]\` 里也不许留空串。

2. \`id\` **原样沿用**设计层那个实体的 id，**每个角色恰好一条**：少一条、多一条、改一个都算不合格
   （构造性判据）。⚠️ 有基因的**只有** player + enemies + npcs ——
   interactables / resources（木条箱、补给、终端）**没有基因**，别给它们写。

3. ⚠️ 世界那五格（\`proportions\` / \`silhouette\` / \`poseLanguage\` / \`clothing\` / \`faceAbstraction\`）
   说的是**这一类共有**的画法，**不许整句抄进某个角色的 DNA** ——
   抄下来那一格就没有说出关于**它**的任何新东西。要把共有的画法**落到这一个身上**。

4. \`palette\` 只能写 \`palette:<下标>\`（从上面那份色板里**选**），**不许**写 hex 或颜色名。
   ⚠️ 它的用途是「这个角色身上哪些颜色」，不是「这个世界的色板长什么样」。

5. \`visualConstraints\` 是**叠加**在世界约束之上的**追加**，不是替代 ——
   不许拿它把世界的约束关掉（「不要抗锯齿」那类话写在这里是**反向**的）。

只调这个工具，不要解释。`;

/** 骨架里的字段台账。⚠️ **键集必须与 `CharacterDNASchema` 逐字对齐**（下面有一条测试盯着）。 */
const DNA_FIELD_HINTS: Record<keyof CharacterDNA, string> = {
  id: "**原样沿用**上面括号里的那个 id（一个都不许改、不许漏、不许加）",
  identity: "「**这一个**是谁」—— 它是谁、过着什么日子、为什么在这儿。" +
    "⚠️ 这是**全世界唯一**说得出它是谁的地方（世界语法规格化的是「角色怎么画」，不规格化「谁」）；" +
    "写**它自己**，不要写它长什么样、也不要写它干什么",
  silhouette: "形态语言：**画法**（头形、边缘、量感、怎么站立），不是数值比例。" +
    "⚠️ 与世界的 `character.silhouette` 相容，但**不许整句抄** —— 写**它**在这一类里偏成什么样",
  face: "脸部画法。⚠️ **没有脸就写 `\"none\"`**（不许省掉这一格）",
  clothing: "穿着，**一段散文**（无服装写 `\"none\"`）。⚠️ 与 `gear` 的分野是**真**边界：" +
    "穿着是「**看起来怎样**」，`gear` 是「**带了什么**」",
  gear: "携带物 / 器械 / 佩戴物，**一条一句**；没有就写 `[]`",
  palette: "这个角色身上的颜色，从世界色板里**选**：只能写 `palette:<下标>`（如 `palette:0`）。" +
    "⚠️ 不许写 hex 或颜色名（写了下游会被量化掉，等于没写）",
  visualConstraints: "这个角色**特有**的追加约束，一条一句（没有就写 `[]`）。" +
    "⚠️ **叠加**在世界约束之上，**不是替代** —— 在这里写「不要抗锯齿」那类话是**反向**的"
};

/**
 * 把「这份设计 + 这个世界」读成一份角色基因。
 *
 * ⚠️ **外观的两半都在这里插值**（票 31 的 Q1）：
 *   · **类**（`vws`：`character` 五格 + `styleIdentity` + 六桶色板 + `materials`）——
 *     ⚠️ 这是 `VWS` 在这条链上的**第三个具名读者**（前两个是票 12 的规划与票 14 的编译），
 *     也是**六桶与 `materials` 第一次真的被读**（票 32 的票面说它们「零消费者」——
 *     那句话现在只对**生图那一步**成立了，见票 32）；
 *   · **个体**（`design` 里那几个实体的行为字段）—— ⚠️ 票 03 给它们标的 ① 档欠条
 *     **在这里第一次真的兑现**（设计层那 12 个 ① 档字段的具名插值之一，票 10 定的「下游插」）。
 *
 * ⚠️ 设计层**没有**外观字段（票 31 的 F3）—— 所以「这个世界 + 它的行为」是**唯一**的输入，
 *   而 `identity` 那一格没有别的地方能出（世界语法里根本没有「谁」）。
 *
 * ⚠️ **2026-10-13（票 42 Q8）：这里曾有一处自相矛盾 —— 现在够不着了，所以不改字，只留注。**
 *   下面的 `characterIndividualBrief` 把 `player`（`id` = …）与 `npcs[i]`（`id` = …）**逐条并列**列出，
 *   而紧接的那句写着这一族的 `id` 要「**恰好**覆盖这些实体」。若 `player.id === npcs[0].id`
 *   （票 42 量到的形状：6/6 份真实设计的 `npcs[]` 里都躺着一条「玩家控制的拾荒者本人」），
 *   这两句合起来就是**要求模型吐出两条同 id**，而 `CharacterDNA` 契约**禁重复**
 *   （`character-dna.ts` 的重复 gate）⇒ 模型无解：要么违约（第五跑 10-10b / 第七跑 10-11a：撞契约、
 *   3 次重采样全灭），要么自行合并（第六跑 10-10c：attempts=1 过）。
 *   ⇒ 票 42 **把引子堵在设计层**：`game-design.ts` 的 ⑤ 现在把 `player.id` 与桶 id 重复判成
 *   **设计层拒绝**，而 ⑥ 同时让 `levels[].entities[]` 能**点名玩家** —— 于是模型再没有
 *   「把玩家复制成一条 NPC」的理由，重 id 从来到不了这一发 ⇒ **这段文字今天够不着**。
 *   ⚠️ 按仓库对「够不着的判据」的惯例（不删字、只加带日期的注）：**删了它反而看不出这处矛盾存在过**。
 *   ⚠️ 但**缺陷仍在文书里**：`characterEntities` 与 `characterSetGate` 拿 `Set` 比较，
 *   **重 id 会静默塌成一条**（`build-character-dna.ts`）—— 若将来**别的**路把重 id 送进来，
 *   这两句话会**原样复活**。那是**另一条病**（「提示词要求模型违反自家契约」），不属票 42 的射程。
 */
export function characterDnaPrompt(input: { design: GameDesignSpec; vws: VisualWorldSpec }): string {
  const { design, vws } = input;
  const nothing = [...design.interactables.map((x) => x.id), ...design.resources.map((x) => x.id)];
  return `你在给这个游戏里的**每一个角色**写一份基因（\`CharacterDNA\`）。
⚠️ 这一层问的是「**这一个是谁**」，**不是**「这个世界的角色长什么样」—— 后者已经有了，见下。

# 这个世界里**所有角色共有**的长相（VisualWorldSpec —— ⚠️ 这是**类**，管所有角色）
${characterClassBrief(vws)}

⚠️ **上面那五格说的是这一类共有的画法**：你要写的每一个角色**必须与它相容**，
   但**不许把它整句抄下来**当某个角色的那一格 —— 抄下来，那一格就**没有说出关于这个角色的任何新东西**。
   装配时会逐字比对三对（\`silhouette\` · \`clothing\` · \`face\` ↔ 世界的 \`faceAbstraction\`），整句相同会被判失败。
   ⇒ 该做的是「把共有的画法**落到这一个身上**」：它比同类更胖 / 少一条胳膊 / 帽檐压得更低 …

# 这个游戏里的角色（GameDesignSpec —— ⚠️ 这些是**个体**）
⚠️ 设计层这些字段说的全是「**它干什么**」，**一个外观字段都没有** ——
   外观只能从「**这一条的行为**」×「**这个世界的类**」推出来。
${characterIndividualBrief(design)}
⚠️ \`id\` **原样沿用**上面括号里的每一个 id —— 这一族**恰好**覆盖这些实体，少一条 / 多一条都算不合格。
⚠️ \`interactables[]\` / \`resources[]\` 里那些东西${nothing.length === 0 ? "（本例没有）" : `（${nothing.join(" / ")}）`}
   **没有基因**（木条箱与补给没有「是谁」这回事），**别给它们写**。

# 逐字段（${Object.keys(DNA_FIELD_HINTS).length} 个键，一个都不许漏）
${Object.entries(DNA_FIELD_HINTS).map(([k, v]) => `- \`${k}\` —— ${v}`).join("\n")}

# 「没有」也要**写出来**
⚠️ 非人形（无人机、机器、无脸的东西）：\`face\` 写 \`"none"\`、\`clothing\` 写 \`"none"\`、
   \`gear\` 写 \`[]\`。**省掉一个键与「确实没有」在文件里长得一模一样** ——
   而这个文件存在的意义就是让**重生成一字不变**：省掉的那一格会被重新自由发挥。
⚠️ 空串（\`""\` 或 \`"  "\`）**不算写出来**，它只是第二个隐形缺省。

只调 ${CHARACTER_DNA_TOOL_NAME} 工具，不要解释。`;
}

/** 这个世界的**类**：角色共有的五格 + 颜色分工 + 材质 + 形状语言 + 世界约束。
 *  ⚠️ **五格逐个具名**（那是票 04 那张硬约束要的对照面），六桶与 `materials` 也摊开 ——
 *  它们的原话模型读不懂，但**分工**（哪一笔是主色 / 强调色 / 背景色）就是这一层要用的东西。 */
function characterClassBrief(vws: VisualWorldSpec): string {
  const ch = vws.character;
  const say = (s: string | undefined) => (typeof s === "string" && s.trim() !== "" ? s.trim() : "（这一格世界没给）");
  const buckets = Object.entries(vws.palette)
    .map(([k, refs]) => `${k}=${refs.join(",") || "∅"}`)
    .join(" · ");
  const mats = Object.entries(vws.materials)
    .map(([name, m]) => {
      const bits = [m.appearance, m.texture, (m.color ?? []).join(",")].filter((x): x is string => typeof x === "string" && x !== "");
      return `${name}（${bits.join("；") || "没写"}` + "）";
    })
    .join(" · ");
  const lines = [
    `- 视觉身份：${vws.styleIdentity.description}`,
    ...(vws.styleIdentity.keywords.length === 0 ? [] : [`- 关键词：${vws.styleIdentity.keywords.join(" / ")}`]),
    `- \`character.proportions\`：${say(ch.proportions)}`,
    `- \`character.silhouette\`：${say(ch.silhouette)}`,
    `- \`character.poseLanguage\`：${say(ch.poseLanguage)}`,
    `- \`character.clothing\`：${say(ch.clothing)}`,
    `- \`character.faceAbstraction\`：${say(ch.faceAbstraction)}`,
    `- **色板**（\`palette:<下标>\` 指的就是它）：${vws.style.palette.map((hex, i) => `${i}=${hex}`).join(" · ") || "（空）"}`,
    `- **颜色分工（六桶）**：${buckets}`,
    `- 形状语言：${vws.shapeLanguage.join(" · ") || "（没写）"}`,
    `- 世界的约束（⚠️ 你的 \`visualConstraints\` 是**叠加**在它之上，不是替代）：${vws.constraints.join("｜") || "（没有）"}`
  ];
  if (mats !== "") lines.splice(lines.length - 2, 0, `- 材质：${mats}`);
  return lines.join("\n");
}

/** 这个游戏里的**个体**：那几条配得上 DNA 的实体，逐条摊开它的行为字段。
 *  ⚠️ **`id` 括在括号里、逐条给**（那是 `id` 沿用这条判据的兑现方式：模型不必猜、也不必自己起名）。 */
function characterIndividualBrief(design: GameDesignSpec): string {
  const lines = [
    `- \`player\`（\`id\` = \`${design.player.id}\`）：他是 ${design.player.role}；` +
      `他能 ${design.player.abilities.join(" / ")}；他要 ${design.player.goals.join(" / ")}`
  ];
  for (const [i, e] of design.enemies.entries())
    lines.push(`- \`enemies[${i}]\`（\`id\` = \`${e.id}\`）：它怎么动 —— ${e.behavior}；它怎么威胁 —— ${e.threat}`);
  for (const [i, e] of design.npcs.entries())
    lines.push(`- \`npcs[${i}]\`（\`id\` = \`${e.id}\`）：他是 ${e.role}；能跟他做什么 —— ${e.interaction}`);
  lines.push(
    `- 这个游戏是什么：${design.game.title}（${design.game.genre} · ${design.game.camera}）——` +
      `世界的主题是 ${design.world.theme}，场景是 ${design.world.setting}，空间结构是 ${design.world.structure}`
  );
  return lines.join("\n");
}
