// **GameConfig 的统一确定性审计入口**（P1 · Q5：design-to-config-residual-audit-v1 票 05）。
//
// ⚠️ **为什么要抽这一个函数**：今天同一条链路在三处各拼一遍审计族，而它们拼法不同：
//   · `compileRuntime` 的重采样循环里只跑「可重采样」那一族（引用 + 自洽 + 身份 + HUD 屏幕空间）；
//   · `compileRuntime` 落盘前再拼一遍，外加「层盖不住世界」；
//   · `runBuild` 的汇合点（`reuseConfig` 与编译两条路径都经过）**什么都不跑**，只靠 config 自己
//     的 schema。⇒ 人工改配置 / 改清单复验时，引用族以外的确定性判据全被绕过。
// ⚠️ **汇合点只调这一个函数**（`pipeline/src/create-game.ts`）：两条路径同一份实现、同一个顺序，
//   于是「路径不同 ⇒ 拦的东西不同」这件事在结构上消失。
//
// ⚠️ **两档分开返回**，不是因为判据不同，而是**失败分档不同**：
//   · `resampleable` —— 「模型错」那一族：下一发 config 可能写对，进 `modelHard` 重采样循环；
//   · `deterministic` —— 在它之上再加两族**重抽 config 也改不了**的判据：
//       · 「层盖不住世界」—— 由背景资源尺寸 + `world.size` 决定；
//       · 「这一关通不通」（`auditReachability`，B-02）—— 由地形 / 布局决定，模型下一发
//         可能写对，但**编译循环里不重采样**（它不属于「这一发写错」那一档，而是设计或清单层面的
//         确定性缺陷）⇒ 与层覆盖同档：硬失败、不落盘。
//     重抽 config 改不了 ⇒ 不重采样、不落盘。
//   ⇒ `deterministic` **包含** `resampleable`（超集），调用方按需要取哪一档。
// ⚠️ **顺序与今天的 `ops.ts` 逐条一致**，别重排：报文的次序是测试与使用者的定位线索。
import { auditEntityIdentity, auditGameConfig, ENTITY_ASSET_KINDS, type ConfigIssue, type GameConfig } from "./game-config.js";
import { auditLayerCoverage, backgroundLayerEntries } from "./layer-coverage.js";
import { auditScreenSpace, DEFAULT_HUD_LINE_HEIGHT, gameHudScreenItems } from "./screen-space.js";
import { auditReachability } from "./reachability.js";
import type { AssetKind, AssetPackManifest } from "./assetpack.js";
import type { GameDesignSpec } from "./game-design.js";

export type ConfigAuditContext = {
  manifest: AssetPackManifest;
  /** 设计层。**省略 = 不跑身份对账**（`runBuild` 的复用路径今天没有设计输入时仍可用）。 */
  design?: GameDesignSpec;
  /** 关卡作用域；省略 = 单关时自动取那一关，多关 = `scope` error（`auditEntityIdentity` 的规矩）。 */
  levelId?: string;
  viewport: { w: number; h: number };
  /** 外壳的行高常量；省略用 `DEFAULT_HUD_LINE_HEIGHT`（与 `compileRuntime` 同款）。 */
  hudLineHeight?: number;
};

export function auditConfigPipeline(
  config: GameConfig,
  ctx: ConfigAuditContext,
): { resampleable: ConfigIssue[]; deterministic: ConfigIssue[] } {
  const lineHeight = ctx.hudLineHeight ?? DEFAULT_HUD_LINE_HEIGHT;
  const resampleable: ConfigIssue[] = [
    ...auditGameConfig(config, ctx.manifest),
    ...(ctx.design === undefined ? [] : auditEntityIdentity(ctx.design, config, ctx.levelId)),
    ...auditScreenSpace(ctx.viewport, gameHudScreenItems(config, ctx.manifest, { lineHeight })),
  ];
  const deterministic: ConfigIssue[] = [
    ...resampleable,
    ...auditLayerCoverage(ctx.viewport, config.world.size,
      backgroundLayerEntries(config.scene.background.asset, config.world.size, ctx.manifest.assets)),
    ...auditReachability(config, ctx.manifest),
  ];
  return { resampleable, deterministic };
}

// ─────────────────────────────────────────────────────────────────────────────
// **D-03：resampleable 的归因**（内部纯函数，不是契约）
//
// ⚠️ 目的只有一个：让编译循环分得开「**模型写错了、下一发可能改对**」与「**包里根本没有这份
//   config 需要的那类资源**」。后者再抽三发 config 也改不了，却会被记成「模型错」—— 归错账
//   比不归更贵（人去查模型，而要继续的是清单）。
//
// ⚠️ **保守兜底**（票 06 Q2 的裁定）：所需能力必须从 **config 语义**推导（实体存在 + kind +
//   字段结构），`where` 只作索引；任何不确定 ⇒ **config 可修**、不硬拒。牺牲提前硬拒的机会，
//   换「不误拒可修复的 config」。
// ⚠️ 它**不读 message 文本**、不改 `ConfigIssue` / `auditConfigPipeline` 的形状、不新增对外码。
// ─────────────────────────────────────────────────────────────────────────────

export type ConfigIssueAttribution = {
  /** 下一发 config 可能改对的那一组（含一切无法确定的情况）。 */
  configFixable: ConfigIssue[];
  /** 清单层面缺资源：重抽 config 改不了。 */
  packRooted: ConfigIssue[];
};

const ENTITY_WHERE = /^entity "(.*)"$/;

/**
 * 把一组 `resampleable` 的 error 分成「config 可修」与「包根因」。
 *
 * @param config  这一发已经过契约的 config（**语义来源**：实体存在 / kind / 字段结构）。
 * @param manifest 当前资源包（能力来源）。
 * @param issues  `auditConfigPipeline(...).resampleable` 里的 error。
 */
export function classifyConfigIssues(
  config: GameConfig,
  manifest: AssetPackManifest,
  issues: readonly ConfigIssue[],
): ConfigIssueAttribution {
  const out: ConfigIssueAttribution = { configFixable: [], packRooted: [] };
  const hasKind = (kinds: readonly AssetKind[]) => manifest.assets.some((a) => kinds.includes(a.kind));
  /** 有没有一件**能解出 ≥2 帧**的资产（chest / danger 的状态帧能力）。 */
  const hasMultiFrame = (kinds: readonly AssetKind[]) =>
    manifest.assets.some((a) => kinds.includes(a.kind) && (a.animations ?? []).some((x) => x.frames.length >= 2));

  for (const i of issues) {
    // ⚠️ 只对 error 归因；warning 不是阻断项，按 config 可修（无害）处理。
    if (i.severity !== "error") { out.configFixable.push(i); continue; }

    const m = ENTITY_WHERE.exec(i.where);
    if (m !== null) {
      // ⚠️ 语义必须能从 config 确认：id 不在 config ⇒ 可能是模型幻觉，**config 可修**。
      const e = config.entities.find((x) => x.id === m[1]);
      if (e === undefined) { out.configFixable.push(i); continue; }
      const allowed = ENTITY_ASSET_KINDS[e.kind];
      // `decor` 的允许集是 `undefined` ⇒ 能力不明确 ⇒ config 可修。
      if (allowed === undefined) { out.configFixable.push(i); continue; }
      const needsTwo = i.code === "entity-state-frames" && (e.kind === "chest" || e.kind === "danger");
      (needsTwo ? hasMultiFrame(allowed) : hasKind(allowed)) ? out.configFixable.push(i) : out.packRooted.push(i);
      continue;
    }

    // ⚠️ `where` 的形态有 `hud.panel` / `hud.panel.size` / `hud.pip[0]` —— 三种都算 HUD。
    if (i.where === "hud.panel" || i.where.startsWith("hud.panel.") || i.where.startsWith("hud.panel[") ||
        i.where === "hud.pip" || i.where.startsWith("hud.pip.") || i.where.startsWith("hud.pip[")) {
      (hasKind(["ui"]) ? out.configFixable : out.packRooted).push(i);
      continue;
    }
    if (i.where === "player" || i.where.startsWith("player.")) {
      (hasKind(["animation"]) ? out.configFixable : out.packRooted).push(i);
      continue;
    }
    if (i.where === "scene.background" || i.where.startsWith("scene.background")) {
      (hasKind(["background"]) ? out.configFixable : out.packRooted).push(i);
      continue;
    }

    // 其它一切：无法可靠确定 ⇒ config 可修（兜底原则 6）。
    out.configFixable.push(i);
  }
  return out;
}
