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
import { CAPABILITIES, MECHANICS, type GameDesignSpec, type GameIntentSpec, type VisualWorldSpec } from "@game-maker/contracts";

export const TOOL_NAME = "emit_game_intent";

/**
 * 工具说明 = **schema 说不清的东西唯一的家**（票 08 的 R2-Q5）。
 *
 * 这里写的每一条都是「`input_schema` 表达不出来的」：封口、必填性、枚举值域都能由 JSON Schema
 * 说清，而下面前四条**不能** —— 所以它们只能住在这里。⚠️ 别把它当第二份契约抄一遍。
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

另外两条硬规矩（违反了这一发会被判失败、当场重来）：

5. **不许有空串**：必填的字符串字段都得有内容，数组里也不许留空串占位。
   「用户没说」走 \`ambiguity[]\`，**不是**空串 —— 空串与「用户要的就是这样」在文件里长得一样。
   \`coreLoop\` / \`player.goals\` / \`mechanics\` **至少一条**；
   \`entities\` / \`winConditions\` / \`loseConditions\` / \`ambiguity\` **可以是空数组**（空就说「没有」）。

6. \`entities[].id\` 与 \`mechanics[].id\` **不许重复** —— 下游按 id 认东西，重了就说不出是哪一个。

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
  coreLoop: "核心循环，**一条一句**，**至少一条**",
  player: "`{ role, goals }`：他是谁、他要什么（`goals` **至少一条**）",
  world: "`{ theme, setting, atmosphere }`：题材 / 场景 / 氛围，各一句",
  mechanics: "用户说的机制，一条一个 `{ id, name }`，**至少一条**。⚠️ `name` 照原话记，别按外壳能力筛",
  entities: "世界里**有身份的东西**，一条一个 `{ id, type, role }`；`type` 四选一：" +
    "`enemy` 敌人 · `npc` 会说话给东西的 · `interactable` 能操作的 · `resource` **可拾取可消耗之物**" +
    "（⚠️ 资源只有这一个家）。**可以是空数组** —— 障碍跑式关卡就是空的",
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
 */
export const DESIGN_TOOL_DESCRIPTION = `输出一份 GameDesignSpec —— 把「用户要什么」**做成一个具体的设计**。
⚠️ 与上一步不同：这一层是**我们做成的**，所以**每个字段都必须完整**（没有「不知道」这个选项）。

四条 schema 表达不出来的规矩：

1. **不许有空串、也不许有空的必填数组**。必填字符串（\`game.genre\` · \`game.camera\` · \`player.role\` ·
   \`world.*\` · \`progression.*\` · 四个桶与 \`levels\` 里每一条的每一项）都得有内容；
   \`coreLoop\` · \`player.abilities\` · \`player.goals\` · \`mechanics\` · \`levels\` **至少一条**。
   ⚠️ 但**四个桶本身可以是空的**：只有平台、没有敌人/拾取物/交互物的关卡是真的。

2. \`mechanics[].mechanic\` 是**封闭枚举**（下面给了全部 8 个值）。⚠️
   **意图里哪条机制在这个表里找不到对家，就整条省掉** ——
   **不许**挑一个「近似的」顶上去（把「二段跳」写成 \`jump\` 是**静默丢东西**，比省掉更糟）。
   省掉之后由 \`compile-design\` 判：那正是「外壳做不了它」被说出来的一刻。

3. \`id\` 分两种，**别混**：
   · **意图里已经有的**（下面逐条给了）—— \`id\` **原样沿用**：**不许改、不许删、不许换桶**
     （意图层的 \`type\` 已经定了它在哪一桶）。⚠️ 改名不是「难看」，是让下游**说不出
     「用户要的那个东西做成了没有」**。
   · **这一层新加的** —— **允许**：需求里说得出来、而意图层没点名的东西（补给、危险、机关），
     给它们起**新**的 \`id\` 就是你的活。
   ⚠️ **但新东西的依据是需求，不是「你觉得游戏里应该有」。** 需求没说、你只是觉得
   「一个游戏总该有 X」的 —— **别加**。（先例：意图层的 \`coreLoop\` 说了「收集废料与净水」，
   而 \`entities[]\` 里只有废料 ⇒ 补一个净水是**对的**；凭空加一个 Boss 是**错的**。）

4. \`levels[].entities\` 是**引用**：每一项都必须是上面四个桶里**真的存在**的 \`id\`。
   ⚠️ 写到不存在的 id 会被判失败、当场重来。

只调这个工具，不要解释。`;

/** 骨架里的字段台账。⚠️ **键集必须与 `GameDesignSpecSchema` 逐字对齐**（下面有一条测试盯着）。 */
/** 四个桶共用的那半句（票 10 的 R2-Q1：**覆盖 + 补全**，不是镜像）。 */
const BUCKET_ID_RULE = "（意图里给的 `id` **原样沿用**；需求说得出来、意图没点名的**可以新加**，起新 `id`）";
const DESIGN_FIELD_HINTS: Record<keyof GameDesignSpec, string> = {
  format: `固定写 "game-design/v1"`,
  game: "`{ title, genre, camera, runtimeProfile }` —— ⚠️ **后三个照抄下面给的值**，别自己编；`title` 是你给它起的名字（必填）",
  coreLoop: "核心循环，**一条一句**，**至少一条**（对着意图层那条写，可以改写得更具体）",
  player: "`{ id, role, abilities, goals }` —— ⚠️ `player.role` 与 `player.abilities` 是**具名生产**的字段：能力一条一句（至少要有一条），`goals` 也至少一条",
  enemies: "`{ id, behavior, threat }[]` —— ⚠️ `enemies[].behavior` 与 `enemies[].threat` 是**具名生产**的：它怎么动、它怎么威胁" + BUCKET_ID_RULE,
  npcs: "`{ id, role, interaction }[]` —— ⚠️ `npcs[].role` 与 `npcs[].interaction` 是**具名生产**的：他是谁、能跟他做什么" + BUCKET_ID_RULE,
  interactables: "`{ id, type, behavior }[]` —— ⚠️ `interactables[].type` 与 `interactables[].behavior` 是**具名生产**的：它是什么类、碰它会怎样" + BUCKET_ID_RULE,
  resources: "`{ id, purpose }[]` —— 每个可拾取之物**拿来干嘛**（可以是空数组：这一关没有可拾之物）" + BUCKET_ID_RULE,
  world: "`{ theme, setting, structure }` —— ⚠️ `world.theme` / `world.setting` / `world.structure` **三个都具名生产**；`structure` 说的是**空间怎么分层**（前景/中景/背景、纵向几段），**照参考图那个世界的结构写**",
  levels: "`{ id, purpose, layout, entities }[]` —— ⚠️ `levels[].purpose` 具名生产；`layout` 说清**从左到右怎么走**、`entities` 只填上面四个桶里**真有的 id**。**至少一关**",
  progression: "`{ model, description }` —— 进阶是怎么发生的",
  difficulty: "`{ model, description }` —— **可选**，需求里没提就整个省掉",
  mechanics: "`{ id, mechanic }[]` —— `id` **照抄意图层**，`mechanic` 从下面那 8 个值里挑；**至少一条**",
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
- 核心循环：${intent.coreLoop.join(" / ")}
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
