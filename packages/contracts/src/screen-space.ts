// **屏幕空间**那条判据 —— 两种玩法**共用一份**（票 03）。以及各玩法的「有哪些 HUD 项」（票 03 · 09）。
//
// ⚠️ **它为什么住 contracts**：`compile-*` 住在 `assets` 包里，而依赖图写死 `assets → contracts`
//   （`check-deps.mjs`）—— 它拿不到 demo 的纯层。所以两种玩法各有**一份**「HUD 项清单」放在这里，
//   compile 与 site 都读它。⚠️ 两份清单可以**各漏各的**（票 03 量到：塔防五个 HUD 成员只查了三个），
//   所以「有哪些项」必须只有一份。
//
// ⚠️ **它只管屏幕空间**：世界坐标系那一半归各自配置的 `inWorld`，**尺子不同**
//   （世界可以宽 1440，而屏幕只有 480）。
import { entityBox, type ConfigIssue, type GameConfig } from "./game-config.js";
import type { TdConfig } from "./td-config.js";
import type { AssetPackManifest } from "./assetpack.js";

/** 锚点取不到时的兜底 —— 与纯层同源。 */
const FALLBACK_ANCHOR = { x: 0.5, y: 1 } as const;

/**
 * **外壳画 HUD 文字用的行高**（像素）—— 只作为默认值。
 *
 * ⚠️ 它是**外壳的常量**，与视口同一条规矩：真正的那一份住在 `packages/demo/src/draw.ts`，
 *   由壳把它**传进来**（`compile-*` 的 `hudLineHeight`）。这里这份是给**不传**的调用方的兜底。
 * ⚠️ 它**只**用来算纯文字那类 HUD 项的**高度** —— 宽度算不出来（见 `auditScreenSpace`）。
 */
export const DEFAULT_HUD_LINE_HEIGHT = 10;

/**
 * 一个 HUD 项在屏幕空间里**能被算出来的那部分**。
 *
 * ⚠️ **三选一，而且必须选**：
 *   · `box`    —— 尺寸住在包里的那些（面板、按钮、图标），**整个盒子**都得放得下；
 *   · `height` —— **纯文字**那些：宽度取决于**运行时的内容**（`废料 120` 比 `废料 9` 宽），
 *                 构建期不可知，所以只能保证「起点在内、高度放得下」；
 *   · 都没有   —— **查不了**，而那是**硬失败**（见下）。
 *   ⚠️ 「查什么」写在**数据里**，不靠调用方记着哪几项特殊 —— 那正是票 03 要消掉的那类漂移。
 */
export type ScreenItem = {
  where: string;
  at: { x: number; y: number };
  box?: { x: number; y: number; w: number; h: number };
  height?: number;
};

/**
 * **HUD 活在屏幕空间** —— 尺子是**视口**，不是 `world.size`。
 *
 * ⚠️ 硬失败。理由是[[观察 / 判据]]那条门槛两条都满足：**精确可算**，
 *   而「把状态栏摆到看不见的地方」**没有「另一条路」这回事**（不像「越不过这块台阶可能是设计」）。
 */
export function auditScreenSpace(
  viewport: { w: number; h: number }, items: readonly ScreenItem[],
): ConfigIssue[] {
  const out: ConfigIssue[] = [];
  for (const it of items) {
    if (it.box) {
      const b = it.box;
      if (b.x < 0 || b.y < 0 || b.x + b.w > viewport.w || b.y + b.h > viewport.h)
        out.push({ severity: "error", where: it.where,
          message: `HUD 活在**屏幕空间**，必须整个落在视口 ${viewport.w}×${viewport.h} 内；` +
            `而它的盒子是 (${b.x},${b.y}) ${b.w}×${b.h}。⚠️ 尺子是**视口**不是 world.size` });
    } else if (it.height !== undefined) {
      if (it.at.x < 0 || it.at.y < 0 || it.at.x >= viewport.w || it.at.y + it.height > viewport.h)
        out.push({ severity: "error", where: it.where,
          message: `HUD 活在**屏幕空间**：它的起点是 (${it.at.x},${it.at.y})、整块高 ${it.height}px，` +
            `放不进视口 ${viewport.w}×${viewport.h}。⚠️ 它是**纯文字**，宽度取决于运行时的内容，` +
            `所以这条检查保证的是「**起点在内、高度放得下**」，**不保证**右边界不被截断` });
    } else {
      // ⚠️ 这一支是**故意**做成硬失败的：新加一项 HUD 却没说怎么量它时，
      //   必须当场响 —— 票 03 那条裂缝（塔防五个 HUD 成员只查了三个）就是这么来的。
      out.push({ severity: "error", where: it.where,
        message: `这一项在 hudScreenItems 里**既没给 \`box\` 也没给 \`height\`** —— ` +
          `屏幕空间那条检查**查不了它**。加 HUD 项时必须说清怎么量` });
    }
  }
  return out;
}

const anchorOf = (m: AssetPackManifest, id: string) =>
  m.assets.find((a) => a.id === id)?.anchor ?? FALLBACK_ANCHOR;
const sizeOf = (m: AssetPackManifest, id: string) =>
  m.assets.find((a) => a.id === id)?.size ?? { w: 1, h: 1 };

/**
 * **横版**的 HUD 项清单。⚠️ 横版没有纯文字的 HUD 项，所以 `opts` 在这里用不上 ——
 * 签名保持一致只是为了让调用方只有一套写法。
 */
export function gameHudScreenItems(
  config: GameConfig, manifest: AssetPackManifest, opts: { lineHeight: number },
): ScreenItem[] {
  void opts;
  const items: ScreenItem[] = [];
  const panel = config.hud.panel;
  items.push({
    where: "hud.panel", at: panel.at,
    box: entityBox(panel.at, panel.size, anchorOf(manifest, panel.asset)),
  });
  const pipSize = sizeOf(manifest, config.hud.pip.asset);
  const pipAnchor = anchorOf(manifest, config.hud.pip.asset);
  const pickups = config.entities.filter((e) => e.kind === "pickup").length;
  for (let i = 0; i < pickups; i++) {
    const at = { x: config.hud.pip.at.x + i * config.hud.pip.step.x, y: config.hud.pip.at.y + i * config.hud.pip.step.y };
    items.push({ where: `hud.pip[${i}]`, at, box: entityBox(at, pipSize, pipAnchor) });
  }
  return items;
}

/**
 * **塔防**的 HUD 项清单。五个成员一个不漏 ——
 * ⚠️ 其中 `hud.readout` 是**唯一没有盒子**的那个（纯文字），它只有高度。
 */
export function tdHudScreenItems(
  config: TdConfig, manifest: AssetPackManifest, opts: { lineHeight: number },
): ScreenItem[] {
  const items: ScreenItem[] = [];
  const hud = config.hud;
  items.push({ where: "hud.panel", at: hud.panel.at, box: entityBox(hud.panel.at, hud.panel.size, anchorOf(manifest, hud.panel.asset)) });
  items.push({ where: "hud.start", at: hud.start.at, box: entityBox(hud.start.at, hud.start.size, anchorOf(manifest, hud.start.asset)) });
  const btnSize = hud.buttons.size;
  const btnAnchor = anchorOf(manifest, hud.buttons.asset);
  for (const [i, t] of config.towers.entries()) {
    const at = { x: hud.buttons.at.x + i * hud.buttons.step.x, y: hud.buttons.at.y + i * hud.buttons.step.y };
    items.push({ where: `hud.buttons["${t.id}"]`, at, box: entityBox(at, btnSize, btnAnchor) });
  }
  for (const [key, ic] of Object.entries(hud.icons))
    items.push({ where: `hud.icons.${key}`, at: ic.at, box: entityBox(ic.at, sizeOf(manifest, ic.asset), anchorOf(manifest, ic.asset)) });
  // ⚠️ **唯一没有盒子的那一项**：三行读数由外壳画，**宽度取决于运行时的数字**。
  //   能算的只有高度：三行 ⇒ 起点 + 两倍行距 + 一行行高。
  items.push({ where: "hud.readout", at: hud.readout.at, height: 2 * hud.readout.step.y + opts.lineHeight });
  return items;
}
