// 票 13 的**纯**那一半：母版那一发怎么问、它的画布规则、以及两条**免费**判据。
// I/O（读文件、调生图、落盘、记帐）在 `pack.ts` 的**母版前段**里 —— 这里一个字都不碰网络与磁盘。
//
// ⚠️ **职责收紧**（票 13 的 Q8 的原话：「master.ts 收紧职责」）：本文件只放三样 ——
//   ① 母版的提示词；② 「canonical 画布 vs 回来的那张图」那个**读数**（票 39 起它不再是判据）；
//   ③ 「这份配方会递哪些**参考图**」那份清单（Q6 的免费拦停用它）。
//   ⚠️ 别把装配、落盘、账搬进来 —— 那些是 `pack.ts` 的活，而「一个模块两件事」是本仓库反复吃亏的地方。
//
// ⚠️ **母版是什么**：`AssetRecipe.authoring[]` 里的一项（票 04）——**创作态、不进交付包**。
//   它是**基因的一张渲染图**（`DNA → 母版 → 动画`），后面所有动画都**照它画**：
//   `pack` 把这张位图当 `reference` 内联进每一次生图（`image-gen.ts` 的 `GenerateImageRequest.reference`）。
import type { CharacterDNA, MasterRatio, MasterRatioReading, StyleSpec } from "@game-maker/contracts";
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
 *
 * ⚠️ **下面「世界的约束」那段（`style.constraints`）的来源与意图未确认**（票 30 的 Q2 判「不处理」）：
 *   它是票 13 **新建本文件**时就带的，而票 13 的 Answer 里**没有记过这个决定**
 *   ⇒ **说不清当初是故意还是顺手抄的**（两种读法都有证据，谁也没定案）。
 *   ⇒ 今天**原样保留**，但**别把它读成一条被裁过的规矩** —— 票 30 只裁了
 *   「**那三张资产生图模板**不收 `style.constraints`」（见 `prompt.ts` 的 `imagePrompt`），
 *   那一条**不适用于这里**。裁定原文见 `.scratch/game-maker-v2/issues/30-constraints-not-in-image-prompt.md`。
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
- **侧视、朝右、正交投影**：不画透视、不画正面、不画斜侧。
- **中性站姿**：双臂自然垂下、双脚并拢站在**同一条水平线**上（所有动作都从这个姿态出发）。
- 画布是 ${canvas.w}×${canvas.h} 像素（宽 : 高 = ${canvas.w} : ${canvas.h}）。
  后面每一次动画都会**照这张图的头身比与形象**画 —— 所以比例、轮廓、配色要画准。
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
 * **那一发请求了什么 vs 回来了什么**（票 39 起它是**观察**，不再是判据）。
 *
 * ⚠️ 为什么它曾经是判据、又为什么不够格：`authoring[].size` 是我们**要求**画多大（canonical），
 *   而上游回什么尺寸由它自己的规则定（`requestSize` 锁长边 1024 / `geminiAspect` 查表 /
 *   `openaiSize` 查表）⇒ 两者**可以对不上**。今天的实测说：**对不上是常态，不是异常** ——
 *   同一个 `2:3` 回来过三种画布（832×1248 / 1184×864 / 1344×768），同一个 `1:1` 回来过两种
 *   （1024×1024 / 1344×768）⇒ `aspectRatio` 是**提示**，不是契约。而 R3 的准入条件是
 *   「**精确可算** **+ 错了一定不是设计**」—— 它过了前半句，**没过后半句**（量的是上游的手气）。
 *   ⇒ 降成观察：**记下来、放行**，不再阻断母版生成。
 *
 * ⚠️ **降的只是它的后果，量法一个字没改**：判「一致」仍然是**零容差**的整数交叉相乘。
 *   **不许顺手加容差** —— 加了，「差多少」这个读数就没了基准。
 * ⚠️ `match` **不是** `ratioDelta === 0`：后者是浮点比较，前者是整数判定的**权威值**。
 */
export function masterRatioReading(
  canvas: { w: number; h: number },
  image: { width: number; height: number },
): MasterRatioReading {
  const requestedRatio = canvas.w / canvas.h;
  const returnedRatio = image.width / image.height;
  return {
    requested: { w: canvas.w, h: canvas.h },
    returned: { w: image.width, h: image.height },
    requestedRatio,
    returnedRatio,
    ratioDelta: (returnedRatio - requestedRatio) / requestedRatio,
    match: canvas.w * image.height === image.width * canvas.h,
  };
}

/**
 * 把那份读数说成人话 —— **只陈述读数**（票 39 的 Q2）。**一行**，不折行。
 *
 * ⚠️ **两条出路被删掉了**，而且是故意的：旧文案末尾指的两条路，一条是「重出这一张」
 *   （按 **R13** 属未决 —— 人类在第六跑那一轮明确「不在本轮处理」），另一条是
 *   「把 `authoring[].size` 改成这张图真实的比例」（= **改输入迁就判据**）。
 *   ⇒ 而且**决策不该由一条观测文案来指**：观察报告事实，路是人选的。
 */
export function masterRatioLine(r: MasterRatio): string {
  const head =
    `母版 "${r.master}" 那一发回来的图是 ${r.returned.w}×${r.returned.h}` +
    `（比例 ${r.returnedRatio.toFixed(3)}），而 canonical 画布是 ${r.requested.w}×${r.requested.h}` +
    `（比例 ${r.requestedRatio.toFixed(3)}）`;
  return r.match
    ? `${head} —— **一致**。`
    : `${head} —— **差 ${(Math.abs(r.ratioDelta) * 100).toFixed(1)}%**（${r.ratioDelta > 0 ? "回来的更宽" : "回来的更高"}）。`;
}

/**
 * 那一组读数**报给人看**的那几行（票 39 的 Q1 ① / Q5）。
 *
 * ⚠️ **先报小计、再逐条列不一致的**：计数是让 `!` 与「这次压根没量」**分得开**的那一半 ——
 *   只列不一致的，一个全对的包与一个没量的包在屏幕上长得一模一样。
 * ⚠️ 那一句 why（母版是参考图）**只说一次**，不每条重复（它是**为什么值得看**，不是读数）。
 */
export function masterRatioNotes(rs: readonly MasterRatio[]): string[] {
  if (rs.length === 0) return [];
  const bad = rs.filter((r) => !r.match);
  if (bad.length === 0) return [`母版比例：${rs.length} 张都量过，全部一致。`];
  return [
    `⚠️ **母版比例**：${rs.length} 张量过 —— 一致 ${rs.length - bad.length} 张 · **不一致 ${bad.length} 张**`,
    ...bad.map((r) => `  · ${masterRatioLine(r)}`),
    "  ⚠️ 母版是参考图：它的头身比会被后面每一个动画照着画。⇒ 读数在包内 `master-ratios.json` 里。",
  ];
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
