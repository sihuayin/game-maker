import type { GameDesignSpec, VisualWorldSpec } from "@game-maker/contracts";
// schema-to-prompt 渲染器 —— **生成与推导共用的那一份**（票 22 问题 4 的落点）。
//
// 归 `assets` 而不是 `contracts`：它是 schema 的**镜像**，会随提示工程调优而改；
// 而 contracts 只放不随便动的东西。schema 一改，这里必须跟着改 —— 所以 op 集只有这一处描述。
import type { AssetSpec, StyleSpec } from "@game-maker/contracts";

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
 * ⚠️ **全仓库只此一份**（票 40 抓到的）：它曾经在 `prompt.ts` 与 `pack.ts` 各有一份，
 * 而票 42 给 `pack.ts` 加「分层背景」那一支时**只改了一半** —— 于是提示词告诉模型
 * 「只需一帧」，而组装侧期待三帧，模型给一帧、组装抛「清单说要 3 帧、生成器给了 1 帧」。
 * 两边各写一份必然漂移，这一次漂的是**提示词与组装之间**。
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
 *     所以这里只取 identity / material / constraints，把 camera 换成"正交、无透视"的一句。
 */
/** 这次画的是**哪一个东西** —— 一段动画，或者分层背景的某一层。 */
export type ImagePromptTarget = {
  anim?: string;
  layer?: { name: string; index: number; total: number; tileX: boolean };
};

export function imagePrompt(spec: AssetSpec, style: StyleSpec, target: ImagePromptTarget = {}): string {
  if (spec.kind === "animation") return animationSheetPrompt(spec, style, target.anim);
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
function singleObjectPrompt(spec: AssetSpec, style: StyleSpec): string {
  const bg = keyColorFor(style.palette);
  return `画一张游戏用的**单个物体**贴图，占满整个画面，四周只留很窄的一圈空白。

⚠️⚠️ 最重要的一条，请先读它：**背景必须是纯色 ${bg}**。
   整张图的背景区域要被这个颜色填满，不要渐变、不要噪点、不要纹理、不要图案。
   背景上不要出现任何东西：没有墙、没有地面、没有影子、没有边框、没有文字、没有水印。
   列表里的其他颜色**一个都不要**用来画背景。

这个物体是：${spec.description}（${spec.role}）

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
function animationSheetPrompt(spec: AssetSpec, style: StyleSpec, animName?: string): string {
  const bg = keyColorFor(style.palette);
  if (spec.kind !== "animation") throw new Error("animationSheetPrompt 只用于 animation 资源");
  const anim = animName === undefined ? spec.animations[0]! : spec.animations.find((a) => a.name === animName);
  if (!anim) throw new Error(`spec 里没有动画 "${animName}"`);
  const n = anim.frames;
  const total = spec.animations.reduce((s, a) => s + a.frames, 0);
  return `画一张**横排的游戏角色动画分解图**：横向排开 **${n} 个**格子，每格画同一个角色在
「${anim.name}」这组动作里一个连续瞬间的样子。整张图共 ${n} 个角色，不多不少。

⚠️⚠️ 最重要的一条，请先读它：**背景必须是纯色 ${bg}**，整张图铺满，不要渐变、不要噪点、
   不要纹理、不要图案、不要格线、不要编号、不要文字、不要水印、不要边框。
   ${n} 个角色之间要留出**明显的空隙**（背景色露出来），这样才切得开。
   列表里的其他颜色**一个都不要**用来画背景。

这个角色是：${spec.description}（${spec.role}）
这组动作是「${anim.name}」（共 ${total} 帧里的第 ${spec.animations.findIndex((a) => a.name === anim.name) + 1} 组）。

硬性要求：
- ${n} 个角色**长得一模一样**：脸、帽子、衣服、配色、描边、像素尺度全都不能变，
  只有四肢的姿势不同。
- ${n} 个角色的**大小一致**，脚底落在**同一条水平线**上，不要有的高有的矮。
- 每个角色的**外接矩形**长宽比必须**精确**是 ${spec.size.w} : ${spec.size.h}（宽 : 高）。
  画布本身是横条（${n} 个并排），但每个角色自己的比例要守住 ——
  交付管线会把它两方向独立缩放到 ${spec.size.w}×${spec.size.h} 像素。

角色**本身**的颜色只用下面这些：
${style.palette.join("  ")}
（注意：这条是给**角色**定的，背景的 ${bg} 是唯一的例外。）

这个世界的视觉语法（只用于角色本身的配色与质感）：
identity: ${JSON.stringify(style.identity)}
material: ${JSON.stringify(style.material)}

画法：硬边色块、边缘干净利落、不要抗锯齿、不要柔边、不要渐变、不要写实照片质感、
不要体积光、不要景深。正视角度、正交投影、不要任何透视。

再强调一次：${n} 个角色，背景纯色 ${bg}，角色身上**不要**出现 ${bg} 这个颜色。`;
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
export const recipeShapeSpec = (): string => `每个 spec 只许有这些键：kind / id / role / description / styleId / anchor / size / required。
按类可以另加，且**形状必须逐字如下**：
  animation  → "animations":[{"name":"walk","frames":4,"fps":8,"loop":true}, ...]
  background → "layers":[{"name":"sky","parallax":0.3},
                         {"name":"ground","parallax":1,"tileable":{"x":true,"y":false}}]
               ← **数组**，每项是对象，**从远到近**排序；层名会拼成帧名 \`<资源 id>.<层名>\`
               ← 不平铺的层**别写 tileable**（三层里通常只有墙与地平铺，天空不平铺）
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

# 形状（**逐字照抄这个骨架**；\`<…>\` 是占位符，换成清单里真实的 id 与动画名）
${JSON.stringify(example, null, 2)}

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

五条线形状表达不出来的规矩：

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

4. \`authoring[]\` 是**创作态母版**（\`{id, role, description, source, characterId, size}\`）：
   它**不进交付包**，是给同角色的资产当「参考图」用的。资产的 \`masterAsset\` 指它的 \`id\`。
   ⚠️ **母版的 \`size\` 是画布**（不是缩放目标），而它与引用它的资产的 \`size\` **宽高比必须一致**
   —— 否则同一个角色会有两套头身比。
   ⚠️ 母版**不必每份清单都有**；但只要你写了，就必须有资产指着它（否则它是一张没有入边的表）。

5. \`dependsOn\` 是**资产 → 资产**的顺序边：写**别的资产的 \`id\`**。
   ⚠️ 不许指向母版（那一类边由 \`masterAsset\` 表达）· 不许指向自己 · **整张图不许有环**。

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
    `- 核心循环：${d.coreLoop.join(" / ")}`,
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
    "masterAsset":"<authoring[] 里那张母版的 id，用母版才写>",
    "dependsOn":["<别的资产 id，要先造完它才轮到这一条>"],
    "animations":[{"name":"...","frames":int,"fps":num,"loop":bool}]},
   "source":{"kind":"drawlist|image|import"}}]}
⚠️ \`authoring[]\` **只有真给了母版才写**（没写它就得把 \`masterAsset\` 也去掉 —— 指过去而那边没有，是拒绝）。
四条硬规则（**会被 schema 强制检查，违反直接拒收**）：
1. \`sprite\` —— **不许出现 \`animations\` 这个键**（它只有一帧）。会动的才是 animation。
2. \`animation\` —— 必须有 \`animations\`，至少一个。
3. \`background\` 是场景尺度；\`ui\` 是**屏幕空间**（世界里的招牌是 sprite，不是 ui）。
4. \`animations[].frames\` 是**帧数**（整数），不是帧名。

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
   世界里的道具是**底边中心**、HUD 面板是**左下角** —— 所以站在地面线上的东西写
   \`at.y = 地面线的 y\`，**不是** \`地面线 − 高\`。写错整个世界的道具都会浮在半空。
2. **看不见的碰撞进 \`terrain\`**（地面线、关卡边界、隐形墙 —— 它**不引用任何资源**）；
   **看得见的静态碰撞体**（一摞行李、一段台阶）是一条 \`kind:"solid"\` 的**实体**，带资源。
   同一块碰撞体**只写一次**。
3. \`objective\` **不带数量**：要捡几件由 \`kind:"pickup"\` 的实体条数**派生**。
4. 实体**不重复声明自己的几何**（\`size\`/\`anchor\` 只住在资源包里）—— **没有 \`scale\` 这个键**，
   写了会被当场拒（\`1.7\` 会**静默**糊掉像素网格）。

只调这个工具，不要解释。`;

