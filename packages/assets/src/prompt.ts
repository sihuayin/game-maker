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

/** 一次生成要画哪些帧。顺序即播放顺序（【票 38】按这个顺序给帧命名）。 */
export function framePlan(spec: AssetSpec): { anim: string | null; index: number; total: number }[] {
  if (spec.kind === "animation") {
    return spec.animations.flatMap((a) => Array.from({ length: a.frames }, (_, i) => ({ anim: a.name, index: i, total: a.frames })));
  }
  return [{ anim: null, index: 0, total: 1 }];
}

/** 把一段 prompt 要的资源描述出来 —— 生成器的任务块。 */
export function assetTask(spec: AssetSpec, style: StyleSpec): string {
  const plan = framePlan(spec);
  const lines = plan.map((p, i) => `  第 ${i + 1} 帧：${p.anim === null ? "唯一的一帧" : `${p.anim} 动作的第 ${p.index + 1}/${p.total} 帧`}`);
  const heads = headCount(spec.size.h);
  const shape = spec.kind === "animation"
    ? `这是**一个**资源的 ${plan.length} 帧 —— **必须一次给出全部帧**，它们必须是同一个东西在不同时刻的样子。`
    : `这是**一个**静态资源，只需一帧。`;
  return `${shape}

画布 ${spec.size.w}×${spec.size.h} 像素（viewBox 与 expectedSize 都是 [0,0,${spec.size.w},${spec.size.h}]）。
这个资源是：${spec.description}（${spec.role}）。

按顺序给出这 ${plan.length} 帧：
${lines.join("\n")}

硬性要求：
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
export function imagePrompt(spec: AssetSpec, style: StyleSpec, animName?: string): string {
  return spec.kind === "animation"
    ? animationSheetPrompt(spec, style, animName)
    : singleObjectPrompt(spec, style);
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
