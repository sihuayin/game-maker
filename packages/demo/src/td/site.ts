// **塔防的站点装配器** —— 与横版那份是**兄弟**，共用 `layout.ts` 的落盘逻辑。
//
// ⚠️ 分工与横版一字不差：**校验 → 摆目录 → 写数据 → 报账**，这里不写一行游戏逻辑。
//   第四/六族跑在 `buildTdWorld` 的**产物**上，不是另算一遍 —— 于是「校验过的」与
//   「外壳要画的」是同一份描述，不可能漂移（票 33 那条不变量）。
import fs from "node:fs";
import path from "node:path";
import {
  CommandError, auditScreenSpace, auditTdConfig, auditTdWorldSize, parseAssetPack, parseTdConfig, tdHudScreenItems, tdResolveConfig, TD_CONFIG_FORMAT,
  type AssetPackManifest, type CommandResult, type ConfigIssue, type TdConfig,
} from "@game-maker/contracts";
import { buildTdWorld, type TdWorldDescription } from "./world.js";
import { auditWinnable, playReference } from "./winnable.js";
import { failWith, laySite } from "../layout.js";
import { HUD_LINE_HEIGHT, VIEWPORT } from "../draw.js";
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
  // ⚠️ **视口那一半不在这条函数里**（票 83）：`world.viewport` 曾在这里声明过、而**从没被用过**
  //   （死代码 —— `grep -n '\bV\b'` 只有那一行）。「世界必须与视口一样大」那条判据今天住在
  //   **契约层**的 `auditTdWorldSize`：它**吃视口参数**，所以**编译期也判得上**
  //   （几何族只有装配期看得见 —— 见下面 `all` 那一行的分工）。
  const W = world.worldSize;

  // ── 场地：铺满了吗 ──────────────────────────────────────────────────────
  const { cell, cols, rows, tiles } = world.arena;
  if (cell * cols !== W.w || cell * rows !== W.h)
    err("arena", `场地铺不满世界：${cols}×${rows} 格 × ${cell}px = ${cell * cols}×${cell * rows}，而世界是 ${W.w}×${W.h}` +
      ` —— 铺不满的地方会透出外壳的底色`);
  if (tiles.length !== cols * rows)
    err("arena", `场地有 ${cols * rows} 格，却只画得出 ${tiles.length} 块砖 —— 少掉的格子会透出外壳底色`);

  // ⚠️ **近端（负数）警告、远端硬失败** —— 与横版的 `pokeOut` 同一个形状、同一条理由
  //   （「精确的硬失败、有解释余地的报警告」，票 27）。⚠️ 而这条**近端警告**在塔防**永远轮不到**：
  //   能让它响的盒子（`slot` / `core`）在 config 那一层已被同一条四边判据**硬失败**判过
  //   （`td-config.ts` 的 `inWorld`），而两者在**同一个列表**里（下面 `all` 那一行），
  //   有 error 就当场失败。⇒ 它是**哨兵**，不是判决 —— 留着是因为塔防那条四边语义将来若改成
  //   「近端警告」（Q3 的回退方案 (甲)），它就是现成的那一半。
  const inWorld = (where: string, b: Box) => {
    if (b.x + b.w > W.w || b.y + b.h > W.h)
      err(where, `落在世界之外（世界 ${W.w}×${W.h}；这个盒子是 (${b.x},${b.y}) ${b.w}×${b.h}）`);
    else if (b.x < 0 || b.y < 0)
      warn(where, `盒子探出了世界的左边/上边（(${b.x},${b.y})）—— 会被裁掉一角。若这是有意的，忽略本条`);
  };
  // ⚠️ **砖这一行的检查今天两个分支都恒真**（票 81 量的；探针：禁用整行 ⇒ 全仓 1426 条测试全绿）。
  //   三条既有判据把它夹死了：砖按「格心 + 锚点」摆（`td/world.ts:156-171`），而砖的尺寸**必须**
  //   等于 `arena.cell`（`td-config.ts:412`）、锚点**必须**是 `{0.5,0.5}`（`:416`）、
  //   且 `cols·cell == W`、`rows·cell == H`（`:470`）⇒ 每块砖的盒子**恒等于**一个格
  //   `(ci·cell, ri·cell, cell, cell)` ⊂ 世界。
  //   ⚠️ **检查留着** —— 票 81 的 Q5(a) 逐字「不删除检查哨兵」：上面那三条前提**将来会被放松**
  //     （格子尺寸 / 锚点 / 铺满世界，而锚点那条正归**票 82**），松掉之后这行就是**唯一**会说话的地方。
  //   ⚠️ 而原先那个「允许探出」的豁免**参数**已按 Q5(a) 删掉：那是全仓独一份的机制
  //     （「写的人预先声明」；另两处都是「读的人自己判」），而它豁免的检查恒真
  //     ⇒ 留着一个**不执行的豁免**等于留一个没人会发现的洞。删参数**不改任何判决**（恒真就是恒真）。
  for (const [i, t] of tiles.entries()) inWorld(`arena.tiles[${i}]`, t.box);

  // ── 走道与插槽 ──────────────────────────────────────────────────────────
  for (const [i, p] of world.path.points.entries())
    if (p.x > W.w || p.y > W.h) err(`path.points[${i}]`, `落在世界之外（世界 ${W.w}×${W.h}）`);
  if (world.path.total <= 0) err("path", `折线总长是 ${world.path.total} —— 敌人一出生就到柜台了`);
  for (const s of world.slots) inWorld(`slot "${s.id}"`, s.box);
  inWorld("core", world.core.box);

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
  // ⚠️ **装配前也补全**（票 12）：`path` 缺席就从场地派生 —— 与 `compileTdGame` 走同一处
  //   （`tdResolveConfig`）。两边各写一遍的后果是「产物里到底有没有路径」成了谜。
  const resolved = tdResolveConfig(cp.value);
  if (!resolved.ok) throw new CommandError("invalid", `从场地派生不出路径：${resolved.error}`);
  const config: TdConfig = resolved.value;
  const gameId = opts.gameId ?? manifest.id;
  const packVersion = `v${manifest.version}`;
  const outRoot = path.resolve(opts.outRoot);
  const gameDir = path.join(outRoot, gameId);

  // ── 校验：三族 + **世界尺寸**（都在契约层）+ 第四族（几何）+ 第五族（屏幕空间）+ 第六族（可通关）──
  // ⚠️ 场景描述**只构建一次**：几何族校验的那份，就是下面写进 warning 汇总、以及
  //   外壳将要画的那一份。构建两次 = 给了它们漂移的机会，而漂移是静默的。
  const world = buildTdWorld(manifest, config, { packBase: `../../pack/${packVersion}/` });
  // ⚠️ **第五族与几何族分开、且与横版共用一份**（票 03）——
  //   塔防的 `hud` 有**五个**成员，而原先的几何族只覆盖了三个（票 03 量到的那个洞）。
  const screenIssues = auditScreenSpace(VIEWPORT, tdHudScreenItems(config, manifest, { lineHeight: HUD_LINE_HEIGHT }));
  // ⚠️ **「这一关通不通」也判在这里**（票 11）：那一步需要**模拟器**，而它住在 demo ——
  //   与**几何族**是同一个处境（同样够不着 `contracts`），所以落在同一处。
  //   `compileGame` 自己的注释写着这条分工：「这里跑的是 `site` 要跑的同一批校验（**减去第四族**）」。
  const winnable = auditWinnable(playReference(world), world);
  // ⚠️ **世界尺寸那条判据与三族同住契约层**（票 83 · 票 81 的 Q3(乙) 的前提判据）：
  //   塔防对负盒子判**硬失败**，而那条判决的全部理由是「**世界就是这一屏**」——
  //   世界比视口大，那个理由就不成立了，而判决还硬着。⇒ 先把它钉住。
  //   ⚠️ **它与屏幕空间族同形**：视口**由调用方传**（契约里没有视口常量，`check:deps` 不让引），
  //   所以编译期也调了一次（`assets/src/ops.ts` 的 `auditOf`）。这里**再调一次不是重复**：
  //   `site` 可以对着盘上**手写**的一份配置直接跑，根本不经过编译那一遍。
  const all = [
    ...auditTdConfig(config, manifest),
    ...auditTdWorldSize(VIEWPORT, config),
    ...screenIssues,
    ...auditTdGeometry(world),
    ...winnable,
  ];
  const errors = all.filter((i) => i.severity === "error");
  if (errors.length > 0) failWith("装配期校验不过 —— 硬失败，不产出站点", errors);

  // ── 摆目录（**与横版共用同一份**）───────────────────────────────────────
  const laid = laySite({
    packDir: opts.packDir, outRoot, gameId, packVersion,
    // ⚠️ 传**补全过的 `config`**（不是 `opts.configPath`）—— 磁盘上那份可能没有 `path`，
    //   而外壳按 `path.points` 走。见 `layout.ts` 的 `config` 那一行。
    shellJsPath: opts.shellJsPath, config, configFileName: "td-config.json",
  });

  const warnings = all.filter((i) => i.severity === "warning");
  return {
    command: "site",
    summary: [
      `站点：${rel(outRoot, laid.siteDir)}（${laid.packCopied ? "拷入" : "复用已存在的"}包 ${rel(outRoot, laid.packDest)}）`,
      `玩法：塔防（${TD_CONFIG_FORMAT}）· ${config.waves.length} 波 · ${config.towers.length} 种机关 · ` +
        `${config.enemies.length} 种敌人 · ${config.slots.length} 个插槽`,
      `消费：外壳 v${world.shellVersion} · 资源包 ${packVersion}（${manifest.assets.length} 个资源）`,
      `校验：三族（契约层）+ 第四族（几何）+ 第五族（HUD 屏幕空间）+ 第六族（**可通关**：参考玩家跑一遍）全过${warnings.length ? `；${warnings.length} 条警告` : ""}`,
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
