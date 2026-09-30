// 读 (manifest, td-config) → **塔防场景描述** —— 纯函数，**零 Phaser、零 DOM**。
//
// ⚠️ 纪律与横版的 `world.ts` **完全一样**（票 32 裁决 4 的那三条）：
//   · **绝不抛** —— 传 undefined / 传垃圾 / 传过不了 schema 的配置，只会得到一份
//     「全是占位符」的描述 + 一堆 `issues`（零数据也必须起得来）；
//   · 盒子由 `entityBox` + 资源级锚点算（**全仓只此一处算盒子**）；
//   · 凡是**几何**（弧长、拐角朝向、格子换算）都在这里算完，外壳**不做几何**。
import {
  anchorOf, assetSize, atlasList, boxAt, formatIssue, FALLBACK_SIZE, HUD_LINE_HEIGHT,
  resolveDraw, SHELL_VERSION, VIEWPORT,
  type AtlasToLoad, type Box, type Drawn, type Issue, type ShellBase, type Size, type Vec,
} from "../draw.js";
import {
  parseAssetPack, parseTdConfig, tdHudScreenItems, tdPathLength,
  type AssetPackManifest, type TdConfig,
} from "@game-maker/contracts";

export { formatIssue, SHELL_VERSION, VIEWPORT };
export type { AtlasToLoad, Box, Drawn, Issue, Size, Vec };

/** 场地的一格。⚠️ **逐格给出来**，外壳不做 `c × cell` 这种乘法 —— 那是几何。 */
export type TdTile = { draw: Drawn; box: Box };

/** 一个机关的等级数值（从配置原样搬过来）。 */
export type TdTowerLevelDesc = { range: number; damage: number; fireMs: number; slow?: { factor: number; ms: number } };

export type TdTowerDesc = {
  id: string;
  name: string;
  /** 建好之后摆着的样子。 */
  draw: Drawn;
  attack: "single" | "aoe";
  targeting: "first" | "strongest";
  cost: number;
  upgradeCost: number;
  levels: TdTowerLevelDesc[];
  /** 装饰性的抛射物。⚠️ 伤害**在开火那一刻**就结算了（契约文件头规则 ①）。 */
  projectile?: { draw: Drawn; speed: number };
  /** 开火时在原地播一次的特效（逐帧名在 `frames`）。 */
  fx?: { draw: Drawn; frames: string[] };
};

export type TdEnemyDesc = {
  id: string;
  name: string;
  draw: Drawn;
  /** 走路动画的逐帧名（壳拿去建 Phaser 动画）。 */
  frames: string[];
  hp: number; speed: number; bounty: number; armor: number; leakCost: number;
  /** 占位盒（世界像素）。锚点是**中心** —— 俯视图里没有「脚踩在哪条线上」这回事。 */
  box: Box;
};

/** 一波：**在纯层就摊平成绝对毫秒**，外壳不做时间算术（也不该做）。 */
export type TdWaveDesc = { spawns: { enemy: string; atMs: number }[]; durationMs: number };

export type TdHudButton = { draw: Drawn; at: Vec; box: Box; towerId: string };

export type TdWorldDescription = ShellBase & {
  arena: { cell: number; cols: number; rows: number; tiles: TdTile[] };
  path: { points: Vec[]; cum: number[]; total: number };
  core: { draw: Drawn; at: Vec; box: Box };
  slots: { id: string; draw: Drawn; at: Vec; box: Box }[];
  slotActive: { draw: Drawn; size: Size };
  towers: TdTowerDesc[];
  enemies: TdEnemyDesc[];
  waves: TdWaveDesc[];
  economy: { startScrap: number; lives: number; waveBonus: number };
  hud: {
    panel: { draw: Drawn; box: Box };
    buttons: TdHudButton[];
    start: { draw: Drawn; at: Vec; box: Box };
    readout: { at: Vec; step: Vec };
    icons: { scrap: Drawn; life: Drawn };
  };
  /** ⚠️ **从 `waves.length` 派生**，不重复声明（与 `pickupCount` 同一条规矩）。 */
  objective: { kind: "survive-waves"; waveCount: number };
};

/**
 * 折线上走 `dist` 像素之后落在哪。
 *
 * ⚠️ 它住在这里（纯层）而不是外壳里 —— 「敌人现在在哪」是**几何**，
 *   而外壳不做几何（票 32）。它同时被渲染、索敌、命中判定三处用，
 *   所以更得只有一份实现。
 */
export function pathPointAt(path: { points: Vec[]; cum: number[]; total: number }, dist: number): Vec {
  const d = Math.max(0, Math.min(path.total, dist));
  // cum[i] = 从起点到第 i 个点的长度。找到 d 落在哪一段上。
  let i = 1;
  while (i < path.cum.length - 1 && path.cum[i]! < d) i++;
  const a = path.points[i - 1]!, b = path.points[i]!;
  const segLen = path.cum[i]! - path.cum[i - 1]!;
  const t = segLen === 0 ? 0 : (d - path.cum[i - 1]!) / segLen;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** 空的塔防描述 —— 「零数据也必须起得来」这一条的具体形状。 */
function emptyDescription(issues: Issue[], atlases: AtlasToLoad[]): TdWorldDescription {
  const box = (w: number, h: number): Box => ({ x: 0, y: 0, w, h });
  const miss = (label: string, reason: string): Drawn =>
    ({ missing: true, label, reason, x: 0, y: 0, w: VIEWPORT.w, h: VIEWPORT.h });
  return {
    shellVersion: SHELL_VERSION, viewport: { ...VIEWPORT }, worldSize: { ...VIEWPORT },
    atlases, issues, background: [],
    arena: { cell: 16, cols: 0, rows: 0, tiles: [] },
    path: { points: [], cum: [], total: 0 },
    core: { draw: miss("core", "没有可用数据"), at: { x: 0, y: 0 }, box: box(1, 1) },
    slots: [], slotActive: { draw: miss("slotActive", "没有可用数据"), size: FALLBACK_SIZE },
    towers: [], enemies: [], waves: [],
    economy: { startScrap: 0, lives: 0, waveBonus: 0 },
    hud: {
      panel: { draw: miss("hud.panel", "没有可用数据"), box: box(VIEWPORT.w, VIEWPORT.h) },
      buttons: [], start: { draw: miss("hud.start", "没有可用数据"), at: { x: 0, y: 0 }, box: box(1, 1) },
      readout: { at: { x: 0, y: 0 }, step: { x: 0, y: 0 } },
      icons: { scrap: miss("hud.icons.scrap", "没有可用数据"), life: miss("hud.icons.life", "没有可用数据") },
    },
    objective: { kind: "survive-waves", waveCount: 0 },
  };
}

/**
 * **本层的中心**：把「一个资源包 + 一份 td-config」读成「一张砖铺的场地 + 一堆盒子 + 一张时刻表」。
 * ⚠️ **它绝不抛。**
 */
export function buildTdWorld(
  manifest: unknown, config: unknown, opts: { packBase?: string } = {},
): TdWorldDescription {
  const issues: Issue[] = [];
  const base = opts.packBase ?? "";

  const mp = parseAssetPack(manifest ?? {});
  const pack: AssetPackManifest | null = mp.ok ? mp.value : null;
  if (!mp.ok) for (const e of mp.errors.slice(0, 4)) issues.push({ severity: "error", where: "manifest", message: e });

  const atlases = atlasList(pack, base);

  const cp = parseTdConfig(config ?? {});
  const cfg: TdConfig | null = cp.ok ? cp.value : null;
  if (!cp.ok) for (const e of cp.errors.slice(0, 6)) issues.push({ severity: "error", where: "td-config", message: e });

  if (!pack || !cfg) {
    issues.push({
      severity: "error", where: pack ? "td-config" : "manifest",
      message: pack ? `没有 td-config（或它不过 schema）—— 场地与机关全用占位符顶上` : `没有资源包 —— 一律画占位符`,
    });
    return emptyDescription(issues, pack ? atlases : []);
  }

  const W = cfg.world.size.w, H = cfg.world.size.h;
  const { cell } = cfg.arena;
  const cols = cfg.arena.rows[0]?.length ?? 0;
  const rows = cfg.arena.rows.length;

  // ── 场地：逐格解一次（**同一个字符只解一次** —— 576 次重复的报错没人看得完）──
  const tiles: TdTile[] = [];
  for (const ch of new Set(cfg.arena.rows.join(""))) {
    const r = cfg.arena.tiles[ch];
    if (!r) { issues.push({ severity: "error", where: `arena.tiles["${ch}"]`, message: `场地里有字符 "${ch}" 却没有对应的砖 —— 那些格子会是空的` }); continue; }
    const res = resolveDraw(pack, { x: 0, y: 0 }, r, issues, `arena.tiles["${ch}"]`, r.asset);
    if (res.missing) { issues.push({ severity: "error", where: `arena.tiles["${ch}"]`, message: `砖画不出来，那些格子会是空的` }); continue; }
    const size = assetSize(pack, r.asset) ?? FALLBACK_SIZE;
    const anchor = anchorOf(pack, r.asset);
    for (const [ri, row] of cfg.arena.rows.entries())
      for (const [ci, c] of [...row].entries()) {
        if (c !== ch) continue;
        // 格心 —— `floor(cell/2)` 而不是 `cell/2`：交付态坐标是**整数**，半像素会糊。
        const at = { x: ci * cell + Math.floor(cell / 2), y: ri * cell + Math.floor(cell / 2) };
        tiles.push({ draw: { ...res, at }, box: boxAt(at, size, anchor) });
      }
  }

  // ── 折线：弧长在**这里**算完 ────────────────────────────────────────────
  const points = cfg.path.points.map((p) => ({ x: p.x, y: p.y }));
  const cum = [0];
  for (let i = 1; i < points.length; i++)
    cum.push(cum[i - 1]! + Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y));
  const total = tdPathLength(points);

  // ── 柜台：位置 = 路径终点（**不重复声明**）───────────────────────────────
  const coreAt = points[points.length - 1] ?? { x: 0, y: 0 };
  const coreSize = assetSize(pack, cfg.core.asset) ?? FALLBACK_SIZE;
  const core = {
    draw: resolveDraw(pack, coreAt, { asset: cfg.core.asset }, issues, "core", cfg.core.asset),
    at: coreAt, box: boxAt(coreAt, coreSize, anchorOf(pack, cfg.core.asset)),
  };

  // ── 插槽 ────────────────────────────────────────────────────────────────
  const slotSize = assetSize(pack, cfg.scene.slot.asset) ?? FALLBACK_SIZE;
  const slotAnchor = anchorOf(pack, cfg.scene.slot.asset);
  const slots = cfg.slots.map((s) => ({
    id: s.id,
    draw: resolveDraw(pack, s.at, { asset: cfg.scene.slot.asset }, issues, `slot "${s.id}"`, cfg.scene.slot.asset),
    at: s.at, box: boxAt(s.at, slotSize, slotAnchor),
  }));
  const slotActive = {
    draw: resolveDraw(pack, { x: 0, y: 0 }, { asset: cfg.scene.slotActive.asset }, issues, "scene.slotActive", cfg.scene.slotActive.asset),
    size: assetSize(pack, cfg.scene.slotActive.asset) ?? FALLBACK_SIZE,
  };

  // ── 机关 ────────────────────────────────────────────────────────────────
  const towers: TdTowerDesc[] = cfg.towers.map((t) => ({
    id: t.id, name: t.name,
    draw: resolveDraw(pack, { x: 0, y: 0 }, { asset: t.asset, ...(t.anim ? { anim: t.anim } : {}) }, issues, `tower "${t.id}"`, t.asset),
    attack: t.attack, targeting: t.targeting, cost: t.cost, upgradeCost: t.upgradeCost,
    levels: t.levels.map((l) => ({ range: l.range, damage: l.damage, fireMs: l.fireMs, ...(l.slow ? { slow: l.slow } : {}) })),
    ...(t.fx ? {
      fx: (() => {
        const a = pack.assets.find((x) => x.id === t.fx!.asset);
        const anim = a?.animations?.find((x) => x.name === t.fx!.anim);
        return {
          draw: resolveDraw(pack, { x: 0, y: 0 }, { asset: t.fx!.asset, anim: t.fx!.anim }, issues, `tower "${t.id}".fx`, t.fx!.asset),
          frames: anim ? [...anim.frames] : [],
        };
      })(),
    } : {}),
    ...(t.projectile ? {
      projectile: {
        draw: resolveDraw(pack, { x: 0, y: 0 }, { asset: t.projectile.asset }, issues, `tower "${t.id}".projectile`, t.projectile.asset),
        speed: t.projectile.speed,
      },
    } : {}),
  }));

  // ── 敌人 ────────────────────────────────────────────────────────────────
  const enemies: TdEnemyDesc[] = cfg.enemies.map((e) => {
    const draw = resolveDraw(pack, { x: 0, y: 0 }, { asset: e.asset, anim: e.anim }, issues, `enemy "${e.id}"`, e.asset);
    const size = assetSize(pack, e.asset) ?? FALLBACK_SIZE;
    return {
      id: e.id, name: e.name, draw, frames: [], // frames 在下面按动画补齐
      hp: e.hp, speed: e.speed, bounty: e.bounty, armor: e.armor, leakCost: e.leakCost,
      box: boxAt({ x: 0, y: 0 }, size, anchorOf(pack, e.asset)),
    };
  });
  // 逐帧名单独补：`resolveDraw` 只给第一帧，走路动画要全部帧
  for (const e of cfg.enemies) {
    const a = pack.assets.find((x) => x.id === e.asset);
    const anim = a?.animations?.find((x) => x.name === e.anim);
    const target = enemies.find((x) => x.id === e.id);
    // ⚠️ manifest 上的 `Animation.frames` 已经是**帧名字符串**（不是 FrameRef）—— 直接用
    if (target && anim) target.frames = [...anim.frames];
  }

  // ── 波次：摊平成绝对毫秒 ────────────────────────────────────────────────
  const waves: TdWaveDesc[] = cfg.waves.map((w) => {
    const spawns: { enemy: string; atMs: number }[] = [];
    for (const g of w.groups)
      for (let i = 0; i < g.count; i++) spawns.push({ enemy: g.enemy, atMs: g.delayMs + i * g.gapMs });
    spawns.sort((a, b) => a.atMs - b.atMs);
    return { spawns, durationMs: spawns.length === 0 ? 0 : spawns[spawns.length - 1]!.atMs };
  });

  // ── HUD 按钮：**条数 = 机关种类数**（派生，不重复声明）────────────────────
  // ⚠️ **HUD 的盒子从 `tdHudScreenItems` 取，不在这里再算一遍**（票 03）——
  //   那几个盒子正是**屏幕空间那条检查看过的同一个盒子**。各算一份就是「校验过的」与
  //   「外壳要画的」两份描述，而那正是这个仓库反复吃过的亏（票 48）。
  const hudItems = tdHudScreenItems(cfg, pack, { lineHeight: HUD_LINE_HEIGHT });
  /** ⚠️ 构造上必然有：`tdHudScreenItems` 给这些项都填了 `box`（**只有 `hud.readout` 是纯文字**）。 */
  const hudBox = (where: string) => hudItems.find((i) => i.where === where)!.box!;

  const buttonSize = cfg.hud.buttons.size;
  const buttons: TdHudButton[] = cfg.towers.map((t, i) => {
    const at = { x: cfg.hud.buttons.at.x + i * cfg.hud.buttons.step.x, y: cfg.hud.buttons.at.y + i * cfg.hud.buttons.step.y };
    return {
      draw: resolveDraw(pack, at, { asset: cfg.hud.buttons.asset }, issues, `hud.buttons[${i}]`, cfg.hud.buttons.asset, buttonSize),
      at, box: hudBox(`hud.buttons["${t.id}"]`), towerId: t.id,
    };
  });

  const panelSize = cfg.hud.panel.size;
  const startSize = cfg.hud.start.size;
  const startAt = { x: cfg.hud.start.at.x, y: cfg.hud.start.at.y };
  const hud = {
    panel: {
      draw: resolveDraw(pack, cfg.hud.panel.at, { asset: cfg.hud.panel.asset }, issues, "hud.panel", cfg.hud.panel.asset, panelSize),
      box: hudBox("hud.panel"),
    },
    buttons,
    start: {
      draw: resolveDraw(pack, startAt, { asset: cfg.hud.start.asset }, issues, "hud.start", cfg.hud.start.asset, startSize),
      at: startAt, box: hudBox("hud.start"),
    },
    readout: { at: { ...cfg.hud.readout.at }, step: { ...cfg.hud.readout.step } },
    icons: {
      scrap: resolveDraw(pack, cfg.hud.icons.scrap.at, { asset: cfg.hud.icons.scrap.asset }, issues, "hud.icons.scrap", cfg.hud.icons.scrap.asset),
      life: resolveDraw(pack, cfg.hud.icons.life.at, { asset: cfg.hud.icons.life.asset }, issues, "hud.icons.life", cfg.hud.icons.life.asset),
    },
  };

  return {
    shellVersion: SHELL_VERSION, viewport: { ...VIEWPORT }, worldSize: { w: W, h: H }, atlases, issues,
    background: [],
    arena: { cell, cols, rows, tiles },
    path: { points, cum, total },
    core, slots, slotActive, towers, enemies, waves,
    economy: { startScrap: cfg.economy.startScrap, lives: cfg.economy.lives, waveBonus: cfg.economy.waveBonus },
    hud,
    objective: { kind: "survive-waves", waveCount: cfg.waves.length },
  };
}
