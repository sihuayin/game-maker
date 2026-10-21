// ⚠️ `PLAYER_ACTION_NAMES` 是**值**（不是类型）：那三个动作名全仓只写一遍、住 `game-config.ts`，
//   提示词**插值**它（票 61）—— 见 `game-config.ts` 里那段「四处由它派生」。
import { PLAYER_ACTION_NAMES, type GameDesignSpec, type VisualWorldSpec } from "@game-maker/contracts";
// schema-to-prompt 渲染器 —— **生成与推导共用的那一份**（票 22 问题 4 的落点）。
//
// 归 `assets` 而不是 `contracts`：它是 schema 的**镜像**，会随提示工程调优而改；
// 而 contracts 只放不随便动的东西。schema 一改，这里必须跟着改 —— 所以 op 集只有这一处描述。
import type { AssetSpec, CharacterDNA, StyleSpec } from "@game-maker/contracts";

/** 色板行。`palette:N` 的下标就是这里的序号 —— 模型必须能一一对上。 */
export function paletteLine(palette: readonly string[]): string {
  return palette.map((c, i) => `${i}:${c}`).join("  ");
}

/** op DSL 的说明。**全仓库只有这一处**描述它 —— 加一种 op 就改这里。 */
export function drawListOpsSpec(): string {
  return `op 只能七种，坐标与尺寸全是数字：
 {"op":"rect","x":n,"y":n,"w":n,"h":n,"fill":"palette:N"}
 {"op":"circle","cx":n,"cy":n,"r":n,"fill":"palette:N"}
 {"op":"ellipse","cx":n,"cy":n,"rx":n,"ry":n,"fill":"palette:N"}
 {"op":"poly","points":[[x,y],...],"fill":"palette:N"}
 {"op":"line","x1":n,"y1":n,"x2":n,"y2":n,"stroke":"palette:N","strokeWidth":n}
 {"op":"curve","points":[[x,y],...],"closed":bool,"fill":"palette:N"}
 {"op":"dither","x":n,"y":n,"w":n,"h":n,"colors":["palette:N","palette:M"],"ratio":0.0~1.0,"pattern":"checker"|"bayer2"|"bayer4"}
前六种可另加 "stroke":"palette:N"、"strokeWidth":n、"opacity":n。
fill / stroke / colors 里的颜色**只能是 "palette:N"**，硬编码 hex 会被 schema 直接拒绝。

⚠️ **dither 是画材质的手段**：它把两种色板色按比例交替铺满一块矩形。
想要「锈迹 / 磨损 / 噪点 / 阴影过渡」就用它 —— 一个 op 顶几十个小方块，
而且结果**每一个像素仍然严格在色板内**。这是像素风里唯一不出色板的调色手段。`;
}

/** few-shot 示例。**实测：没有它模型会把 ops 包进别的键、丢掉顶层字段。** */
export function drawListFewShot(): string {
  return `形状示例（两帧的最小例子，注意 frames 是**数组**，顺序就是播放顺序）：
{"frames":[
 {"name":"bot.up","ops":[
   {"op":"rect","x":5,"y":2,"w":6,"h":6,"fill":"palette:4","stroke":"palette:3","strokeWidth":1},
   {"op":"rect","x":4,"y":9,"w":8,"h":7,"fill":"palette:1"},
   {"op":"rect","x":5,"y":16,"w":2,"h":3,"fill":"palette:3"},
   {"op":"rect","x":9,"y":16,"w":2,"h":3,"fill":"palette:3"}]},
 {"name":"bot.down","ops":[
   {"op":"rect","x":5,"y":2,"w":6,"h":6,"fill":"palette:4","stroke":"palette:3","strokeWidth":1},
   {"op":"rect","x":4,"y":9,"w":8,"h":7,"fill":"palette:1"},
   {"op":"rect","x":3,"y":16,"w":2,"h":3,"fill":"palette:3"},
   {"op":"rect","x":10,"y":16,"w":2,"h":3,"fill":"palette:3"}]}]}
注意上例：**头与躯干的 ops 两帧完全相同**，只有腿的 x 变了。这就是帧间一致性。`;
}

/**
 * ⚠️ **键集就是 `keyof CharacterDNA`** —— 契约加一格而这里不补，**编译就过不去**。
 *   「8 个字段一个都不许漏」这条在这一层因此不是纪律，是**类型**（票 13 的 Q3 把这一条收紧了）。
 */
const DNA_HINTS: Record<keyof CharacterDNA, string> = {
  id: "**内部键** —— ⚠️ **不要把它画进图里**（图上不许出现任何文字）",
  identity: "**它是谁** —— 这是全世界唯一说得出这一格的地方（世界语法里只有「角色怎么画」，没有「谁」）",
  silhouette: "形态语言（**画法**：头形、边缘、量感），不是数值比例",
  face: "脸部画法",
  clothing: "穿着",
  gear: "携带物 / 器械 / 佩戴物",
  palette: "它身上的颜色",
  visualConstraints: "这个角色**特有**的追加约束（⚠️ **叠加**在世界约束之上，不是替代）",
};

/**
 * **角色基因的八个字段**逐个摊开（票 13 的 Q3：人类把这一条收紧了 —— **八个，不是七个**）。
 *
 * ⚠️ `id` 也在台账里：它是这条链上**认人用的键**（`GameDesignSpec` 的实体 id = `CharacterDNA.id`
 *   = `AssetSpec.characterId`，票 04 那条链）⇒ 它必须被点出来。而它下面那句「不要画进图里」
 *   是必需的 —— 模型会照着字面把文字画上去，而「图上一个字都不许有」是本文件每一份模板的头一条。
 *
 * ⚠️ **`palette:N` 要翻译成色值**：模型不认 `palette:3` 这个说法，它认颜色。
 *   世界的色板在 `StyleSpec.palette`（那份**有序数组**）里 —— 这正是「颜色只有一个来源」的落点。
 */
export function dnaBrief(dna: CharacterDNA, style: StyleSpec): string {
  /** `"none"` 不是「随便画」，是**写下来的不存在**（票 04 Q2）—— 要翻成人话，别原样丢给模型。 */
  const norm = (v: string) =>
    v.trim().toLowerCase() === "none" ? `**没有**（契约里写的是 \`"none"\` —— 那就**别画它**）` : v.trim();
  const colors =
    dna.palette.length === 0
      ? "（没指定 —— 从世界的色板里挑最像这个角色的几个）"
      : dna.palette
          .map((ref) => style.palette[Number(ref.slice("palette:".length))] ?? ref)
          .join("  ");
  const values: Record<keyof CharacterDNA, string> = {
    id: `\`${dna.id}\``,
    identity: dna.identity,
    silhouette: norm(dna.silhouette),
    face: norm(dna.face),
    clothing: norm(dna.clothing),
    gear: dna.gear.length === 0 ? "**没有**（清单是空的）" : dna.gear.join("；"),
    palette: colors,
    visualConstraints: dna.visualConstraints.length === 0 ? "（没有追加约束）" : dna.visualConstraints.join("；"),
  };
  return Object.entries(DNA_HINTS)
    .map(([k, hint]) => `- \`${k}\`（${hint}）：${values[k as keyof CharacterDNA]}`)
    .join("\n");
}

/** 风格约束块。**生成与推导共用同一份** —— 两处各写一份必然漂移。 */
export function styleBrief(style: StyleSpec): string {
  const pick = (k: keyof StyleSpec) => JSON.stringify(style[k] ?? []);
  return `参考图提取出的视觉语法（必须遵守）：
identity: ${pick("identity")}
shapeLanguage: ${pick("shapeLanguage")}
material: ${pick("material")}
constraints: ${pick("constraints")}`;
}

/**
 * 角色的头身比 —— **从 `spec.size` 推**，不读 `StyleSpec.characterStyle` 的自由文本。
 *
 * 票 22 的裁决：`characterStyle` 是自由文本，模型读到了也不执行
 * （实测：参考图说 "~6 heads"，生成出来是 ~3 头身的积木人）。
 * 而 32×48 的画布本来就画不下 6 头身 —— **画布尺寸才是那个真正的约束**。
 * 所以：让它当自由文本进风格约束，数值从尺寸推。
 */
export function headCount(height: number): number {
  return Math.max(2, Math.min(5, Math.round(height / 12)));
}

/**
 * 一次生成要画哪些帧。顺序即播放顺序，**帧名就是交付态图集里的键**。
 *
 * ⚠️ **全仓库只此一份**（`game-creation-v1` 那张图的票 40 抓到的）：它曾经在 `prompt.ts` 与 `pack.ts` 各有一份，
 * 而 `game-creation-v1` 的票 42 给 `pack.ts` 加「分层背景」那一支时**只改了一半** —— 于是提示词告诉模型
 * 「只需一帧」，而组装侧期待三帧，模型给一帧、组装抛「清单说要 3 帧、生成器给了 1 帧」。
 * 两边各写一份必然漂移，这一次漂的是**提示词与组装之间**。
 *
 * ⚠️ **「只此一份」说的是 drawlist 那一侧**。生图那一侧的同一套分类骨架住在
 *   `contracts` 的 `imageUnitsOf()`（票 40），而两者**粒度不同、不许合并**：
 *   这里 `animation` **一帧一份**（4 帧 → 4 份），那边**一个动画一份**（4 帧 → **1 次调用**）。
 *   那个区别**有钱的含义**（这份不花钱，那份一次一笔），合并会把两件事重新说成一件。
 *   ⚠️ 上面那个「票 40」是 `game-creation-v1` 的，**不是**抽出 `imageUnitsOf` 的那张票
 *   （`game-maker-v2` 的票 40）—— 两张图今天都有 40/41/42，别找错。
 */
export type FramePlanEntry = {
  /** 帧名 —— **也是交付态图集里的键**。 */
  name: string;
  /** 属于哪个动画；`null` = 不属于动画（单帧资源，或分层背景的某一层）。 */
  anim: string | null;
  /** 背景的层名（从远到近）；`null` = 不是分层背景。 */
  layer: string | null;
  index: number;
  total: number;
};

export function framePlan(spec: AssetSpec): FramePlanEntry[] {
  if (spec.kind === "animation") {
    return spec.animations.flatMap((a) =>
      Array.from({ length: a.frames }, (_, i) => ({
        name: `${spec.id}.${a.name}${a.frames > 1 ? i + 1 : ""}`,
        anim: a.name, layer: null, index: i, total: a.frames,
      })));
  }
  // 分层背景：**一层一帧**，帧名 `<资源 id>.<层名>`（与动画的帧命名规则同构）。
  if (spec.kind === "background" && spec.layers) {
    const layers = spec.layers;
    return layers.map((l, i) => ({ name: `${spec.id}.${l.name}`, anim: null, layer: l.name, index: i, total: layers.length }));
  }
  return [{ name: spec.id, anim: null, layer: null, index: 0, total: 1 }];
}

/** 把一段 prompt 要的资源描述出来 —— 生成器的任务块。 */
export function assetTask(spec: AssetSpec, style: StyleSpec): string {
  const plan = framePlan(spec);
  // 判别式收窄：`layers` 只有背景有，而 `plan.map` 那个回调是跨四类共用的
  const bgLayers = spec.kind === "background" ? spec.layers : undefined;
  const lines = plan.map((p, i) =>
    p.layer !== null
      // ⚠️ **这一层自己那句也带上**（票 02）—— 与生图那条路**读同一个字段**。
      //   一个字段在一条路上被采纳、在另一条上被默默忽略，是「一个决定两个住址」的另一种写法。
      ? `  第 ${i + 1} 帧（层名 ${p.layer}）：从远到近的第 ${p.index + 1}/${p.total} 层` +
        `${bgLayers?.[p.index]?.description ? ` —— ${bgLayers[p.index]!.description}` : ""}`
      : `  第 ${i + 1} 帧：${p.anim === null ? "唯一的一帧" : `${p.anim} 动作的第 ${p.index + 1}/${p.total} 帧`}`);
  const heads = headCount(spec.size.h);
  const shape = spec.kind === "animation"
    ? `这是**一个**资源的 ${plan.length} 帧 —— **必须一次给出全部帧**，它们必须是同一个东西在不同时刻的样子。`
    : plan.length > 1
      ? `这是**一个**背景资源的 ${plan.length} 层（从远到近）—— **必须一次给出全部层**，它们叠起来才是完整画面。`
      : `这是**一个**静态资源，只需一帧。`;

  // 分层背景最容易画错的地方：模型会把画布横切成三条各画各的。
  // 而契约是「**每层都画满整块画布、没有东西的地方留空**」，靠透明叠出层次
  // —— 不然壳子按住一层平铺时，会把它旁边那条别的层也一起平铺出去。
  const layered = plan[0]?.layer != null
    ? `
⚠️ 每一层都画在**同一块 ${spec.size.w}×${spec.size.h} 的画布**上：这一层没有东西的地方**留空**
 （不写任何 op），上层透明的地方自然露出下层。**不要把画布横切成几条各画各的** ——
 壳子会拿单独一层去横向平铺，切开的画布会让它把别的层也铺出去。
 从远到近：${plan.map((p) => p.layer).join(" → ")}。

⚠️ **最远那一层（${plan[0]!.layer}）是上面那条的例外**：它后面**什么都没有** ——
 那里没画到，玩家看到的就是**外壳的底色**。所以它要**铺满整块画布**（一直画到每一条边、每一个角）。
 ⚠️ 生图那条路对最远层**另说一套**（\`backgroundLayerPrompt\` 的 \`isFarthest\`）而这条路此前**没有** ——
 实测（\`experiments/drawlist-layers/\`）：不带这一句时，最远层会缩成**中间一条带**（一次 56.1%，
 按「最远层必须画满」那条会**被拒**）。其余层照上面那条留空，一层都不要学它。`
    : "";

  // 九宫格：四边原样保留、只有中央被拉伸 —— 所以边框要规整、中央要平。
  const nine = spec.kind === "ui" && spec.ninePatch
    ? `
⚠️ 这个 UI 资源是**九宫格**：左/右/上/下各内缩 ${spec.ninePatch.left}/${spec.ninePatch.right}/${spec.ninePatch.top}/${spec.ninePatch.bottom} 像素。
 **四边会被原样保留，只有中央区会被拉伸到任意尺寸**。所以四条边框要**完全平行、等宽、对齐**，
 中央区要**平坦且可任意重复**（纯色，或规整的等距点阵）；**不要**在中央画任何会被拉伸变形的图案或字。`
    : "";

  return `${shape}${layered}${nine}

画布 ${spec.size.w}×${spec.size.h} 像素（viewBox 与 expectedSize 都是 [0,0,${spec.size.w},${spec.size.h}]）。
这个资源是：${spec.description}（${spec.role}）。

按顺序给出这 ${plan.length} 帧：
${lines.join("\n")}

硬性要求：
- **锚点**：这个资源的参考点在归一化的 (${spec.anchor.x}, ${spec.anchor.y})，
  换算到画布就是**第 ${(spec.anchor.y * spec.size.h).toFixed(1)} 行**、第 ${(spec.anchor.x * spec.size.w).toFixed(1)} 列。
  **站着、坐在、立着的东西，底边就压在那条横线上** —— 画高了会让它悬空，画低了会陷进地里，
  而壳子只会把那条线对齐地面（**不会**替你从墨迹里猜）。**腾空的帧例外**（jump 之类的跳起动作），
  那时底边要明显离开那条线。
- 帧间一致性：**不属于动作的部分（躯干、部件、配色、描边）要原样复用**，只改该动的部位。
- 轮廓清晰，带 1 像素深色描边；不要平涂一整块，用 dither 做出材质与阴影过渡。
- 角色类资源按 **约 ${heads} 头身**的比例画（由画布尺寸决定，不要照抄别的比例）。
- 每一帧至少 10 个 op，不要潦草。`;
}

/**
 * 抠背景用的底色 —— **必须不在世界色板里**。
 *
 * ⚠️ 这是个安全性质，不是美观问题：`keyBackground` 是**全局比色、不是连通域**，
 * 底色若同时是主体用色，会把主体一起抠穿。实测：同类角色的一帧有 **73% 的像素
 * 就是世界色板的最暗色**，拿那一色当底等于把角色抠掉四分之三。
 * 而 `palette` 是提取出来的近似值，所以这里逐个试、取第一个不在色板里的。
 */
export function keyColorFor(palette: readonly string[]): string {
  const used = new Set(palette.map((c) => c.toLowerCase()));
  for (const c of ["#ff00ff", "#00ff00", "#ff0000", "#0000ff", "#ffff00", "#00ffff"]) if (!used.has(c)) return c;
  // 极端情况：色板把这六个都占了（现实中不会，但别让它静默产出一个错的底）
  throw new Error("找不到一个不在色板里的抠底色 —— 这份 StyleSpec 的色板把六个高饱和色全占了？");
}

/**
 * 生图路线的提示词。**从 spec + StyleSpec 渲染**，不是人贴一段。
 *
 * 与 drawlist 路线的 `assetTask` 是**两个渲染器**：那边要交代 op DSL，这边要交代
 * 「一张图、一个物体、底色是某个具体颜色」—— 两者的措辞没有可复用的部分，
 * 硬合成一个只会让两边都读不懂。共用的是 `styleBrief` 与 `paletteLine`。
 */
/**
 * 反向提示词。**这不是可选的润色** —— 实测：不加它时，模型会忽略正向的「单个物体、
 * 纯色背景、不要边框」，直接画一张带嵌套边框的场景插画（风格块里的 "nested panel frames"
 * 把它带跑了），而正向提示词再长也压不住。
 */
export function imageNegativePrompt(): string {
  return [
    "scene", "landscape", "room", "interior", "background scenery",
    "border", "frame", "picture frame", "panel", "vignette", "poster", "signage",
    "text", "letters", "words", "caption", "watermark", "logo", "UI",
    "multiple objects", "group of objects", "collection", "shelf", "table",
    "human figure", "character", "hands",
    "gradient", "smooth shading", "soft edges", "blur", "anti-aliasing",
    "photograph", "photorealistic", "3D render", "depth of field", "lens blur",
    "drop shadow", "cast shadow", "reflection", "specular highlight",
    "perspective", "isometric", "diagonal",
  ].join(", ");
}

/**
 * 生图路线的提示词。**从 spec + StyleSpec 渲染**，不是人贴一段。
 *
 * ⚠️ 两条实测教训写进了结构里：
 *  ① **背景规则必须在最前面。** 风格块里那些「只用这 9 个颜色」的要求会把"背景用某个
 *     不在色板里的纯色"这条盖掉，模型于是拿色板最暗色去涂背景 —— 抠图时把主体一起抠穿。
 *  ② **风格块只取与"单个物体"不冲突的字段。** 实测把 `shapeLanguage` 整段给它，
 *     里面的 "nested panel frames" 会让它画一张带边框的面板而不是一个物体。
 *
 * ⚠️ **所以下面那三张生图模板只取 `identity` / `material`**（`camera` 换成"正交、无透视"的一句）。
 *   `style.constraints` **故意不进这三张模板**（票 30 的裁定，2026-10-12）。
 *   ⚠️ **这一行以前写的是「只取 identity / material / constraints」** —— 那从第一天起就与代码不符
 *   （`git show 593c327` 那次提交里注释已经这么写，而模板已经只吐前两个）。票 30 裁的是**代码是现状**：
 *   那句话描述的是一个**从未实现过的意图**，改的是注释，不是模板。
 *   ⚠️ 理由是 `constraints` 是**唯一过不了上面 ② 那道筛的字段**：它是写给**这个世界**的自由文本，
 *   里面坐着与「画面里只有这一个物体」正面顶牛的话（panel 构图一类），而这三张模板是**按资产种类**
 *   分别调过的（背景层说「它是横版卷轴的一层」、单物体说「不要画成一整张插画」）。
 *   ⚠️ **代价是已知的、不是没想到**：`style.constraints` 里那几条**与资产无关**的要求
 *   （不许纯黑纯白、强调色面积上限）因此到不了这三张模板眼前。要守它们该去**量交付的图**，
 *   而不是读这段文本 —— 那是另一张票的题面（票 47，已收口）。
 *   ⚠️⚠️ **票 47 更正了这一行的说法**（人裁 2026-10-13）：这里以前写着「那几条今天**一条都没有执行者**」
 *   —— **不准确**。实测交付态：**210 份图集 · 10,903,643 个不透明像素里纯黑 0 个 · 纯白 0 个**
 *   （现行契约那两份包的非二值 alpha 也是 0）。守它们的是两个**不是为它们设的**机制：
 *   `quantizeToPalette`（交付的每个像素都被吸到色板项上）与 `thresholdAlpha`（二值化 ⇒ 交付态没有抗锯齿）。
 *   ⇒ **真正缺的不是执行者，是针对这些性质的**显式契约声明与验证责任** ——
 *   那两个机制各自有一个**没有契约约束的输入**：色板（模型写的，`packages/contracts` 里零规则）
 *   与 `alphaThreshold`。⚠️ 于是「成立」是**特定样本的测量事实，不是普遍保证**；
 *   保证的边界就是那条色板没见过任何规则。观察面见 `ops.ts` 的 `paletteUsage`（票 47 加了色板外像素）。
 *   ⚠️ 而「强调色面积上限」那一条更靠前就断了：`vision/src/prompts.ts` **明令**模型不许写
 *   「某色面积 < X%」这类数值上限（理由：那会把重音色当污染物）⇒ 这种句子**只可能来自人手写的 fixture**，
 *   V2 链上**生不出来** ⇒ 链上没有执行者，是因为**目标对象不存在**。
 *   ⚠️ **范围只有这三张**：母版那一发（`master.ts` 的「世界的约束」那段）递了 `style.constraints`，
 *   那是**另一个调用点** —— 它的来源与意图**未确认**、原样不动（票 30 的 Q2 判「不处理」）。
 *   ⚠️ 另：VWS 里坐着**两张**同名 `constraints`；这里说的是 `StyleSpec` 里那张（顶层那张喂的是 DNA）。
 *   裁定原文见 `.scratch/game-maker-v2/issues/30-constraints-not-in-image-prompt.md`。
 */
/** 这次画的是**哪一个东西** —— 一段动画，或者分层背景的某一层。
 *  ⚠️ 票 13 多了一样：**这个角色是谁**（`dna`）。它**只在有值时用**（见 `dnaBrief`）。 */
export type ImagePromptTarget = {
  anim?: string;
  layer?: { name: string; index: number; total: number; tileX: boolean };
  /** 这个资产的角色的基因。⚠️ 由 `pack` 按 `spec.characterId` 解析后递进来 —— 这一层不读磁盘。 */
  dna?: CharacterDNA;
};

export function imagePrompt(spec: AssetSpec, style: StyleSpec, target: ImagePromptTarget = {}): string {
  if (spec.kind === "animation") return animationSheetPrompt(spec, style, target.anim, target.dna);
  // ⚠️ 分层背景走**独立模板**（票 43）。不能在单物体那份上打补丁：那一份的头一条是
  //   「物体占满整个画面」，而一层背景的头一条恰恰是「**没东西的地方留空**」——
  //   同一份提示词里写两条互相打架的规矩，模型只会执行一条（动画那一支已经吃过一次这个亏）。
  if (spec.kind === "background" && spec.layers && target.layer) return backgroundLayerPrompt(spec, style, target.layer);
  return singleObjectPrompt(spec, style);
}

/**
 * 分层背景的**一层**（票 43）。
 *
 * 要交代三件事，缺一条都会画坏：
 *   ① **画的是哪一层**（从远到近第几层、叫什么）—— 否则模型画的是整张场景
 *   ② **这一层没有东西的地方留空**（= 抠底色）—— 否则它会把背景填满，层就叠不出层次
 *   ③ 可平铺的层**左右要接得上** —— 否则每 480px 一道硬缝
 *
 * ⚠️ 生图路线在这里有一样**天然的好处**：它本来就要抠底色（`keyBackground`），
 *   而抠背景是**全局比色**——所以「没东西的地方」抠完就是**透明**的，
 *   与「每层画满整块画布、靠透明叠出层次」那条契约**天然对得上**，不用额外做什么。
 */
function backgroundLayerPrompt(
  spec: Extract<AssetSpec, { kind: "background" }>, style: StyleSpec,
  layer: { name: string; index: number; total: number; tileX: boolean },
): string {
  const bg = keyColorFor(style.palette);
  // ⚠️ **最远那层要另说一套**（票 51，四次真跑量出来的）：
  //
  //   通用那段里的禁色清单含**「天空色」** —— 对其它层是对的（墙的空白处不许拿天色糊上去，
  //   那会盖住真正的天层），但对**天层**它字面上就是「**别画天空**」✗。
  //   实测：三种「把话说硬」的改法（加硬「画满」· 改成「天空就是内容」）**全都没用**（66.9–70.3%），
  //   而**只拆掉那一句** ⇒ **100%**。
  //
  //   ⚠️ 所以这里是**另一段文字**，不是「通用那段 + 一句覆盖」——
  //   自相矛盾的提示词模型只执行一条（第三次实验就是这么失败的，动画那一支也吃过一次）。
  const isFarthest = layer.index === 0;
  // ⚠️ **这一层自己的描述**（2026-09-30 · 票 02）：给了就用它，没给才回落到整张场景那份。
  //   ⚠️ 而**回落到整张场景时才带上 `role`**：`role` 写的是**整张背景**是什么
  //   （「三层视差背景：远天、候车室外墙、站台地面与铁轨」）—— 把它接在一层的描述后面，
  //   等于又把整张场景塞了回来，而那正是这一票在修的东西。
  const own = spec.layers?.[layer.index]?.description;
  const keyRule = isFarthest
    ? `⚠️⚠️ 最重要的一条，请先读它：**这一层就是「天空」** —— **天空本身就是你要画的东西**，
   不是「没有东西的地方」。整块画布从头到尾都要是画出来的颜色：天要**铺满到每一条边、每一个角**。
   不要拿白、灰、渐变去填（⚠️ **但天色本身除外 —— 它就是这一层的内容**）。
   ⚠️ 除「天空之外、确实不属于这一层的东西」以外，**不要出现纯色 ${bg}**。`
    : `⚠️⚠️ 最重要的一条，请先读它：**这一层没有东西的地方，必须是纯色 ${bg}**。
   不要拿白、灰、渐变、天空色或地面色去填 —— 就是纯色 ${bg}，把空白处整块填满。
   ⚠️ 反过来：**这一层里真正画出来的东西**上，一个 ${bg} 的像素都不许出现。`;

  const edge = layer.tileX
    ? `⚠️ 这一层在**横向上可以平铺**（游戏里会把它左右重复铺满整条街），
   所以**左边缘与右边缘必须接得上** —— 接缝处不要有突然的断裂、也不要明显的重复标记。`
    : `这一层**不平铺**（只画这一次），左右边缘不必接缝。`;
  return `画一张游戏**横版卷轴场景的其中一层**。画布长宽比必须精确是 ${spec.size.w} : ${spec.size.h}。

${keyRule}
   管线会把 ${bg} 抠成**透明**，所以 ${bg} 的地方在游戏里是"透过去"露出后面那一层。

这是这个世界的一个多层场景里，从远到近的**第 ${layer.index + 1} / ${layer.total} 层**，
这一层叫 **${layer.name}**。

这一层要画的东西：${own ?? `${spec.description}（${spec.role}）`}
${isFarthest ? "⚠️ 它后面**没有别的东西**了 —— 没有画到的地方，玩家看到的就是一片底色。" : ""}
${edge}

画出来的东西**只用**下面这些颜色（空白的 ${bg} 是唯一例外）：
${style.palette.join("  ")}

这个世界的视觉语法：
identity: ${JSON.stringify(style.identity)}
material: ${JSON.stringify(style.material)}

画法：硬边色块、边缘干净利落、不要抗锯齿、不要柔边、不要渐变、不要写实照片质感、不要景深。
**平视、正交投影、不要透视** —— 它是横版卷轴的一层，不是一张插画。

再强调一次：**没东西的地方**是纯色 ${bg}（会被抠成透明），
而**画出来的东西**上不要出现 ${bg}。`;
}

/** 单帧资源：就一件道具，像贴图那样单独摆着。 */
function singleObjectPrompt(spec: AssetSpec, style: StyleSpec, dna?: CharacterDNA): string {
  const bg = keyColorFor(style.palette);
  return `画一张游戏用的**单个物体**贴图，占满整个画面，四周只留很窄的一圈空白。

⚠️⚠️ 最重要的一条，请先读它：**背景必须是纯色 ${bg}**。
   整张图的背景区域要被这个颜色填满，不要渐变、不要噪点、不要纹理、不要图案。
   背景上不要出现任何东西：没有墙、没有地面、没有影子、没有边框、没有文字、没有水印。
   列表里的其他颜色**一个都不要**用来画背景。

这个物体是：${spec.description}（${spec.role}）${dna === undefined ? "" : `\n\n⚠️ 这个物体**属于角色 ${dna.id}** —— 它是那个角色身上的东西，画法与配色要跟那个角色一致：\n${dnaBrief(dna, style)}`}

画面里**只有这一个物体**，不要画场景、不要画房间、不要画货架、不要加画框或边框、
不要画成一整张插画。就是一件道具，像游戏贴图那样单独摆着。

这个物体的**外接矩形**长宽比必须**精确**是 ${spec.size.w} : ${spec.size.h}（宽 : 高）——
交付管线会把它两方向独立缩放到 ${spec.size.w}×${spec.size.h} 像素，比例不对就是硬拉伸。

这个物体**本身**的颜色只用下面这些：
${style.palette.join("  ")}
（注意：这条是给**物体**定的，背景的 ${bg} 是唯一的例外。）

这个世界的视觉语法（只用于物体本身的配色与质感）：
identity: ${JSON.stringify(style.identity)}
material: ${JSON.stringify(style.material)}

画法：硬边色块、边缘干净利落、不要抗锯齿、不要柔边、不要渐变、不要写实照片质感、
不要体积光、不要景深。正视角度、正交投影、不要任何透视。

再强调一次：背景是纯色 ${bg}，而这件物体上**不要**出现 ${bg} 这个颜色。`;
}

/**
 * 一个动画：**一排 N 个同一个角色**。
 *
 * ⚠️ 这一支**必须**是独立的模板，不能在单物体那份上打补丁 —— 实测打过一次补丁，结果是
 * 同一份提示词里既写着「横排 4 个角色」又写着「画面里只有这一个物体」，模型只给回来 1 个。
 * 两处的画布长宽比也**不一样**：单帧说的是物体的比例，这里说的是**每个角色**的比例
 * （画布本身是 N 倍宽的横条）。
 */
function animationSheetPrompt(spec: AssetSpec, style: StyleSpec, animName?: string, dna?: CharacterDNA): string {
  const bg = keyColorFor(style.palette);
  if (spec.kind !== "animation") throw new Error("animationSheetPrompt 只用于 animation 资源");
  const anim = animName === undefined ? spec.animations[0]! : spec.animations.find((a) => a.name === animName);
  if (!anim) throw new Error(`spec 里没有动画 "${animName}"`);
  const n = anim.frames;
  // ── 票 01：**固定网格**与旧的「横排一排」是两套排版说法 ─────────────────────
  // ⚠️ 不能两份都留在同一段提示词里（「网格」与「横向排开」同时说，模型只执行一条 ——
  //   这一支已经吃过一次「4 个角色 + 只有 1 个物体」的亏）。省略 `sheet` ⇒ 旧文字**逐字不变**。
  const sheet = anim.sheet;
  // 票 16 的 A：`rows=1` 走**单行等距排开**，不叫「网格」——
  // ⚠️ 2.5 听到「网格」会画格线、编号，并把 4×2 画成 4×3（2026-10-19 真跑证据）。
  const oneRow = sheet !== undefined && sheet.rows === 1;
  const layout = sheet === undefined
    ? `画一张**横排的游戏角色动画分解图**：横向排开 **${n} 个**格子，每格画同一个角色在
「${anim.name}」这组动作里一个连续瞬间的样子。整张图共 ${n} 个角色，不多不少。`
    : oneRow
      ? `画一张**横向等距排开的游戏角色动画分解图**：一行排开 **${n} 个**角色，
每个角色是同一个角色在「${anim.name}」这组动作里一个连续瞬间的样子。整张图共 ${n} 个角色，不多不少。
**从左到右**：第 1 个是第 1 帧，逐个递增到第 ${n} 帧。
**每两个角色之间留出纯色 ${bg} 的空隙**；不要画任何分隔线、边框、编号或文字。`
      : `画一张**固定网格的游戏角色动画分解图**：**${sheet.columns} 列 × ${sheet.rows} 行**，共 **${n} 个格子**，
每格画同一个角色在「${anim.name}」这组动作里一个连续瞬间的样子。整张图共 ${n} 个角色，不多不少。
**按行优先排列**：先第一行从左到右，再第二行，依此类推 —— 第 1 格是第 1 帧，逐格递增到第 ${n} 帧。
**每一格恰好一个角色**，放在格子中央；格与格之间必须留出纯色 ${bg} 的空隙。`;
  return `${layout}

⚠️⚠️ 最重要的一条，请先读它：**背景必须是纯色 ${bg}**，整张图铺满，不要渐变、不要噪点、
   不要纹理、不要图案、不要格线、不要编号、不要文字、不要水印、不要边框。
   ${n} 个角色之间要留出**明显的空隙**（背景色露出来），这样才切得开。
   ${sheet === undefined ? "" : oneRow
     ? `⚠️ 这是一行**等距排开**的角色 —— 画面里**没有任何分隔线、边框、编号、文字**。
   ${n} 个角色之间必须留出明显的空隙；每个角色完整、互不重叠。`
     : `⚠️ 这是一张**固定网格**：${sheet.columns} 列 × ${sheet.rows} 行。
   **格子的边界只存在于排版里** —— 不要画格线、不要画格子边框、不要编号、不要写帧号或文字。
   每一格里的角色都必须完整落在这一格内，不要越过格子边界。`}
   画面里**除了这 ${n} 个角色本身的像素，别的都不要有**：不要画地面、地平线、街道、
   阴影、底座连线，也不要画任何横贯画面的线或带。
   列表里的其他颜色**一个都不要**用来画背景。

${dna === undefined
    // ⚠️ **回落**：没有 DNA 就照旧用 `spec.description` —— 8 份 fixture 与「人给一张参考图」
    //   那条老路因此一字不改（票 13 的 Q3）。
    ? `这个角色是：${spec.description}（${spec.role}）`
    // ⚠️ **有 DNA 就替换，不是叠加**：同一条提示词里写着两个身份源，模型只会执行一条
    //   （那次「既说 4 个角色又说只有 1 个物体」的教训）。
    : `这个角色是：\n${dnaBrief(dna, style)}

⚠️ 上面身份描述里若提到「地面 / 街道 / 来回走」之类，那是在说它**怎么动**，
   不是让你把地面画出来 —— 这一张图里**只有 ${n} 个角色**。`}
这一张图**只画这组动作**「${anim.name}」；本图角色数就是上面那个数，与别的动作组无关。

硬性要求：
- ${n} 个角色**长得一模一样**：脸、帽子、衣服、配色、描边、像素尺度全都不能变，
  只有四肢的姿势不同。
- ${n} 个角色的**大小一致**，脚底**对齐到同一个高度**，不要有的高有的矮。
  ⚠️ 只是**位置对齐** —— **不要**在脚下画线、地面、地平线或阴影来表示对齐。
- 每个角色的**外接矩形**长宽比必须**精确**是 ${spec.size.w} : ${spec.size.h}（宽 : 高）。
  ${sheet === undefined
    ? `画布本身是横条（${n} 个并排），但每个角色自己的比例要守住 ——`
    : oneRow
      ? `画布本身是一行（${n} 个并排，每个角色 ${spec.size.w} : ${spec.size.h}），每个角色自己的比例要守住 ——`
      : `画布本身是 ${sheet.columns} 列 × ${sheet.rows} 行的网格（每格 ${spec.size.w} : ${spec.size.h}），每个角色自己的比例要守住 ——`}
  交付管线会把它两方向独立缩放到 ${spec.size.w}×${spec.size.h} 像素。

角色**本身**的颜色只用下面这些：
${style.palette.join("  ")}
（注意：这条是给**角色**定的，背景的 ${bg} 是唯一的例外。）

这个世界的视觉语法（只用于角色本身的配色与质感）：
identity: ${JSON.stringify(style.identity)}
material: ${JSON.stringify(style.material)}

画法：硬边色块、边缘干净利落、不要抗锯齿、不要柔边、不要渐变、不要写实照片质感、
不要体积光、不要景深。**侧视、朝右**、正交投影、不要任何透视。

再强调一次：${n} 个角色，背景纯色 ${bg}，角色身上**不要**出现 ${bg} 这个颜色。`;
}

/**
 * **逐帧**生图提示词（票 17）：一次调用只画**一帧**。
 *
 * ⚠️ 与 `animationSheetPrompt` 是两套模式：那边要求「一图 N 帧」，模型守不住数量/排版
 *   （2026-10-19 三次真跑的实测）；这里只要**一个角色**，帧数交给调用方按 framePlan 收集。
 * ⚠️ 仍然要求**侧视 / 朝右 / 同一个角色的形象**；母版参考图由 pack 递进来。
 */
export function animationFramePrompt(
  spec: AssetSpec, style: StyleSpec, animName: string, frameIndex: number, dna?: CharacterDNA,
): string {
  const bg = keyColorFor(style.palette);
  if (spec.kind !== "animation") throw new Error("animationFramePrompt 只用于 animation 资源");
  const anim = spec.animations.find((a) => a.name === animName);
  if (!anim) throw new Error(`spec 里没有动画 "${animName}"`);
  const n = anim.frames;
  // ⚠️ **角色 vs 物件**（票 17 的逐帧冒烟）：废料 / 净水 / 终端没有 `characterId`，
  //   若这里仍说「画一个角色」，模型会照着画人（第三次单行真跑的 scrap 就是 5 个人）。
  //   没有 `characterId` / DNA 的一律按**物件**说。
  const isCharacter = dna !== undefined || spec.characterId !== undefined;
  const noun = isCharacter ? "角色" : "物件";
  const who = dna === undefined
    ? `这个${noun}是：${spec.description}（${spec.role}）`
    : `这个角色是：\n${dnaBrief(dna, style)}`;
  return `画一张**单个游戏${noun}**的像素画：同一个${noun}在「${anim.name}」这段动画的**第 ${frameIndex + 1} 帧 / 共 ${n} 帧**。
整张图**只有一个${noun}**；不要多帧、不要分隔线、不要边框、不要编号、不要文字。
背景必须是纯色 ${bg}，整张图铺满；不要渐变、不要噪点、不要纹理、不要图案、
不要地面、不要地平线、不要阴影、不要横线。

${who}

${noun}的**外接矩形**长宽比必须**精确**是 ${spec.size.w} : ${spec.size.h}（宽 : 高）；
交付管线会把它两方向独立缩放到 ${spec.size.w}×${spec.size.h} 像素。

${noun}**本身**的颜色只用下面这些：
${style.palette.join("  ")}
（注意：这条是给**${noun}**定的，背景的 ${bg} 是唯一的例外。）

这个世界的视觉语法（只用于${noun}本身的配色与质感）：
identity: ${JSON.stringify(style.identity)}
material: ${JSON.stringify(style.material)}

画法：硬边色块、边缘干净利落、不要抗锯齿、不要柔边、不要渐变、不要写实照片质感、
不要体积光、不要景深。${isCharacter ? "**侧视、朝右**、正交投影、不要任何透视。" : "正交投影、不要任何透视。"}

再强调一次：**只有一个${noun}**，背景纯色 ${bg}，${noun}身上**不要**出现 ${bg} 这个颜色。`;
}

/**
 * `derive` 那份清单的**形状说明**（`asset-recipe/v1` 按类可以另加哪些键）。
 *
 * ⚠️ **它为什么被提出来**（原本是 `ops.ts` 里 `deriveRecipe` 的一段内联字符串）：
 *   [票 08](.scratch/td-compile-v1/issues/08-ninepatch-on-ui.md) 量到 ——
 *   **提示词把 `ninePatch` 与 `animations` / `layers` 并列写成「ui 的形状」**，
 *   于是三张 derive 出来的清单里 **ui 百分之百都带它**，
 *   而九宫格那段文字要求模型「中央平坦、不要画图案」⇒ **16×16 的图标被画成了一圈空心框**。
 *   ⇒ 修法要**同时钉住两边**（ui 那头不许再当必填、面板那头必须保留「该写它」的说法），
 *   而**能被测试钉住的前提是它是数据、不是一段埋在模板串里的散文** —— 所以它搬到了这里。
 */
/** 样板里的一层背景。⚠️ 与 `contracts` 的 `LayerDrawInput` 同形（`tileable` 缺省 = 不平铺）。 */
export type RecipeSampleLayer = {
  name: string;
  parallax: number;
  tileable?: { x: boolean; y: boolean };
};

/**
 * 样板那份**背景层** —— ⚠️ **它是数据，不是散在字符串里的散文**（[票 88](.scratch/game-maker-v2/issues/88-recipe-shape-sample-as-data.md) 的 Q2 逐字：
 *   「样板应从模板字符串中提取为**可直接测试的数据**，再将组合输入 `auditLayerCoverage`，验证其形状合法」）。
 *
 * ⚠️ **为什么它必须是数据**：同一条理由，票 08 已经在**上一层**用过一次 ——
 *   上面那段注释逐字写着「能被测试钉住的前提是它是数据、不是一段埋在模板串里的散文」。
 *   今天差的正是这一层：`recipeShapeSpec()` 本身是数据驱动的，而**它里面那三层还是散文**
 *   ⇒ **没有任何东西看着它与段 B 那个世界合起来成不成立**（[票 76](.scratch/game-maker-v2/issues/76-cross-stage-sample-conflict.md) 量到的那个形状就是这么漏出去的：
 *   全仓四份带层的背景，**唯一不合规的就是这段样板**，而两份真产物**独立地**都抄了它）。
 *
 * ⭐ **这份形状与唯一通过整条链的那份手写夹具逐格同形**
 *   （`fixtures/packs/last-train/v2` 的 `bg-dusk-halt`：`sky p0` · `wall p0.6 铺x` · `ground p1 铺x`）。
 * ⚠️ **它是三层，而层数并不强制** —— 那份提示词另一处逐字写着「层数按画面需要定」。
 *   这里给三层，是因为**中间那一格正是两份真产物翻车的地方**（票 76 读数 ④：`parallax: 0.4` 且不铺、各剩 96px）
 *   ⇒ 只把最远那层改成 `0` 会**留下一个宽泛示范**，而那是人裁明令要避免的
 *   （票 76 Q1 逐字：「不能只把 `sky.parallax` 从 `0.3` 改为 `0`，却留下「天空不平铺」的宽泛示范」）。
 */
export const RECIPE_SAMPLE_BACKGROUND: readonly RecipeSampleLayer[] = [
  { name: "sky", parallax: 0 },
  { name: "wall", parallax: 0.6, tileable: { x: true, y: false } },
  { name: "ground", parallax: 1, tileable: { x: true, y: false } }
];

/** 把样板那三层渲染成提示词里那一行 —— 换行后的缩进与 `background → "layers":[` 结尾**对齐（25 列）**。
 *  ⚠️ **改列宽要连着改渲染**：那是**模型读到的字**，不是排版。 */
const renderSampleLayers = (): string =>
  RECIPE_SAMPLE_BACKGROUND.map((l) => JSON.stringify(l)).join(",\n" + " ".repeat(25));

export const recipeShapeSpec = (): string => `每个 spec 只许有这些键：kind / id / role / description / styleId / anchor / size / required。
按类可以另加，且**形状必须逐字如下**：
  animation  → "animations":[{"name":"walk","frames":4,"fps":8,"loop":true}, ...]
               ← 可选 \`sheet\`：\`{"columns":2,"rows":2}\` —— 这次生图按**固定网格**排版，
                 \`columns × rows\` 必须等于这个动画的 \`frames\`（省略 = 旧的按墨迹间隙切）；
                 只对 \`source.kind:"image"\` 有意义。
  background → "layers":[${renderSampleLayers()}]
               ← **数组**，每项是对象，**从远到近**排序；层名会拼成帧名 \`<资源 id>.<层名>\`
               ← ⚠️ **视差与平铺必须配对**：**不平铺的层，\`parallax\` 必须是 \`0\`**；
                 要正视差（跟着镜头动）的层**必须写 \`tileable\`**，或把**这件资源**画得足够宽
                 —— 世界比屏幕宽，不平铺又不铺满的层，镜头走到头就会露白，配置会被拒收。
  ui         → **没有必须加的键**（见下面那段）
**多余一个键、或形状不对，就会被拒收。**

⚠️ **「九宫格」是可选的，而且只有「会被拉伸到任意尺寸」的那种 ui 才写它。**
  写的形状是：\`"ninePatch":{"left":4,"right":4,"top":4,"bottom":4}\` ——
  四边按原样保留，**只有中央区被拉伸**。

  ✅ **该写**：面板、按钮底板、状态栏那一类 —— 它们会被拉伸到任意尺寸（宽高由关卡定）。
  ❌ **不该写**：**图标、指示符、指针、装饰框**这一类 —— 它们**按原尺寸画**，不会被拉伸。

  ⚠️ 而且它不是「渲染时才生效的元数据」：**写了它，这张图就会按九宫格的规矩来画** ——
  四边必须等宽对齐，**中央区必须平坦且可任意重复，中央不许画任何图案或字**。
  一枚 16×16 的图标写了它，中央就只剩 8×8 且不许画东西
  ⇒ **画出来会是一圈空心框，而不是一个图标**。

  ⇒ 判据只有一条：**这件东西会不会被拉伸到任意尺寸？** 会，才写。`;

// ── 塔防关卡编译：数值参考刻度 ＋ 提示词（票 04 · 05）──────────────────────────

/**
 * **数值参考刻度** —— 给模型的「这一关的数值该在什么量级上」。
 *
 * ⚠️ **它是参考，不是规定**（票 04）。而它最值钱的那条**不是一个数，是一个方向**：
 *   实测（`probe/td-sweep.mjs`）**往「塔更弱 / 敌人更强」的方向余量只有 1.3–1.6 倍，
 *   往反方向 ≥10 倍** —— 所以「拿不准时宁可把敌人写弱、把塔写便宜」是一句**量出来的**话，
 *   不是口味。
 *
 * ⚠️ **区间必须与真关卡不漂**：`packages/assets/tests/prompt.test.ts` 断言
 *   `fixtures/td-configs/counter-siege.json` 的每一个值都落在这些区间里 ——
 *   谁把关卡重调出区间，测试就红，逼他同时改这里。
 *   （⚠️ 断言的是「与**真的、过得了 schema 的**那一关一致」，不是「它自己过 schema」——
 *     刻度本来就不是一份配置。）
 */
export const TD_REFERENCE_SCALE = {
  /** 机关的伤害（每一级的单发）。 */
  damage: { min: 3, max: 20 },
  /** 敌人的血量。 */
  hp: { min: 14, max: 70 },
  /** 平减护甲。⚠️ **个位数**，不是两位数 —— 它 ≥ 伤害时游戏会变成磨（只靠「下限 1」兜着）。 */
  armor: { min: 0, max: 2 },
  /** 两次开火之间的毫秒。 */
  fireMs: { min: 380, max: 1400 },
  /** 敌人沿走道的速度（像素/秒）。 */
  speed: { min: 20, max: 70 },
  /** 一座机关的造价。 */
  towerCost: { min: 40, max: 80 },
  /** 开局废料 ÷ 最便宜那座塔的造价 —— 也就是「一上来够建几座」。 */
  startScrapTowers: { min: 2, max: 4 },
  /** 波数。 */
  waves: { min: 4, max: 6 },
  /** 一波里一种敌人的只数上界（一组）。 */
  groupCount: { min: 3, max: 12 },
} as const;

/** 把刻度渲染成给模型看的那一段。 */
export function tdReferenceScalePrompt(): string {
  const s = TD_REFERENCE_SCALE;
  return `# 数值参考刻度（**这是参考，不是规定**）

这一关的数值落在这个量级上，才**不容易写出一局赢不了的**：

- 机关的伤害：**个位数**（${s.damage.min}–${s.damage.max}）。敌人的血量：**两位数**（${s.hp.min}–${s.hp.max}）。
  护甲：**${s.armor.min}–${s.armor.max}**（不是两位数）。
- 机关的射速：**${s.fireMs.min}–${s.fireMs.max} 毫秒**。敌人速度：**${s.speed.min}–${s.speed.max} 像素/秒**。
- 一间机关的造价：**${s.towerCost.min}–${s.towerCost.max}**（最贵别超过最便宜的 2 倍）。
  开局废料：**最便宜那座塔造价的 ${s.startScrapTowers.min}–${s.startScrapTowers.max} 倍**。
- **${s.waves.min}–${s.waves.max} 波**；一波里一种敌人 **${s.groupCount.min}–${s.groupCount.max}** 只。

⚠️ **拿不准的时候，宁可把敌人写弱、把塔写便宜。**
  往那个方向的余量是 **10 倍量级**，往反方向只有 **1.5 倍**左右 ——
  这是拿真关卡一维一维扫出来的（\`packages/demo/probe/td-sweep.mjs\`），不是猜的。

⚠️ **插槽要沿走道铺开。** 走道上要被机关够得着的部分**越大越好** ——
  只把插槽堆在一小段路上，另外大半条走道就没人管，而**那是这一关最容易输的方式**。

⚠️ **这一条不是规定**：你的关卡只要**自洽**就行（塔的伤害与敌人的血量成比例、开局废料够建两三座）。
  **难而公平**的关卡是允许的。`;
}

// ── 票 93：骨架那一段的**共用抬头与落款**（横版那一处内联在 `ops.ts` 的 `compileGame` 里）──────
// ⚠️ **为什么共用**（票 86 §0-F）：两处抬头今天**逐字节相同，却分住两个文件** ——
//   那是「下一次改写就会漂」的形状，而今天没有任何东西看着它。
// ⚠️ **它们只负责这一截**（照票 85 `nineSliceNote` 的口径）：不合并两份提示词、不动别的字。
// ⚠️ 落款那句是**给模型的指引，不是一条保证**：「位置 / 尺寸 / 锚点是一整套」这件事
//   今天**没有任何判据能兑现**（票 86 §0-C：骨架过 `auditScreenSpace` 在两份夹具上零信息量）
//   ⇒ **不许**在措辞或注释里把它写成一条保证（票 86 的核心原则逐字）。

/** 骨架那一段的**抬头**。⚠️ 横版与塔防**共用同一份**（票 93 的 Q2 = 乙）。
 *
 *  ⚠️ 「**逐字照抄这个骨架**」于 2026-10-17 改成「照这个**形状**写」—— 票 86 §0-A 量到
 *    **模型把 `hud` 那一块 15/15 逐字照抄**（同一份产物里别处全在变），而「照抄」与「示例」
 *    同时说会互相抵消；值那一半由下面那条落款约束。 */
export const SKELETON_SHAPE_HEADING =
  `# 形状（照这个**形状**写；\`<…>\` 是占位符，换成清单里真实的 id 与动画名）`;

/** 骨架那一段的**落款**（票 93 的 Q1 = 甲）：位置 / 尺寸 / 锚点是一整套示例。
 *
 *  ⚠️ 它**必须明写「要一起」这个动作**（票 86 的 Q5 逐字：「"示例"不等于"锚点也可调整"」）——
 *    因为 `at` 与锚点**今天绑死**：骨架的 `at` **只在某一个锚点下**落在视口内
 *    （塔防 `{0,0}` · 横版 y=1，逐格算过的读数在票 86 §0-B）。 */
export const SKELETON_SHAPE_NOTE =
  `⚠️ 骨架里的**位置、尺寸、锚点是一整套**（三样都是示例）：要么**三样一起照抄**，` +
  `要么**三样一起按清单里那件资源的真实尺寸与锚点换** —— 单独照抄一样、另一样自己改，坐标会当场作废。`;

/**
 * 塔防关卡的编译提示词（票 05 的原型跑通之后定下来的形状）。
 *
 * ⚠️ **它住这里而不是内联在 `ops.ts` 里**（票 13 的口径）：那个文件的名字就是它存在的理由。
 *   ⚠️ 但**没有**顺手把 `compileGame` 那份搬过来 —— 那是另一件事（本图的 Out of scope）。
 *
 * ⚠️ **铁律里每一条都会被构建期的校验器检查**，与 `compileGame` 那份同一个形状：
 *   与其让模型猜，不如把「违反直接拒收」写清楚。
 */
export function tdConfigPrompt(requirement: string, resourceBrief: string, example: unknown): string {
  return `你是塔防关卡设计师。根据下面的**需求**与**资源包清单**，产出一份 td-config（td-config/v1）。

只输出 JSON 本体，不要 markdown 围栏，不要解释。

# 铁律（**每条都会被校验器检查，违反直接拒收**）

1. 顶层只有这些键：format / world / arena / scene / core / slots / towers / enemies / waves / economy / hud。多一个就拒。
   ⚠️ 唯一的例外是 \`path\` —— 它**不由你写**（见第 6 条），写了也不被采用。
2. \`format\` 恒为 \`"td-config/v1"\`。坐标一律**非负整数** —— \`x: 10.5\` 会静默糊掉像素网格，直接拒。
3. **场地由字符地图拼出来**，不是一整张背景图。字符只有五个、含义固定：
   \`#\`=墙 · \`.\`=地面 · \`=\`=货架 · \`:\`=**走道** · \`+\`=入口（卷帘门）。
   \`arena.walkChar\` 必须写 \`":"\`；\`arena.tiles\` 把每个字符绑到清单里的一件**砖**。
   ⚠️ **砖的尺寸必须正好等于 \`arena.cell\`、锚点必须是正中** —— 外壳按「格心 + 锚点」摆精灵，
   尺寸不对就会盖住邻居或留缝、锚点偏了整张地图偏半格，而**那两样都不会自己报错**。
4. 地图固定 **32 列 × 18 行**、\`cell\` 固定 **15**，世界 **480×270**。
   **每一行必须正好 32 个字符，行数正好 18** —— 写错一个字符就拒。
5. ⚠️ **走道要连成正好一条**：从那个 \`+\`（入口）出发，一路 \`:\` 不断，**通到柜台**。
   不要把走道画碎、不要让它中途断掉、不要画成互不相连的几块，**也不要在中间分叉**。
   ⚠️ 它必须是一条**一折再折的单线**（每个走道格只与前后两格相连，两头各一个端头）——
   工具要**沿着它**把敌人走的那条路算出来（见第 6 条）。分叉了就算不出唯一的一条路，会拒。
6. ⚠️ **不要写 \`path\` 这一块，一格都不要写。**
   敌人走的那条折线**由工具从你画的那张地图派生**（沿着走道格走一遍、只留转折点）。
   ⇒ 你只要把**地图**画对（第 5 条），路径就是对的 —— **你不可能把这两样写岔**，
   因为写它的不再是你。（⚠️ 写了也**不会被采用**：工具一律以你画的那张地图为准。）
7. ⚠️ **\`core\` 只写资源 id，不写位置** —— 柜台就在**走道通到的那一头**，位置是派生的。
   多写一个位置字段（\`at\`）直接拒。
8. \`slots\` 是可建造的空位，**不许压在走道上**（离折线太近会拒）。插槽 id 自定（\`s1\`、\`s2\`…）。
   ⚠️ **插槽要沿走道铺开、尽量多一些**（见下面那条刻度）。
9. \`towers[].attack\` 只能 \`"single"\`（单体）或 \`"aoe"\`（范围）；\`targeting\` 只能 \`"first"\` 或 \`"strongest"\`。
   每座塔**正好两级**（\`levels\` 是长度 2 的数组）。
   ⚠️ \`levels[].slow\` 是个**对象** \`{"factor":0.6,"ms":1200}\`，**不是一个数**；\`factor\` 必须**严格小于 1**。
   ⚠️ **\`aoe\` 塔不写 \`projectile\`**（它不抛东西，伤害在原地炸开）；它要写 \`fx\`（开火时播一次的特效）。
   \`single\` 塔才写 \`projectile\`，\`speed\` 必须 **> 0**。
   ⚠️ **每一种机关的 L1 射程都必须至少够得着走道** —— 够不着的话那座机关在这一关里是**死的**
   （建了永远不开火），会拒。
10. \`waves[].groups[].enemy\` 必须是 \`enemies\` 里真实存在的 id；敌人的 \`anim\` 必须是清单里真有的动画名。
11. **只许用下面清单里的 id 与动画名** —— 清单里没有的一律拒收。

# 需求
${requirement}

# 资源包清单（**只许用这里面的东西**）
${resourceBrief}

${tdReferenceScalePrompt()}

${SKELETON_SHAPE_HEADING}
${JSON.stringify(example, null, 2)}

${SKELETON_SHAPE_NOTE}

⚠️ 骨架里那张地图**是「行格式的演示」，不是一张可以拿来用的地图** ——
它存在的唯一理由是让你看清「一行正好 32 个字符、五个字符怎么摆、走道怎么连成一条」。
**照抄它 = 没有按上面的需求设计这一关**：需求说了这一关的场地长什么样，按那个画。
（行列数、字符集、走道要连通这三条不变。）`;
}


// ═════════════════════════════════════════════════════════════════════════════════════════
// 票 12：**资产规划**那一步的问话面（它取代了 `derive` 的提示词 —— 输入从「需求 + StyleSpec」
// 换成「设计 + 这个世界」）。
// ═════════════════════════════════════════════════════════════════════════════════════════

export const PLAN_TOOL_NAME = "emit_asset_recipe";

/**
 * 工具说明 = **schema 说不清的东西唯一的家**（票 08 的 R2-Q5）。
 *
 * ⚠️ 这里每一条都是「线形状表达不出来的」：JSON Schema 说得出类型、可选性、枚举，
 *   说不出「这两条是同一件事的两种参数化」，也说不出「哪些值**不是**策略」。
 */
export const PLAN_TOOL_DESCRIPTION = `输出一份 AssetRecipe（asset-recipe/v1）—— **要造哪些资源**的完整清单。
⚠️ 清单说的是**要什么**，不是**怎么画**：没有颜色、没有像素、没有画面。

八条线形状表达不出来的规矩：

1. **策略只有三个值**：\`drawlist\`（画出来的）· \`image\`（生成出来的）· \`import\`（人给的位图）。
   ⚠️ \`character-reference\` / \`image-edit\` / \`procedural\` **不是值**：
   前两个是 \`image\` 的两种**参数化**（见第 2 条），第三个是失败的意思。
   经验：角色 / 敌人 / 背景 / 复杂道具 → \`image\`；UI 与简单几何 → \`drawlist\`。

2. \`image\` 的**两种参数化**，别混：
   · \`source.reference\` —— **配方外的文件路径**（人放好的参考图）；
   · \`masterAsset\` —— **配方里那张母版的 id**（见第 4 条）。
   ⚠️ 用 \`masterAsset\` 时**照样**是 \`{"kind":"image"}\`，不是另立一个策略。

3. \`characterId\` —— **这个资产属于设计层里哪个实体**，取值**照抄设计层的 id**（不许自己起名）。
   只有**属于角色**的资产才写它；木条箱、地面砖、拾取物不写。
   ⚠️ **覆盖是硬要求（规划期直接拒）**：设计层四桶（\`enemies[]\` / \`npcs[]\` / \`interactables[]\` /
   \`resources[]\`）里的每个 id，都必须有一件资产的 \`spec.id\` **逐字等于它**，或
   \`spec.characterId\` **逐字等于它**（角色照旧走 \`characterId\`，道具 / 拾取物走 \`id\`）。
   **不改名、不省略、不做前缀** —— 漏一个 / 改一个字都会被拒，原样重采样。

4. \`authoring[]\` 是**创作态母版**（\`{id, role, description, source, characterId, size}\`）：
   它**不进交付包**，是给同角色的资产当「参考图」用的。资产的 \`masterAsset\` 指它的 \`id\`。
   ⚠️ **母版的 \`size\` 是画布**（不是缩放目标），而它与引用它的资产的 \`size\` **宽高比必须一致**
   —— 否则同一个角色会有两套头身比。
   ⚠️ **每个写了 \`characterId\` 的 \`animation\` 都必须有一张母版，且 \`masterAsset\` 指向它** ——
   这是 DNA → 母版 → 动画那条链的入口；其余资源不必有母版。
   反过来，只要你写了母版，就必须有资产指着它（否则它是一张没有入边的表）。

5. \`dependsOn\` 是**资产 → 资产**的顺序边：写**别的资产的 \`id\`**。
   ⚠️ 不许指向母版（那一类边由 \`masterAsset\` 表达）· 不许指向自己 · **整张图不许有环**。

6. **分层背景的层名两两不同**（\`spec.layers[].name\`；帧名是 \`<资源 id>.<层名>\`）。
   ⚠️ **这一条不是防线** —— 契约里本来就有这条判据（重复层名会被**拒**，票 58 补的），
   写在这里**只为少一次返工**。\`sky / ground / wall\` 这种说得清远近的名字是好的，两个 \`far\` 不是。

7. **同一个资源的动画名两两不同**（\`spec.animations[].name\`；帧名是 \`<资源 id>.<动画名><序号>\`）。
   ⚠️ **这一条不是防线** —— 契约里本来就有这条判据（重复动画名会被**拒**，票 89 补的），
   写在这里**只为少一次返工**。\`idle / run / jump\` 这种一身一个动作的名字是好的，两个 \`idle\` 不是。

只调这个工具，不要解释。`;

/** 设计层那些**要人读**的字段，逐条点名地摊开。
 *
 *  ⚠️ 票 10 的裁定：设计层那 **12 个 ① 档字段**由票 10 的提示词「逐条点名地生产」，而**具名插值在下游**
 *    —— 下游有**两处**：票 12（规划清单）与票 14（编译运行档），**两处都插一遍**。
 *    ⇒ 每个字段带着它的**点号路径**，那是那条欠条的兑现方式，别改成一句转述。 */
export function designBrief(d: GameDesignSpec): string {
  const lines = [
    `- 标题 \`game.title\`：${d.game.title}`,
    `- 题材 / 镜头：${d.game.genre} · ${d.game.camera}（外壳 ${d.game.runtimeProfile.id}/v${d.game.runtimeProfile.version}）`,
    `- 核心循环：${d.coreLoopSteps.join(" / ")}`,
    `- \`player.role\` —— 玩家是：${d.player.role}`,
    `- \`player.abilities\` —— 他能：${d.player.abilities.join(" / ")}`,
    `- \`world.theme\`：${d.world.theme}`,
    `- \`world.setting\`：${d.world.setting}`,
    `- \`world.structure\`：${d.world.structure}`
  ];
  for (const e of d.enemies) lines.push(`- 敌人 \`${e.id}\` —— \`enemies[].behavior\`：${e.behavior}｜\`enemies[].threat\`：${e.threat}`);
  for (const e of d.npcs) lines.push(`- NPC \`${e.id}\` —— \`npcs[].role\`：${e.role}｜\`npcs[].interaction\`：${e.interaction}`);
  for (const e of d.interactables) lines.push(`- 交互物 \`${e.id}\` —— \`interactables[].type\`：${e.type}｜\`interactables[].behavior\`：${e.behavior}`);
  for (const e of d.resources) lines.push(`- 可拾取物 \`${e.id}\`：${e.purpose}`);
  for (const l of d.levels)
    lines.push(`- 关卡 \`${l.id}\` —— \`levels[].purpose\`：${l.purpose}｜怎么走：${l.layout}｜这一关有：${l.entities.join(" / ") || "（空）"}`);
  return lines.join("\n");
}

/** 这个世界的视觉语法 —— 「该造哪些东西、它们该有什么气质」照它写。 */
function worldBrief(v: VisualWorldSpec): string {
  const c = v.composition;
  const buckets = Object.entries(v.palette).map(([k, refs]) => `${k}=${refs.join(",") || "∅"}`).join(" · ");
  const mats = Object.entries(v.materials).map(([k, m]) => `${k}（${m.appearance}）`).join(" · ");
  const pick = (xs: (string | undefined)[]) => xs.filter((x): x is string => typeof x === "string" && x !== "").join(" · ") || "（没写）";
  return [
    `- 视觉身份：${v.styleIdentity.description}`,
    `- 关键词：${v.styleIdentity.keywords.join(" / ") || "（没写）"}`,
    `- 相机：${v.camera.mode}`,
    `- **空间分层**（前景 / 中景 / 背景 / 物尺度 / 密度）：${pick([c.foreground, c.midground, c.background, c.objectScale, c.density])}`,
    `- **颜色分工（六桶）**：${buckets}`,
    ...(mats === "" ? [] : [`- 材质：${mats}`]),
    `- 这个世界里**角色**共有的长相：${pick([v.character.silhouette, v.character.proportions, v.character.clothing, v.character.poseLanguage])}`,
    `- 环境：${pick([v.environment.architecture, v.environment.terrain, v.environment.props, v.environment.textureDensity])}`
  ].join("\n");
}

/**
 * 把「这个游戏的设计」读成一份资源清单。
 *
 * ⚠️ **本层那 12 个 ① 档字段的具名插值就发生在这里**（票 10 落地时人类裁的：设计层那 12 个由
 *   票 10 的提示词**逐条点名地生产**，而**具名插值在下游** —— 票 12 与票 14 的模板）。
 *   ⇒ `designBrief` 里每一个字段都带着它的**点号路径**，那是这条欠条的兑现方式，别改成一句转述。
 */
export function assetPlanPrompt(input: {
  design: GameDesignSpec;
  vws: VisualWorldSpec;
  /** 照抄值（与票 08 让模型照抄 `style.id` 同款）：装配/落盘时会**强制改写**。 */
  echo: { styleRef: string; styleId: string; referenceImage?: string };
}): string {
  const { design, vws, echo } = input;
  // ⚠️ **插值出来的是字面词本身**（`idle` / `run` / `jump`），**不是 `<idle>` 那种占位符**：
  //   占位符读起来像「这里自己填一个名字」，而契约要的正是**照字面**（票 61 的 Q12(r4) 原话：
  //   「最终送入模型的提示词中直接呈现 idle、run、jump，不带尖括号，不允许模型改名」）。
  const ACTIONS = PLAYER_ACTION_NAMES.map((n) => `\`${n}\``).join(" / ");
  return `你是游戏资源策划。根据下面的**设计**与**这个世界的视觉语法**，产出一份完整的资源清单。

⚠️ 清单说的是**要造什么**（有哪些资源 · 长什么样的一句话 · 多大 · 几帧 · 哪一类），
   **不是怎么画**：没有颜色、没有像素、没有画面 —— 那是后面几步的事。

# 要做的是一个什么样的游戏（GameDesignSpec）
${designBrief(design)}

# 这个世界长什么样（VisualWorldSpec）
⚠️ 「该造哪些东西、它们该有什么气质」**照它写** —— 尤其是**空间分层**（背景几层、每层是什么）
   与**角色的共同长相**。
${worldBrief(vws)}

# 清单格式（asset-recipe/v1）
⚠️ **每一条是 \`{spec, source}\` 两层**：\`kind\`/\`id\`/\`size\`/**那三个可选键**都在 **\`spec\` 里面**；
   \`source\` 只说「怎么造出来」。⚠️ 放错一层会被拒收。
⚠️ \`source.kind\` **三种都要按需选** —— 下面骨架里写的是「三选一」的占位，
   别照抄成 \`drawlist\`（角色 / 敌人 / 背景 / 复杂道具该走 \`image\`）。

{"format":"asset-recipe/v1","id":"<这份清单的 slug>","styleRef":"${echo.styleRef}"${echo.referenceImage === undefined ? "" : `,"referenceImage":"${echo.referenceImage}"`},
 "authoring":[{"id":"<母版 slug>","role":"...","description":"...","source":{"kind":"drawlist|image|import"},
   "characterId":"<设计层那个角色的 id>","size":{"w":int,"h":int}}],
 "assets":[
  {"spec":{"kind":"sprite|animation|background|ui","id":"<slug>","role":"...","description":"...",
    "styleId":"${echo.styleId}","anchor":{"x":0..1,"y":0..1},"size":{"w":int,"h":int},
    "required":true,
    "characterId":"<设计层那个实体的 id，属于角色的资产才写>",
    "masterAsset":"<authoring[] 里那张母版的 id —— 带 characterId 的 animation 必填>",
    "dependsOn":["<别的资产 id，要先造完它才轮到这一条>"],
    "animations":[{"name":"...","frames":int,"fps":num,"loop":bool}]},
   "source":{"kind":"drawlist|image|import"}}]}
⚠️ **每个写了 \`characterId\` 的 \`animation\` 都要写一张母版（\`authoring[]\`）并让 \`masterAsset\` 指向它** ——
   母版画布的比例必须与那个动画的 \`size\` 一致。planner 会兜底补齐漏写的，但多花一次生图的仍是这一份清单。
⚠️ 母版只给**角色**：其余资源不要写 \`authoring[]\`，也不要写 \`masterAsset\`（指过去而那边没有，是拒绝）。

⚠️ \`anchor\` 是这件资源的**参考点**（归一化 0..1），**不是左上角** ——
  配置那一步把 \`at\` 写成「**这个点**落在哪儿」。⇒ **你在这里选什么锚点，那边就得按它写 \`at\`。**
⚠️ 配置那一步**有一份带具体数字的形状骨架** —— 它**只在锚点与它配套时才对**：
  **要么照它的锚点、要么照它的 \`at\`，别一个照抄、一个自己写。**

四条硬规则（**会被 schema 强制检查，违反直接拒收**）：
1. \`sprite\` —— **不许出现 \`animations\` 这个键**（它只有一帧）。会动的才是 animation。
2. \`animation\` —— 必须有 \`animations\`，至少一个。
3. \`background\` 是场景尺度；\`ui\` 是**屏幕空间**（世界里的招牌是 sprite，不是 ui）。
4. \`animations[].frames\` 是**帧数**（整数），不是帧名。

⚠️ **玩家那件资源还有一条硬要求**（外壳按三个固定键各播一种动作；缺一样就编不出一份能跑的配置）：

1. 玩家名下 \`kind:"animation"\` 的资源**恰好一件** —— 不许 0 件，也不许 2 件。
   ⚠️ **别把三个动作拆成三件**（一件一路动画）：配置那一步会在几件里挑错，
   而且会多花两笔生图的钱。
2. 这一件的 \`animations[]\` 里**必须同时有这三个名字**：${ACTIONS}
   —— 就是这三个词**本身**，照抄、**不许改名**（不是占位符，不许写成 \`walk\` / \`idle-down\` 之类）。
3. 这三路**每路至少 2 帧** —— 1 帧是静帧，不是动画。
4. 这一件**必须写 \`characterId\`**，值就是 \`${design.player.id}\`（上面设计层那个玩家的 id，一个字不许改）。

⚠️ 四个槽的 \`id\` **沿用上面设计层给的那些 id**（一个字都不许改）；设计层没点名、但**设计说得出**
的东西可以新加，给它们起新 id。
⚠️ 背景层：**层数按画面需要定**（三层的写法：由远到近，一层一段描述），**没有「必须三层」这回事**。

${recipeShapeSpec()}

只调 ${PLAN_TOOL_NAME} 工具，不要解释。`;
}


// ═════════════════════════════════════════════════════════════════════════════════════════
// 票 14：**运行档编译**那一步的问话面（它取代了 `compile-game` 的提示词 —— 输入从「需求 + 资源包」
// 换成「设计 + 这一代外壳 + 资源包」）。
// ═════════════════════════════════════════════════════════════════════════════════════════

export const CONFIG_TOOL_NAME = "emit_game_config";

/**
 * 工具说明 = **schema 说不清的东西唯一的家**（票 08 的 R2-Q5）。
 *
 * ⚠️ 那九条铁律**住在提示词里**（它们要看视口与包，schema 看不见）—— 这里只放
 * 「线形状表达不出来、又不依赖任何入参」的那几条。
 */
export const CONFIG_TOOL_DESCRIPTION = `输出一份 GameConfig（game-config/v1）—— 这是**给外壳吃的**一份菜谱。
⚠️ 它**只说「哪里有、参数是多少」**，不是一门语言：外壳写死实现了一组行为原语，你只能在里面选。

四条线形状表达不出来的规矩：

1. \`at\` 是「**资源锚点落在的那个点**」，**不是左上角**。角色的锚点是**脚**、
   世界里的道具是**底边中心** —— 所以站在地面线上的东西写
   \`at.y = 地面线的 y\`，**不是** \`地面线 − 高\`。写错整个世界的道具都会浮在半空。
2. **看不见的碰撞进 \`terrain\`**（地面线、关卡边界、隐形墙 —— 它**不引用任何资源**）；
   **看得见的静态碰撞体**（一摞行李、一段台阶）是一条 \`kind:"solid"\` 的**实体**，带资源。
   同一块碰撞体**只写一次**。
3. \`objective\` **不带数量**：要捡几件由 \`kind:"pickup"\` 的实体条数**派生**。
4. 实体**不重复声明自己的几何**（\`size\`/\`anchor\` 只住在资源包里）—— **没有 \`scale\` 这个键**，
   写了会被当场拒（\`1.7\` 会**静默**糊掉像素网格）。

只调这个工具，不要解释。`;

