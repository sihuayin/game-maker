// 读 (manifest, game-config) → **场景描述** —— 纯函数，**零 Phaser、零 DOM**（票 32 裁决 4）。
//
// ⚠️ **它是外壳可测的全部理由**（票 32 裁决 4）。渲染层只把这份描述铺开 ——
//   于是「数据对不对」全部可以在 vitest 里零浏览器地测出来。
//
// ⚠️ **必须「不抛」**（票 32 §3 的四条判据：出画布 · 不抛 · 占位符可见 · 控制台有警告）。
//   所以它收的是**没解析过的 JSON**，自己 defensively 解析 —— 调用方给它一份垃圾也只会
//   得到一份「全是占位符」的描述，而不是一个异常。这正是对冲票 03 那条实测：
//   **Phaser 的 loader 静默返回空且不报错** —— 不主动查，坏数据是不显形的。
//
// ⚠️ **2026-09-29：与玩法无关的那几样搬去了 `draw.ts`**（塔防也要同一套）——
//   常量、`resolveDraw`/`anchorOf`/`boxToXYWH`、图集清单、分层背景。
//   本文件现在只剩**横版特有**的那部分：玩家、实体、地形、HUD 槽位、拾取计数。
//   下面把这些名字**原样再导出**，所以既有的调用方（`index.ts` / 测试 / 外壳）一行不用改。
import {
  anchorOf, assetSize, atlasList, boxAt, boxToXYWH, buildBackground, formatIssue, FALLBACK_ANCHOR,
  FALLBACK_SIZE, SHELL_VERSION, VIEWPORT, resolveDraw,
  type AtlasToLoad, type BackgroundLayer, type Box, type Drawn, type Issue, type Missing,
  type ShellBase, type Size, type Vec,
} from "./draw.js";
import {
  DEFAULT_PLAYER_MOVE, parseAssetPack, parseGameConfig, resolvePackRef,
  type AssetPackManifest, type GameConfig,
} from "@game-maker/contracts";

export {
  BACKDROP, FALLBACK_ANCHOR, SHELL_VERSION, VIEWPORT, anchorOf, assetSize, atlasList, boxAt, boxToXYWH,
  formatIssue, resolveDraw,
  type AtlasToLoad, type BackgroundLayer, type Box, type Draw, type Drawn, type Issue, type Missing,
  type ShellBase, type Size, type Vec,
} from "./draw.js";

export type EntityDesc = {
  id: string;
  kind: "solid" | "pickup" | "hazard" | "goal" | "decor";
  /** 碰撞/摆放盒（世界像素，左上角）。**由 `at` 与锚点推出来**，不是 `at` 本身。 */
  box: Box;
  draw: Drawn;
  /** 若资源是 animation：逐帧名（壳拿去建 Phaser 动画）。 */
  frames?: string[];
  motion?: { axis: "x" | "y"; distance: number; periodMs: number };
};

export type PlayerDesc = {
  draw: Drawn;
  /** 动作名 → 帧名列表（**显式映射**，票 09 裁决 10）。 */
  anims: Record<string, string[]>;
  at: Vec;
  box: Box;
  /** 手感。⚠️ 默认值只有一处来源（票 09 裁决 11）—— 由契约的 `playerMoveOf` 给。 */
  move: { speed: number; jumpVelocity: number; gravity: number };
};

export type HudDesc = {
  /**
   * HUD 的摆放。⚠️ **盒子一并给出来**（与 `BackgroundLayer` 同款）——
   *   HUD 是**屏幕空间**的，装配期要拿这个盒子对**视口**（不是 `world.size`）校验，
   *   而那两处必须用**同一个盒子**，否则「校验过的」与「画出来的」又是两份。
   */
  panel: { draw: Drawn; box: Box };
  /** 一个拾取物一个槽 —— 槽位数 = `pickupCount`（**同一个数**，票 09 裁决 8）。 */
  pips: { draw: Drawn; at: Vec; box: Box }[];
};

export type WorldDescription = ShellBase & {
  terrain: Box[];
  entities: EntityDesc[];
  player: PlayerDesc;
  hud: HudDesc;
  objective: { gate: string; pickupCount: number };
};

/** 兜底：连 config 都没有时，玩家也得有个盒子，否则渲染层没法把相机挂上去。 */
function fallbackPlayer(issues: Issue[]): PlayerDesc {
  const at: Vec = { x: 0, y: 270 };
  const box = boxAt(at, FALLBACK_SIZE, FALLBACK_ANCHOR);
  issues.push({ severity: "error", where: "player", message: `没有 game-config（或它不过 schema）—— 玩家用占位符顶上` });
  return {
    draw: { missing: true, label: "player", reason: "没有 game-config", ...boxToXYWH(box) },
    anims: {}, at, box, move: { ...DEFAULT_PLAYER_MOVE },
  };
}

/**
 * **本层的中心**：把「一个资源包 + 一份 game-config」读成「一幅画 + 一堆盒子」。
 *
 * ⚠️ **它绝不抛** —— 传 `undefined`、传垃圾、传一份过不了 schema 的 config，
 *   都只会得到一份「全是占位符」的描述 + 一堆 `issues`。零数据也必须起得来（裁决 3）。
 */
export function buildWorld(
  manifest: unknown, config: unknown, opts: { packBase?: string } = {},
): WorldDescription {
  const issues: Issue[] = [];
  const base = opts.packBase ?? "";

  // ── 解析（失败**不抛**，只记 issue）──────────────────────────────────────
  const mp = parseAssetPack(manifest ?? {});
  const pack: AssetPackManifest | null = mp.ok ? mp.value : null;
  if (!mp.ok) for (const e of mp.errors.slice(0, 4)) issues.push({ severity: "error", where: "manifest", message: e });

  const cp = parseGameConfig(config ?? {});
  const cfg: GameConfig | null = cp.ok ? cp.value : null;
  if (!cp.ok) for (const e of cp.errors.slice(0, 6)) issues.push({ severity: "error", where: "game-config", message: e });

  // ── 要加载的图集 ────────────────────────────────────────────────────────
  const atlases: AtlasToLoad[] = atlasList(pack, base);

  if (!pack) {
    return {
      shellVersion: SHELL_VERSION, viewport: { ...VIEWPORT }, worldSize: { ...VIEWPORT },
      atlases: [], issues, background: [], terrain: [], entities: [],
      hud: { panel: { draw: hudFallback("没有资源包"), box: { x: 0, y: 0, w: VIEWPORT.w, h: VIEWPORT.h } }, pips: [] },
      player: fallbackPlayer(issues), objective: { gate: "", pickupCount: 0 },
    };
  }
  if (!cfg) {
    return {
      shellVersion: SHELL_VERSION, viewport: { ...VIEWPORT }, worldSize: { ...VIEWPORT },
      atlases, issues, background: [], terrain: [], entities: [],
      hud: { panel: { draw: hudFallback("没有 game-config"), box: { x: 0, y: 0, w: VIEWPORT.w, h: VIEWPORT.h } }, pips: [] },
      player: fallbackPlayer(issues), objective: { gate: "", pickupCount: 0 },
    };
  }

  const W = cfg.world.size.w, H = cfg.world.size.h;

  // ── 背景：**一个资源 = 一摞层**（第 i 层 = 第 i 帧，票 24 的 Layer）────────
  const background = buildBackground(pack, cfg.scene.background.asset, W, H, issues, { w: VIEWPORT.w, h: VIEWPORT.h });

  // ── 地形（看不见的碰撞）与实体（看得见的）──────────────────────────────
  const terrain: Box[] = cfg.terrain.map((t) => ({ x: t.x, y: t.y, w: t.w, h: t.h }));

  const entities: EntityDesc[] = cfg.entities.map((e) => {
    const draw = resolveDraw(pack, e.at, { asset: e.asset, ...(e.anim ? { anim: e.anim } : {}) },
      issues, `entity "${e.id}"`, e.asset, e.body);
    const size = e.body ?? assetSize(pack, e.asset) ?? FALLBACK_SIZE;
    const anchor = anchorOf(pack, e.asset);
    const res = resolvePackRef({ asset: e.asset, ...(e.anim ? { anim: e.anim } : {}) }, pack);
    return {
      id: e.id, kind: e.kind, box: boxAt(e.at, size, anchor), draw,
      ...(res.ok && res.frames.length > 1 ? { frames: res.frames.map((f) => f.name) } : {}),
      ...(e.motion ? { motion: e.motion } : {}),
    };
  });

  // ── 玩家 ────────────────────────────────────────────────────────────────
  const playerSize = assetSize(pack, cfg.player.asset) ?? FALLBACK_SIZE;
  const playerAnchor = anchorOf(pack, cfg.player.asset);
  const anims: Record<string, string[]> = {};
  for (const [action, anim] of Object.entries(cfg.player.anims)) {
    const r = resolvePackRef({ asset: cfg.player.asset, anim }, pack);
    if (r.ok) anims[action] = r.frames.map((f) => f.name);
    else issues.push({ severity: "error", where: `player.anims.${action}`, message: r.error });
  }
  // ⚠️ **不能拿 `{ asset }` 去解玩家本体** —— 它按定义有多个动画，那样必然撞上
  //   「必须指明 anim」（票 41 抓到过同一个坑）。这里要的只是「动画跑起来之前别空着」，
  //   所以拿**第一个解得动的动作**当起点 —— 真帧由渲染层的动画接管。
  const seedAction = (anims.idle ? "idle" : Object.keys(anims)[0]) as keyof typeof cfg.player.anims | undefined;
  const seedRef = seedAction
    ? { asset: cfg.player.asset, anim: cfg.player.anims[seedAction] }
    : { asset: cfg.player.asset };
  const player: PlayerDesc = {
    draw: resolveDraw(pack, cfg.player.at, seedRef, issues, "player", cfg.player.asset),
    anims, at: cfg.player.at, box: boxAt(cfg.player.at, playerSize, playerAnchor),
    move: cfg.player.move ?? { ...DEFAULT_PLAYER_MOVE },
  };

  // ── HUD ─────────────────────────────────────────────────────────────────
  const pickups = cfg.entities.filter((e) => e.kind === "pickup").length;
  const panelSize = cfg.hud.panel.size;
  const hudPanel = resolveDraw(pack, cfg.hud.panel.at, { asset: cfg.hud.panel.asset },
    issues, "hud.panel", cfg.hud.panel.asset, panelSize);
  const pipSize = assetSize(pack, cfg.hud.pip.asset) ?? FALLBACK_SIZE;
  const pipAnchor = anchorOf(pack, cfg.hud.pip.asset);
  const pips = Array.from({ length: pickups }, (_, i) => {
    const at = { x: cfg.hud.pip.at.x + i * cfg.hud.pip.step.x, y: cfg.hud.pip.at.y + i * cfg.hud.pip.step.y };
    return {
      draw: resolveDraw(pack, at, { asset: cfg.hud.pip.asset }, issues, `hud.pip[${i}]`, cfg.hud.pip.asset),
      at, box: boxAt(at, pipSize, pipAnchor),
    };
  });

  if (!cfg.entities.some((e) => e.id === cfg.objective.gate && e.kind === "goal"))
    issues.push({ severity: "error", where: "objective.gate", message: `找不到 id 为 "${cfg.objective.gate}" 的 goal 实体` });

  return {
    shellVersion: SHELL_VERSION, viewport: { ...VIEWPORT }, worldSize: { w: W, h: H }, atlases, issues,
    background, terrain, entities, player,
    hud: { panel: { draw: hudPanel, box: boxAt(cfg.hud.panel.at, panelSize, anchorOf(pack, cfg.hud.panel.asset)) }, pips },
    objective: { gate: cfg.objective.gate, pickupCount: pickups },
  };
}

function hudFallback(reason: string): Missing {
  return { missing: true, label: "hud.panel", reason, x: 0, y: 0, w: VIEWPORT.w, h: VIEWPORT.h };
}
