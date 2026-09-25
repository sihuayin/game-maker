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
