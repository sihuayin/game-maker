// **外壳共用的底座**：常量 · 「画得出/画不出」这件事的表达 · 图集清单 · 分层背景。
//
// ⚠️ **它存在的理由是一次真实的撞车**：塔防（`td/`）要的这些东西与横版**一模一样**，
//   而 `world.ts` 里它们原来是私有的。各写一份的代价不是「多几行」，是
//   **同一个公式有两个答案** —— 这个仓库已经为这件事留过疤（票 48：盒子公式曾在三个地方
//   各写一份，「校验过的盒子」与「画出来的盒子」差一点点，而那正是**静默**糊掉像素的错）。
//
// ⚠️ **这里零 Phaser、零 DOM**（与 `world.ts` 同一条纪律）—— 它是纯层的一部分。
//   渲染层与入口在 `src/shell/`，由 esbuild 单独打成 `dist/shell.js`。
import type { AssetPackManifest } from "@game-maker/contracts";
import { entityBox, resolvePackRef, FALLBACK_ANCHOR } from "@game-maker/contracts";
export { FALLBACK_ANCHOR };

/** 视口 = **外壳常量**（票 32 裁决 1）。于是 1 交付像素 = 1 屏幕像素字面成立。 */
export const VIEWPORT = { w: 480, h: 270 } as const;

/**
 * 外壳版本号（票 32 裁决 6）。`site` 装配时把它写进 `site.json` ——
 * **站点产物不在 git 里**（Q9），拷走之后必须自己说明自己是怎么来的。
 *
 * ⚠️ **2026-09-29 由 "1" 升到 "2"**：外壳里多了塔防那一族玩法（票 09 的那条
 * 「支持一种新玩法 = 出一个新版本的外壳」）。⚠️ **升版本号不是形式** ——
 * `entry.ts` 拿它比对 `site.json`，那正是「站点与外壳对不上、先怀疑拷错了」这条
 * 唯一的探测手段；两个玩法各出一个 bundle 而各自都叫 "1" 的话，那条探测会**静默失效**。
 * 这也是**为什么两个玩法共用一份 bundle**：`CONTEXT.md` 两处写着「所有站点共用同一份、
 * 逐字节相同」，拆成两份就把那句话变成假的，而它换来的只是省下另 30KB 的重复代码。
 */
export const SHELL_VERSION = "2";

/**
 * 屏幕**底色**（票 50）—— 什么都没有画的地方透过去是什么。
 * ⚠️ 它**是外壳的常量，不是数据**（与 `VIEWPORT` 同一条规矩）：让「这个世界长什么样」
 *   漏进一个声称与游戏无关的外壳，是另一种错。
 */
/**
 * **外壳画 HUD 文字用的行高**（像素）。⚠️ 它是**外壳的常量，不是数据**（与 `VIEWPORT` 同一条规矩）。
 *
 * ⚠️ 它为什么必须存在：HUD 里有一类是**纯文字**（塔防的三行读数），它的**宽度取决于运行时的数字**
 *   （`废料 120` 比 `废料 9` 宽），构建期不可知 —— 能算的**只有高度**，而高度要用到行高。
 *   ⇒ 屏幕空间那条检查靠它才能把「整块放不放得下」判准（票 09）。
 *   ⚠️ 它与 `VIEWPORT` 一样**当参数传进 `compile-*`**，不在这里被复制第二份。
 */
export const HUD_LINE_HEIGHT = 10;

export const BACKDROP = "#000000";

export type Vec = { x: number; y: number };
export type Size = { w: number; h: number };
export type Box = { x: number; y: number; w: number; h: number };

/** 与控制台警告同源。⚠️ 「哪里 + 怎么了」拆两个字段。 */
export type Issue = { severity: "error" | "warning"; where: string; message: string };

/** 一份要加载的图集。 ⚠️ `key` 用图集的**图片路径**：它是包内唯一的，且能被放进 URL。 */
export type AtlasToLoad = { key: string; json: string; image: string };

/** 一个**画不出来**的位置。壳在原位画品红/黑棋盘 + 打控制台警告，**游戏继续**（裁决 3）。 */
export type Missing = {
  missing: true;
  x: number; y: number; w: number; h: number;
  label: string;
  reason: string;
};

/** 画得出来的东西：在哪一帧、摆在哪、**锚点是什么**。 */
export type Draw = {
  /** ⚠️ **显式 `false`，不是可选字段** —— 可选的话成功时读出来是 `undefined`，
   *  调用方分不清「明确地好」与「没设过」。判别式要能一眼分开。 */
  missing: false;
  atlas: string;
  frame: string;
  /** 锚点落点的世界坐标（**不是左上角**）。 */
  at: Vec;
  /** Phaser 的 origin。**逐帧来自资源**，壳不自己算。 */
  anchor: Vec;
  w: number; h: number;
};

export type Drawn = Draw | Missing;

/** 背景的一层。⚠️ 视差与可平铺**住在包里**（票 09 裁决 6）。 */
export type BackgroundLayer = {
  draw: Drawn;
  parallax: number;
  tileX: boolean; tileY: boolean;
  /** 要铺的矩形（世界像素，左上角）。**纯函数算好的 —— 壳不做几何。** */
  box: Box;
};

/**
 * 每个玩法都要给的那几样。**两个 `WorldDescription` 都含它** ——
 * 但**不共用同一个 `WorldDescription` 类型**：塔防没有 `player`，横版没有 `path`，
 * 为了合并而给它们加可选字段，会让「玩家出生点必须在地面之上」这类校验变成空转。
 */
export type ShellBase = {
  shellVersion: string;
  viewport: Size;
  worldSize: Size;
  atlases: AtlasToLoad[];
  issues: Issue[];
  background: BackgroundLayer[];
};

/** 未知资源时的占位尺寸。可见即可 —— 它的岗位是「让坏了显形」，不是好看。 */
export const FALLBACK_SIZE: Size = { w: 32, h: 32 };

/** 与控制台警告同源的那一行。**两个玩法共用**，别各写一份。 */
export const formatIssue = (i: Issue): string => `[${i.severity}] ${i.where}: ${i.message}`;

export const isVec = (v: unknown): v is Vec =>
  typeof v === "object" && v !== null &&
  typeof (v as Vec).x === "number" && typeof (v as Vec).y === "number";

/**
 * 取**资源级**的锚点。
 *
 * ⚠️ **`at` 是「锚点落在哪」，不是「左上角在哪」** —— 这条由资源包**自己**定死：
 *   角色的锚点是 `{x:.5, y:.95}`（**脚**）、世界里的道具是 `{x:.5, y:1}`（底边中心）、
 *   HUD 面板是 `{x:0, y:1}`（左下角）。所以**一条规则管全部**。
 *
 * ⚠️ **这里拿的是 manifest 上那一份（资源级），不是图集 JSON 里的逐帧那一份**：
 *   碰撞/占位盒要的是**稳定**，逐帧锚点归 Phaser 自己逐帧 `setOrigin`。
 */
export function anchorOf(manifest: AssetPackManifest | null, assetId: string): Vec {
  const a = manifest?.assets.find((x) => x.id === assetId)?.anchor;
  return isVec(a) ? { x: a.x, y: a.y } : FALLBACK_ANCHOR;
}

export function assetSize(pack: AssetPackManifest | null, id: string): Size | null {
  return pack?.assets.find((a) => a.id === id)?.size ?? null;
}

/** ⚠️ **盒子不在这里算** —— 用的是契约的 `entityBox`。全仓只此一处算盒子。 */
export const boxAt = entityBox;

export const boxToXYWH = (b: Box) => ({ x: b.x, y: b.y, w: b.w, h: b.h });

/**
 * 把一个引用解成「画得出来 / 画不出来」。
 *
 * ⚠️ 画不出来时**仍然给一个盒子** —— 占位符必须落在原位（裁决 3 的「出画布」）。
 *   尺寸取不出来就用兜底尺寸，锚点取不出来就用兜底锚点：**宁可位置差一点，不可什么都没有**。
 */
export function resolveDraw(
  manifest: AssetPackManifest | null, at: Vec, ref: { asset: string; anim?: string },
  issues: Issue[], where: string, label: string, sizeOverride?: Size,
): Drawn {
  const res = manifest ? resolvePackRef(ref, manifest) : { ok: false as const, error: `没有资源包` };
  if (!res.ok) {
    issues.push({ severity: "error", where, message: `${label}：${res.error} —— 原位画占位符，游戏继续` });
    const size = sizeOverride ?? FALLBACK_SIZE;
    const anchor = anchorOf(manifest, ref.asset);
    return { missing: true, label, reason: res.error, ...boxToXYWH(boxAt(at, size, anchor)) };
  }
  const atlas = res.asset.atlasId;
  const image = manifest!.atlases.find((x) => x.id === atlas)?.image ?? atlas;
  const frame = res.frames[0];
  const size = sizeOverride ?? res.asset.size;
  const anchor = anchorOf(manifest, ref.asset);
  return {
    missing: false,
    atlas: image, frame: frame?.name ?? ref.asset,
    at: { x: at.x, y: at.y }, anchor, w: size.w, h: size.h,
  };
}

/**
 * 要加载的图集清单。
 *
 * ⚠️ **路径拼接只此一处** —— `packBase` 少一个 `../` 就是 404，而
 *   **Phaser 的 loader 是静默失败的**（票 03 实测：能启动、出画布、横幅正常打印，
 *   却一张图都不加载且不报错）。两份拼接 = 两次机会弄错同一个字符串。
 */
export function atlasList(pack: AssetPackManifest | null, packBase: string): AtlasToLoad[] {
  return (pack?.atlases ?? []).map((a) => ({
    key: a.image, json: `${packBase}${a.meta}`, image: `${packBase}${a.image}`,
  }));
}

/**
 * 一摞分层背景 —— **一个资源 = 一摞层**（第 i 层 = 第 i 帧，票 24 的 `Layer`）。
 *
 * ⚠️ 这段从 `world.ts` 提出来共用（47 行，两个玩法都要）：层与帧一一对应的检查、
 *   「可平铺的层铺满整个世界」那条算法、以及**用标称尺寸而不是帧的真实尺寸**
 *   （各帧真实尺寸只住在图集 JSON 里，纯函数读不到它）。
 *   塔防的场地是砖铺的、**不用**背景，但「将来某个塔防关卡想给一张远景」时它就在那儿。
 */
export function buildBackground(
  pack: AssetPackManifest | null, assetId: string, W: number, H: number, issues: Issue[], fallbackSize: Size,
): BackgroundLayer[] {
  const ref = { asset: assetId };
  const res = pack ? resolvePackRef(ref, pack) : { ok: false as const, error: "没有资源包" };
  if (!res.ok) {
    issues.push({ severity: "error", where: "scene.background", message: `${res.error} —— 原位画占位符，游戏继续` });
    return [{
      draw: { missing: true, label: assetId, reason: res.error, x: 0, y: 0, w: fallbackSize.w, h: fallbackSize.h },
      parallax: 0, tileX: false, tileY: false, box: { x: 0, y: 0, w: fallbackSize.w, h: fallbackSize.h },
    }];
  }
  const out: BackgroundLayer[] = [];
  const layers = res.asset.layers ?? [];
  const image = pack!.atlases.find((x) => x.id === res.asset.atlasId)?.image ?? res.asset.atlasId;
  if (layers.length !== res.frames.length)
    issues.push({
      severity: "error", where: "scene.background",
      message: `资源 "${assetId}" 有 ${layers.length} 层却有 ${res.frames.length} 帧 —— 层与帧必须一一对应（第 i 层 = 第 i 帧）`,
    });
  const n = Math.max(layers.length, 1);
  for (let i = 0; i < n; i++) {
    const layer = layers[i];
    const frame = res.frames[i];
    if (!frame) {
      issues.push({ severity: "error", where: `scene.background[${i}]`, message: `第 ${i} 层没有对应的帧` });
      continue;
    }
    const parallax = layer?.parallax ?? 0;
    const tileX = layer?.tileable?.x ?? false, tileY = layer?.tileable?.y ?? false;
    const anchor = anchorOf(pack, assetId);
    // ⚠️ **可平铺的层铺满整个世界**：视差 p 的层要盖住宽 W 的世界，铺到 W 就恒成立
    const nom = res.asset.size;
    const w = tileX ? W : nom.w, h = tileY ? H : nom.h;
    out.push({
      draw: { missing: false, atlas: image, frame: frame.name, at: { x: 0, y: 0 }, anchor, w: nom.w, h: nom.h },
      parallax, tileX, tileY, box: boxAt({ x: 0, y: 0 }, { w, h }, anchor),
    });
  }
  return out;
}

