// 票 13 的**纯**那一半：母版那一发怎么问、它的画布规则、以及两条**免费**判据。
// I/O（读文件、调生图、落盘、记帐）在 `pack.ts` 的**母版前段**里 —— 这里一个字都不碰网络与磁盘。
//
// ⚠️ **职责收紧**（票 13 的 Q8 的原话：「master.ts 收紧职责」）：本文件只放三样 ——
//   ① 母版的提示词；② 「canonical 画布 vs 回来的那张图」那条判据；
//   ③ 「这份配方会递哪些**参考图**」那份清单（Q6 的免费拦停用它）。
//   ⚠️ 别把装配、落盘、账搬进来 —— 那些是 `pack.ts` 的活，而「一个模块两件事」是本仓库反复吃亏的地方。
//
// ⚠️ **母版是什么**：`AssetRecipe.authoring[]` 里的一项（票 04）——**创作态、不进交付包**。
//   它是**基因的一张渲染图**（`DNA → 母版 → 动画`），后面所有动画都**照它画**：
//   `pack` 把这张位图当 `reference` 内联进每一次生图（`image-gen.ts` 的 `GenerateImageRequest.reference`）。
import type { CharacterDNA, StyleSpec } from "@game-maker/contracts";
import { dnaBrief, keyColorFor, paletteLine } from "./prompt.js";

/** 母版今天**实现了**的两种 `source.kind`（票 13 的 Q1）。
 *
 *  ⚠️ `drawlist` 在契约里也合法（`AuthoringAsset.source` 就是 `AssetSource` 那三选一），
 *  但**没有实现**：`drawlist` 生成器的签名是 `(spec: AssetSpec, style)`，而母版**不是** `AssetSpec`
 *  —— 要么给它造一个假 spec，要么改签名（两份签名的漂移，票 40 吃过一次）。
 *  ⇒ 遇到它**抛一句说得清的话**，不静默退回（仓库的老规矩：没实现就喊，别猜一个）。 */
export const MASTER_SOURCES = ["image", "import"] as const;

/** 母版的**反向**提示词。
 *
 *  ⚠️ **不能直接复用 `imageNegativePrompt()`** —— 那一份里有 `"human figure", "character", "hands"`
 *   （它是给「单个物体」定的：一个箱子贴图里不许冒出个人），而**母版画的正是一个角色**。
 *   ⇒ 拿它去配母版，等于一半在说「画这个人」、另一半在说「不要人」—— 自相矛盾的提示词
 *     模型只会执行一条（本仓库为此吃过三次亏）。
 *  ⚠️ 但**「一张图里只有这一个角色」这一条要留着**：母版是**一个**角色的参考图，
 *   不是一张动作分解图（那是动画那一发的事，它一次画 N 个）。 */
export function masterNegativePrompt(): string {
  return [
    // ⚠️ 「多个人物」是这里最要紧的一条：模型见到「角色参考图」很容易画成一排三视图 / 动作分解图。
    "multiple characters", "several characters", "character sheet", "turnaround", "three views",
    "duplicate", "twins", "crowd", "group of people",
    "scene", "landscape", "room", "interior", "background scenery", "props", "furniture",
    "border", "frame", "picture frame", "panel", "vignette", "poster", "signage",
    "text", "letters", "words", "caption", "watermark", "logo", "UI",
    "gradient", "smooth shading", "soft edges", "blur", "anti-aliasing",
    "photograph", "photorealistic", "3D render", "depth of field", "lens blur",
    "drop shadow", "cast shadow", "reflection", "specular highlight",
    "perspective", "isometric", "diagonal",
  ].join(", ");
}

/**
 * 母版那一发的提示词。
 *
 * ⚠️ **身份来自 DNA 的八个字段**（`dnaBrief`），不是 `description` —— 那是「资产级」的那句话
 *   （票 04 把 `spec.role` 降格之后，`description` 说的是「待机三帧」这类事）。
 *   `authoring[].role` / `.description` 是**人写的那两格**，仍然进提示词（它们是**这一张图**的说法）。
 *
 * ⚠️ **画布是 canonical 的**（Q2 的裁定：「size 是 canonical target；provider 尺寸是派生值」）：
 *   提示词说的是 `authoring[].size` 那个比例，而上游请求尺寸由 `image-gen.ts` 按协议**派生**
 *   （`requestSize` / `geminiAspect` / `openaiSize`）—— 这一层不参与那条换算。
 */
export function masterPrompt(input: {
  master: { id: string; role: string; description: string };
  dna: CharacterDNA;
  style: StyleSpec;
  canvas: { w: number; h: number };
}): string {
  const { master, dna, style, canvas } = input;
  const bg = keyColorFor(style.palette);
  return `画一张游戏角色的**母版参考图**：**一个**角色的全身像。
这个游戏里这个角色后面的所有动作（待机 / 走路 / 跳跃…）都会**照这张图画**，
所以它要把「这个角色长什么样」说尽 —— **形象、比例、配色、身上有什么**，一样都不能含糊。

⚠️⚠️ 最重要的一条，请先读它：**背景必须是纯色 ${bg}**。
   整张图的背景区域要被这个颜色填满，不要渐变、不要噪点、不要纹理、不要图案、不要格线。
   背景上不要出现任何东西：没有墙、没有地面、没有影子、没有边框、没有文字、没有水印。
   列表里的其他颜色**一个都不要**用来画背景。
   ⚠️ 反过来：**这个角色身上**，一个 ${bg} 的像素都不许出现。

这是**一个**角色，画面里**只有他/它一个**，不多不少 —— 不要画成一排三视图、不要画动作分解图、
不要画场景、不要加画框。

# 这个角色是谁（**八个字段，一个都不许漏**）
${dnaBrief(dna, style)}

# 这一张图的其他交代（人写的）
- 它在这份清单里的角色：${master.role}
- 这张图的用途：${master.description}

# 画成什么样
- **全身入画**：从头到脚都在画面里（脚下不要被画布切掉），四周只留**很窄**的一圈空白。
- **正视、正交投影**：不画透视、不画斜侧、不画角度。
- **中性站姿**：双臂自然垂下、双脚并拢站在**同一条水平线**上（所有动作都从这个姿态出发）。
- 这个角色的**外接矩形**长宽比必须**精确**是 ${canvas.w} : ${canvas.h}（宽 : 高）——
  交付管线会把它两方向独立缩放到 ${canvas.w}×${canvas.h} 像素，比例不对就是硬拉伸。
- 画法：**硬边色块**、边缘干净利落、不要抗锯齿、不要柔边、不要渐变、不要写实照片质感、
  不要体积光、不要景深。

# 这个世界怎么画（配色与质感照它）
${paletteLine(style.palette)}
identity: ${JSON.stringify(style.identity)}
material: ${JSON.stringify(style.material)}
世界的约束（⚠️ 上面那个角色特有的约束是**叠加**在它之上，不是替代）：
${JSON.stringify(style.constraints)}`;
}

/**
 * **回图的宽高比必须与 canonical 画布一致**（票 13 的 Q2）。
 *
 * ⚠️ 为什么这条判据是必要的：`authoring[].size` 是我们**要求**画多大（canonical），
 *   而上游回什么尺寸由它自己的规则定（`requestSize` 锁长边 1024 / `geminiAspect` 查表 /
 *   `openaiSize` 查表）⇒ 两者**可以对不上**。对不上的后果不是「难看」：
 *   母版是**参考图**，它的头身比会被后面的动画照着画（票 22 那条「比例指令模型不执行、
 *   画布尺寸才是真约束」）⇒ 一套比例错了，整条动画链一起错。
 * ⚠️ 只比**比例**，不比像素尺寸 —— 上游从来给不出我们要的那个像素数，那是**它的**表。
 */
export function masterRatioMismatch(canvas: { w: number; h: number }, image: { width: number; height: number }): string | null {
  if (canvas.w * image.height === image.width * canvas.h) return null;
  return (
    `母版那一发回来的图是 ${image.width}×${image.height}（比例 ${(image.width / image.height).toFixed(3)}），` +
    `而清单写的是 ${canvas.w}×${canvas.h}（比例 ${(canvas.w / canvas.h).toFixed(3)}）—— ` +
    "**宽高比不一致**。⚠️ 母版是参考图：它的头身比会被后面每一个动画照着画，`authoring[].size` 就是那个 canonical 比例。\n" +
    "⇒ 要么重出这一张（多半是上游没守住长宽比），要么把 `authoring[].size` 改成这张图真实的比例。"
  );
}

/** 会递出去的参考图 —— `recipe.referenceImage`（世界的风格图，走 `styleReference`）。 */
type RecipeLike = {
  referenceImage?: string;
  assets: readonly { spec: { id: string; masterAsset?: string }; source: { kind: string; reference?: string } }[];
};

/**
 * **这份配方会递给上游的「参考图」有哪些**（票 13 的 Q6）。
 *
 * ⚠️ 它存在的理由：**有一整类协议接不了参考图**（`dashscope-mcp` 那条的
 *   `tools/call` 参数里根本没有 `reference` / `styleReference` 这两个键 —— 传了**静默丢掉**，
 *   账上一个字都不记）。⇒「带参考图」这个要求在某家协议上会**静默地不成立**，
 *   而后果是「一个看起来正常、但完全没照参考图画的包」——「错得安静」的正品。
 *   所以这条清单是给**开跑前**那道免费拦停用的（`ops.ts` 的 `packAssets`）。
 *
 * ⚠️ **`styleRef` 不在里面**（人类这一轮专门点了这一条）：它是一条指向 `stylespec.json` 的
 *   **路径**，不是图，永远不会被「丢掉」。要拒的是**真的有一张图会被丢**。
 */
export function referenceImagesOf(recipe: RecipeLike): string[] {
  const out: string[] = [];
  // 世界风格图：第 1 张附件（`pack.ts` 把 `recipe.referenceImage` 解成 `styleReference`）。
  if (recipe.referenceImage !== undefined) out.push(`整份配方的 \`referenceImage\`（世界风格图）：${recipe.referenceImage}`);
  for (const e of recipe.assets) {
    if (e.source.kind === "image" && e.source.reference !== undefined)
      out.push(`资产 "${e.spec.id}" 的 \`source.reference\`：${e.source.reference}`);
    else if (e.spec.masterAsset !== undefined)
      out.push(`资产 "${e.spec.id}" 的母版 \`${e.spec.masterAsset}\`（母版那一发画出来之后当参考图递）`);
  }
  return out;
}
