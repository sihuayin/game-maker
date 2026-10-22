// **层盖不住世界**那条判据，与它唯一的那份规则（票 65）。
//
// ⚠️ **三个同名邻居，一个都别混**（本仓踩过「两份并存的必然漂移」那笔账）：
//   · `coverage.ts` 的 `LayerCoverage` —— 交付态**像素比例**（`assetpack-coverage/v1` sidecar）：
//     这一层画得有多满。吃的是图集像素，算出它在 `pack` 那一步。
//   · `qa.ts` 的 `layer-coverage` 判决名 —— **有意不在 QA 族里**；2026-10-22 起由**合成器
//     自己**跑（`qa/src/layers.ts`），判据本体仍调**本文件**的 `auditLayerCoverage`。
//     ⚠️ 「不属于任何族」与「没人跑它」是两件事 —— 以前是后者，现在只是前者。
//   · **本文件** —— **几何**：视差 p 的层跟着镜头退，镜头走到尽头时它还剩不剩得下一屏。
//
// ✅ **它是硬失败**：三个数（世界多宽 · 视口多大 · 每层退多少）都是给定的 ⇒ **精确可算**，
//   而「背景盖不住世界」没有「另一条路」这回事（对照[[观察 / 判据]]那条门槛）。
//
// ⚠️ **它为什么住 contracts**：同一条判据要在**两个包里各跑一次** —— `compile-runtime`
//   （`config` 步，住 `assets`）与站点装配（住 `demo`）—— 而 `check-deps.mjs` 的 `ALLOWED` 里
//   **`assets` 与 `demo` 之间没有边** ⇒ 共同祖先只有这里。
// ⚠️⚠️ **而规则本身也必须住这儿**：`draw.ts:221` 那条 `const w = tileX ? W : nom.w` 若在
//   config 侧再写一遍，就是**第二份真相** —— 两边各抄一份的实现**必然漂移**，
//   而漂移的下场是「校验过的」与「外壳要画的」不是同一件事（票 65 §4③ 那张表里 (B) 被否的理由）。
//   ⇒ 一条规则、三个调用者（`draw.ts` · config 步 · 站点装配），`layerDrawnSize` 是它唯一的家。
import type { ConfigIssue } from "./game-config.js";

/**
 * 宽高两个数。
 *
 * ⚠️ **不引 `game-config.ts` 的 `Size`** —— 那个名字是**一份 zod 对象**（`game-config.ts:34`），
 *   本文件要的是**结构类型**（视口是世界的一个尺寸，不是一份待校验的数据）。
 */
export type Extent = { w: number; h: number };

/**
 * 一层背景里**与「画出来多大」有关的那两格** —— `Layer` 自己不带 `nominal`
 * （尺寸住在 `AssetPackEntry.size` 上，票 27 把它定为必填）。
 */
export type LayerDrawInput = {
  /** 可平铺的轴。缺省 = 不平铺（`assetpack.ts:88` 两个轴各自默认 `false`）。 */
  tileable?: { x: boolean; y: boolean } | undefined;
  /** 资源的**标称尺寸**（`AssetPackEntry.size`）—— 不是帧的真实尺寸，见下。 */
  nominal: Extent;
};

/**
 * 一层背景**画出来多大** —— **`draw.ts:221` 那条规则本身**（票 65 把它提到这里）。
 *
 * ⚠️ **可平铺的轴铺满整个世界**（`worldSize`），不平铺的轴用资源的**标称尺寸** ——
 *   因为视差 p 的层要盖住宽 `W` 的世界，铺到 `W` 就恒成立。
 * ⚠️ 用的是**标称尺寸**而不是帧的真实尺寸：各帧真实尺寸只住在图集 JSON 里，**纯函数读不到它**
 *   （`buildBackground` 的注释逐字）。
 */
export function layerDrawnSize(layer: LayerDrawInput, worldSize: Extent): Extent {
  return {
    w: layer.tileable?.x ? worldSize.w : layer.nominal.w,
    h: layer.tileable?.y ? worldSize.h : layer.nominal.h,
  };
}

/**
 * 镜头走到尽头时，这一层在屏幕上还剩多长（**算出来的，不是拍的**）。
 *
 * 镜头走 `travel` 像素时，跟着走 `parallax` 的层在屏幕上退掉 `parallax × travel`。
 * 最坏情况（镜头在尽头）剩下这么多，它必须还够铺满一屏。
 */
export function coveredExtent(drawn: number, parallax: number, travel: number): number {
  return drawn - parallax * travel;
}

/**
 * 一层背景进审计时要给的那几样 —— **算好的 primitive**。
 *
 * ⚠️ **审计函数不做资源解析**：那一半是各包自己的事（`demo` 要报 `draw.missing` ——
 *   解不到的层画的是占位符；config 侧解不到就**一条都不报**，因为 `auditGameConfig`
 *   的引用族已经报过「这份 config 指着一个不存在的资源」）。**两边共用的是规则与判据，不是入参的来路。**
 * ⚠️ `name` 两侧必须**逐字相同**：契约把帧名钉成 `<背景 id>.<层名>`（`assetpack.ts:68` 的 superRefine），
 *   所以 config 侧用 `${assetId}.${layer.name}` 拼得出的名字，与站点侧 `draw.frame` 是同一个字符串。
 */
export type LayerCoverageEntry = {
  /** 出问题的位置 —— 两侧都写 `scene.background[<下标>]`。 */
  where: string;
  /** 层的名字（站点侧 = 帧名；解不到资源时站点侧写 `"(解不到的层)"`）。 */
  name: string;
  /** 这一层跟着镜头走多快：0 = 不动（最远），1 = 与镜头同速。 */
  parallax: number;
  /** 由 `layerDrawnSize` 算出来的盒（世界像素）。 */
  drawn: Extent;
};

/** 背景那一份（`AssetPackManifest.assets[]` 里的一项）—— 只要与本判据有关的两格。
 *
 *  ⚠️ 结构化类型（不引 `AssetPackManifest` / `AssetPackEntry`）：与 `Extent` 同一条理由 ——
 *    本文件要的是**结构**，不是一份待校验的数据。
 */
export type BackgroundAssetLayers = {
  /** 资源 id（帧名前缀）。 */
  readonly id: string;
  /** 资源的**标称尺寸**（`AssetPackEntry.size`，票 27 定为必填）。 */
  readonly size: Extent;
  /** 背景的层（非背景资源没有这一格）。 */
  readonly layers?: readonly {
    readonly name: string;
    readonly parallax: number;
    readonly tileable?: { readonly x: boolean; readonly y: boolean } | undefined;
  }[] | undefined;
};

/**
 * 「这份 config 的背景层」→ `auditLayerCoverage` 要吃的那种 primitive。
 *
 *  ⚠️ **不做资源解析**：解不到那件背景时**一条都不给** ——「这份 config 指着一个不存在的背景」
 *    由引用族（`auditReferences`）报，本判据只回答**几何**那一问。
 *  ⚠️ 层的名字拼成 `${资源 id}.${层名}` —— 契约把帧名**逐字钉死**就是这个形状
 *    （`assetpack.ts` 的 superRefine）⇒ 与站点装配侧读到的 `draw.frame` 是**同一个字符串**，
 *    这正是「两侧 message 逐字相等」那条判据（验收条件 4）站得住的原因。
 *  ⚠️ **config 侧的两个调用者调的是同一个本函数**（`assets` 的 `compile-runtime` 与 `qa` 的
 *    合成器）—— 规则共用之外，**入参的来路**也共用：那是「不得出现两个事实源」的另一半。
 */
export function backgroundLayerEntries(
  backgroundAssetId: string, worldSize: Extent, assets: readonly BackgroundAssetLayers[],
): LayerCoverageEntry[] {
  const a = assets.find((x) => x.id === backgroundAssetId);
  if (a === undefined) return [];
  return (a.layers ?? []).map((l, i) => ({
    where: `scene.background[${i}]`,
    name: `${a.id}.${l.name}`,
    parallax: l.parallax,
    drawn: layerDrawnSize({ tileable: l.tileable, nominal: a.size }, worldSize),
  }));
}

/**
 * **层盖不住世界** —— 逐层判，命中即一条 `error`。
 *
 * ⚠️ **message 必须自包含**（票 65 边界 3）：世界尺寸 · 视口 · 这一层的 parallax ·
 *   最坏时剩多少 px，四样都在句子里。理由是 `config` 步**抛了就不落那份坏配置** ⇒
 *   失败现场里**没有 `game-config.json` 可读**，读者不该靠一次除法反推世界多宽。
 * ⚠️ 而两个调用者传的是**同一个函数** ⇒ 两侧 message **逐字相等**（票 65 验收条件 4 的第二种证法）。
 */
export function auditLayerCoverage(
  viewport: Extent, worldSize: Extent, entries: readonly LayerCoverageEntry[],
): ConfigIssue[] {
  const out: ConfigIssue[] = [];
  const travelX = Math.max(0, worldSize.w - viewport.w);
  const travelY = Math.max(0, worldSize.h - viewport.h);
  for (const e of entries) {
    const coverX = coveredExtent(e.drawn.w, e.parallax, travelX);
    const coverY = coveredExtent(e.drawn.h, e.parallax, travelY);
    if (coverX < viewport.w || coverY < viewport.h)
      out.push({ severity: "error", where: e.where,
        message: `层 "${e.name}" 盖不住世界：世界 ${worldSize.w}×${worldSize.h}px、视口 ${viewport.w}×${viewport.h}px` +
          `（镜头横向最多走 ${travelX}px、纵向 ${travelY}px），它画出来 ${e.drawn.w}×${e.drawn.h}px，` +
          `视差 ${e.parallax} 会跟着镜头退掉 ${Math.round(e.parallax * travelX)}×${Math.round(e.parallax * travelY)}px，` +
          `最坏时屏幕上只剩 ${Math.round(coverX)}×${Math.round(coverY)}px，而视口要 ${viewport.w}×${viewport.h}px。` +
          `—— **不平铺的层只有 parallax = 0 才恒成立**（票 40 算过的那条）` });
  }
  return out;
}
