// 「这份清单意味着**几次生图调用**」—— 全仓库**只此一份**（票 40）。
//
// ⚠️ **病根**：这个数以前**两处各算各的**（检查点数 image 源**资产**数 · `pack` 数真的发出去的
//   **图单元**数），中间**没有任何一步把它们对上**。第六跑量到的差：清单里 11 个 image 源资产，
//   而真发出去 **20 次**（差的那 9 个全是**展开**出来的：`scavenger` 4 个动画 = 4 次调用，
//   不是一个资产一次）。⚠️ 而检查点那个数**正是人批准付费跑时看的那个数** ⇒ 报小了 2.2 倍。
//   ⇒ 与票 37 是同一种形状：「我们声明了什么」≠「实际交付了什么」，中间没有一步把它们对上。
//
// ⚠️ **住在 `contracts` 而不是 `assets`**（票 40 的 Q1=A）：这是个**读文档就能算出来的纯函数**
//   —— 没有调色板、没有 I/O、没有生成器 —— 而 `cli` 与 `assets` **两边都依赖 contracts**
//   （`scripts/check-deps.mjs` 的图里两条边都在）。放进 `assets` 的话，检查点（`cli`）就得
//   去拿一个**文档级**的事实，那是更重的一条耦合。
//   同款先例：`reachability.ts` / `audit.ts` / `geometry.ts` / `master-ratio.ts` 都是
//   「一行形状 + 各自的推导」分文件住。
//
// ⚠️ **它只管分类，不管落盘**（票 40 的 Q2=A）：`raw`（`authoring/generated/<id>.<anim>.png`
//   这类**文件名**）留在 `pack` —— 那是**包长什么样**，不是契约事实。
//   同理，prompt 怎么拼、怎么分批、抠底用什么色，**全都不在这里**。
//
// ⚠️ **别把它与 `framePlan` 合并**（票 40 的读数 D）：那是 **drawlist 那一侧**的同一个分类骨架，
//   **粒度不同** —— `animation` 在那边**一帧一份**（4 帧 → 4 份），在这边**一个动画一份**
//   （4 帧 → **1 次调用**）。那个区别**有钱的含义**（drawlist 那份不花钱，这份一次一笔）。
//   ⇒ 两边**各自一份实现是对的**；合并会把「一帧」与「一次调用」重新说成同一件事。
import type { AssetSpec } from "./asset-spec.js";
import type { AuthoringAsset, RecipeEntry } from "./recipe.js";

/**
 * **一次生图调用**（= 一个「图单元」）要画的东西。⚠️ 没有 `raw` —— 见文件头。
 *
 * 实测切法（`pack` 侧的真跑量出来的）：`animation` 一个**动画**一次 —— 把 14 帧塞进一次调用，
 * 模型只给回来 **1 个角色**；分层背景**一层**一次；其余一个资源一次。
 */
export type ImageUnit = {
  /** 这个单元画的是哪个动画（`spec.kind === "animation"` 时才有）。 */
  anim?: string;
  /** 这个单元画的是背景的哪一层（分层 `background` 时才有）。⚠️ `index` 是**从远到近**的序。 */
  layer?: { name: string; index: number; total: number; tileX: boolean };
  /** 这一次调用要画**几帧**（一排 N 个，`pack` 拿它算画布宽度）。
   *  ⚠️ **帧数不是次数**：第六跑那 4 个动画资源共 **19 帧**，而调用是 **11 次**。 */
  frames: number;
};

/** 一张清单里**每一类**各发几次生图调用。⚠️ 四项之和 === `ImageCalls.total`（同一个事实一个来源）。 */
export type ImageCallBreakdown = {
  /** `animation` 类：一个动画一次（不是一帧一次）。 */
  animation: number;
  /** 单帧资源（`sprite` / `ui` / **没有 `layers` 的** `background`）：一个资源一次。 */
  single: number;
  /** 分层 `background` 的**层数**（一层一次）。 */
  background: number;
  /** **生图母版**（`authoring[]` 里 `source.kind === "image"` 那些）：一张一次。
   *  ⚠️ `import` 母版**不算** —— 那是人给的图，**一分钱不花**（票 40 的 Q3）。 */
  master: number;
};

/** 一张清单全派发时的生图调用账。 */
export type ImageCalls = {
  /** 合计次数。⚠️ 它是**上限**（清单完整派发时的花费），**不是预测** ——
   *  依赖失败 / 母版挂掉时，依赖者**一个字节都不往外发**（票 11 / 票 13），实际会比它少。 */
  total: number;
  breakdown: ImageCallBreakdown;
};

/**
 * **一个资源规格要发几次生图调用、每次画什么** —— 本仓库**唯一**的那把尺子。
 *
 * ⚠️ 调用它的地方：`pack`（真发出去的那一侧）与 `cli` 的检查点（报给人看的那一侧）。
 *   **不许**再有第三份抄件（`recipes-sweep.test.ts` 里那份已按票 40 的 Q5 删掉、改成 import）。
 */
export function imageUnitsOf(spec: AssetSpec): ImageUnit[] {
  if (spec.kind === "animation") return spec.animations.map((a) => ({ anim: a.name, frames: a.frames }));
  const layers = spec.kind === "background" ? spec.layers : undefined;
  if (layers !== undefined)
    return layers.map((l, i) => ({
      // ⚠️ `tileable?.x ?? false`：省略的轴 = 不平铺（票 40 在 `Layer` 上抓到的那个默认）。
      layer: { name: l.name, index: i, total: layers.length, tileX: l.tileable?.x ?? false },
      frames: 1,
    }));
  return [{ frames: 1 }];
}

/** 一个资源（或母版）那一项归哪一类。⚠️ **母版不算进来** —— 它走另一条路（`master` 一项）。 */
function classOf(unit: ImageUnit): Exclude<keyof ImageCallBreakdown, "master"> {
  if (unit.anim !== undefined) return "animation";
  if (unit.layer !== undefined) return "background";
  return "single";
}

/**
 * **一张清单全派发时要发几次生图调用** —— 按类别。
 *
 * ⚠️ 只有 `source.kind === "image"` 的项进账：`drawlist` 走的是**文本**调用（不在这里，
 *   那是另一把尺子），`import` 是**人给的图**（零调用）。
 */
export function imageCallsOf(recipe: {
  assets: readonly RecipeEntry[];
  authoring?: readonly AuthoringAsset[] | undefined;
}): ImageCalls {
  const breakdown: ImageCallBreakdown = { animation: 0, single: 0, background: 0, master: 0 };
  for (const e of recipe.assets) {
    if (e.source.kind !== "image") continue;
    for (const u of imageUnitsOf(e.spec)) breakdown[classOf(u)]++;
  }
  for (const a of recipe.authoring ?? []) if (a.source.kind === "image") breakdown.master++;
  return {
    total: breakdown.animation + breakdown.single + breakdown.background + breakdown.master,
    breakdown,
  };
}
