// **塔防的站点装配器** —— 与横版那份是**兄弟**，共用 `layout.ts` 的落盘逻辑。
//
// ⚠️ 分工与横版一字不差：**校验 → 摆目录 → 写数据 → 报账**，这里不写一行游戏逻辑。
//   几何族跑在 `buildTdWorld` 的**产物**上，不是另算一遍 —— 于是「校验过的」与
//   「外壳要画的」是同一份描述，不可能漂移（票 33 那条不变量）。
import fs from "node:fs";
import path from "node:path";
import {
  CommandError, auditTdConfig, parseAssetPack, parseTdConfig, TD_CONFIG_FORMAT,
  type AssetPackManifest, type CommandResult, type ConfigIssue, type TdConfig,
} from "@game-maker/contracts";
import { buildTdWorld, type TdWorldDescription } from "./world.js";
import { failWith, laySite } from "../layout.js";
import type { Box } from "../draw.js";

/**
 * **几何族** —— 只能落在装配期的那几条（它要同时知道世界多大与视口多大）。
 *
 * ⚠️ 与横版的 `auditGeometry` 同一条判据纪律：**精确的硬失败、有解释余地的报警告**。
 *   这里没有「背景盖不盖得住」那条 —— 塔防的场地是**砖铺的**，一砖一格铺满整个世界，
 *   没有「透过去」这回事（那张大背景图在 2026-09-29 的实测里被否掉了，见 `world.ts` 的场地注释）。
 */
export function auditTdGeometry(world: TdWorldDescription): ConfigIssue[] {
  const out: ConfigIssue[] = [];
  const err = (where: string, message: string) => out.push({ severity: "error", where, message });
  const warn = (where: string, message: string) => out.push({ severity: "warning", where, message });
  const V = world.viewport;
  const W = world.worldSize;

  // ── 场地：铺满了吗 ──────────────────────────────────────────────────────
  const { cell, cols, rows, tiles } = world.arena;
  if (cell * cols !== W.w || cell * rows !== W.h)
    err("arena", `场地铺不满世界：${cols}×${rows} 格 × ${cell}px = ${cell * cols}×${cell * rows}，而世界是 ${W.w}×${W.h}` +
      ` —— 铺不满的地方会透出外壳的底色`);
  if (tiles.length !== cols * rows)
    err("arena", `场地有 ${cols * rows} 格，却只画得出 ${tiles.length} 块砖 —— 少掉的格子会透出外壳底色`);

  const inWorld = (where: string, b: Box, allowPokeOut = false) => {
    if (b.x + b.w > W.w || b.y + b.h > W.h)
      err(where, `落在世界之外（世界 ${W.w}×${W.h}；这个盒子是 (${b.x},${b.y}) ${b.w}×${b.h}）`);
    else if (!allowPokeOut && (b.x < 0 || b.y < 0))
      warn(where, `盒子探出了世界的左边/上边（(${b.x},${b.y})）—— 会被裁掉一角。若这是有意的，忽略本条`);
  };
  for (const [i, t] of tiles.entries()) inWorld(`arena.tiles[${i}]`, t.box, true);

  // ── 走道与插槽 ──────────────────────────────────────────────────────────
  for (const [i, p] of world.path.points.entries())
    if (p.x > W.w || p.y > W.h) err(`path.points[${i}]`, `落在世界之外（世界 ${W.w}×${W.h}）`);
  if (world.path.total <= 0) err("path", `折线总长是 ${world.path.total} —— 敌人一出生就到柜台了`);
  for (const s of world.slots) inWorld(`slot "${s.id}"`, s.box);
  inWorld("core", world.core.box);

  // ── HUD：**屏幕空间**的，尺子是视口不是世界 ──────────────────────────────
  // ⚠️ 与横版同一条：摆到看不见的地方**几乎不可能是设计**（它没有「另一条路」这回事），
  //   而它是精确可算的 —— 所以是**硬失败**。
  const fitViewport = (where: string, b: Box) => {
    if (b.x < 0 || b.y < 0 || b.x + b.w > V.w || b.y + b.h > V.h)
      err(where, `HUD 活在**屏幕空间**，必须整个落在视口 ${V.w}×${V.h} 内；` +
        `而它的盒子是 (${b.x},${b.y}) ${b.w}×${b.h}。⚠️ 尺子是**视口**不是 world.size`);
  };
  fitViewport("hud.panel", world.hud.panel.box);
  fitViewport("hud.start", world.hud.start.box);
  for (const b of world.hud.buttons) fitViewport(`hud.buttons["${b.towerId}"]`, b.box);

  return out;
}

export type TdSiteOptions = {
  packDir: string;
  configPath: string;
  /** 外壳 bundle。⚠️ **与横版是同一份字节**（`CONTEXT.md`：所有站点共用同一份）。 */
  shellJsPath: string;
  outRoot: string;
  gameId?: string;
};

const rel = (root: string, p: string) => path.relative(root, p).split(path.sep).join("/");

/**
 * 装配一个塔防站点。**成功返回 `CommandResult`，失败抛 `CommandError`**。
 * ⚠️ 与横版同款：**校验不过 = 失败，不是降级**。
 */
export function assembleTdSite(opts: TdSiteOptions): CommandResult {
  if (!fs.existsSync(opts.packDir)) throw new CommandError("usage", `不是资源包目录（不存在）：${opts.packDir}`);
  const manifestPath = path.join(opts.packDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) throw new CommandError("usage", `不是资源包（没有 manifest.json）：${opts.packDir}`);
  if (!fs.existsSync(opts.configPath)) throw new CommandError("usage", `找不到 td-config：${opts.configPath}`);
  if (!fs.existsSync(opts.shellJsPath))
    throw new CommandError("usage", `找不到外壳 bundle：${opts.shellJsPath} —— 先跑 pnpm --filter @game-maker/demo bundle`);

  let rawManifest: unknown, rawConfig: unknown;
  try {
    rawManifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    rawConfig = JSON.parse(fs.readFileSync(opts.configPath, "utf8"));
  } catch (e) {
    throw new CommandError("invalid", `配置或清单不是合法 JSON：${e instanceof Error ? e.message : String(e)}`);
  }

  const mp = parseAssetPack(rawManifest);
  if (!mp.ok) throw new CommandError("invalid", `资源包不过 schema：\n${mp.errors.slice(0, 6).map((e) => "  · " + e).join("\n")}`);
  const cp = parseTdConfig(rawConfig);
  if (!cp.ok) throw new CommandError("invalid", `td-config 不过 schema：\n${cp.errors.slice(0, 6).map((e) => "  · " + e).join("\n")}`);

  const manifest: AssetPackManifest = mp.value;
  const config: TdConfig = cp.value;
  const gameId = opts.gameId ?? manifest.id;
  const packVersion = `v${manifest.version}`;
  const outRoot = path.resolve(opts.outRoot);
  const gameDir = path.join(outRoot, gameId);

  // ── 校验：三族（契约层）+ 几何族 ────────────────────────────────────────
  // ⚠️ 场景描述**只构建一次**：几何族校验的那份，就是下面写进 warning 汇总、以及
  //   外壳将要画的那一份。构建两次 = 给了它们漂移的机会，而漂移是静默的。
  const world = buildTdWorld(manifest, config, { packBase: `../../pack/${packVersion}/` });
  const all = [...auditTdConfig(config, manifest), ...auditTdGeometry(world)];
  const errors = all.filter((i) => i.severity === "error");
  if (errors.length > 0) failWith("装配期校验不过 —— 硬失败，不产出站点", errors);

  // ── 摆目录（**与横版共用同一份**）───────────────────────────────────────
  const laid = laySite({
    packDir: opts.packDir, outRoot, gameId, packVersion,
    shellJsPath: opts.shellJsPath, configPath: opts.configPath, configFileName: "td-config.json",
  });

  const warnings = all.filter((i) => i.severity === "warning");
  return {
    command: "site",
    summary: [
      `站点：${rel(outRoot, laid.siteDir)}（${laid.packCopied ? "拷入" : "复用已存在的"}包 ${rel(outRoot, laid.packDest)}）`,
      `玩法：塔防（${TD_CONFIG_FORMAT}）· ${config.waves.length} 波 · ${config.towers.length} 种机关 · ` +
        `${config.enemies.length} 种敌人 · ${config.slots.length} 个插槽`,
      `消费：外壳 v${world.shellVersion} · 资源包 ${packVersion}（${manifest.assets.length} 个资源）`,
      `校验：三族 + 几何族全过${warnings.length ? `；${warnings.length} 条警告` : ""}`,
      ...warnings.map((i) => `  ⚠️ ${i.where}: ${i.message}`),
      `⚠️ 起服务时 **HTTP server 的根必须是 ${rel(outRoot, gameDir)}/** —— ` +
        `打开 /site/v${laid.siteVersion}/index.html（根指到 site 里面会 404，而 Phaser 静默失败）`,
    ],
    data: {
      gameId, genre: "tower-defense", siteVersion: laid.siteVersion, packVersion,
      packCopied: laid.packCopied, siteDir: rel(outRoot, laid.siteDir), packDir: rel(outRoot, laid.packDest),
      warnings: warnings.map((i) => `${i.where}: ${i.message}`),
      serveRoot: rel(outRoot, gameDir),
      entry: `${rel(outRoot, laid.siteDir)}/index.html`,
    },
    artifacts: [{ path: rel(outRoot, laid.siteDir), kind: "demo-site" }],
  };
}
