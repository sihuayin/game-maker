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
  const lines = plan.map((p, i) =>
    p.layer !== null
      ? `  第 ${i + 1} 帧（层名 ${p.layer}）：从远到近的第 ${p.index + 1}/${p.total} 层`
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
 从远到近：${plan.map((p) => p.layer).join(" → ")}。`
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

这一层要画的东西：${spec.description}（${spec.role}）
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
