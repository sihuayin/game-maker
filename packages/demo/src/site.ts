// **站点装配器**（票 33）—— 构建期的那一半。
//
//   (资源包目录, game-config, out 根) → out/<gameId>/site/v<N>/
//
// ⚠️ **运行时归票 44，构建期归这里**（票 32 划的那条缝）。这里不写一行游戏逻辑，
//   它只做四件事：**校验 → 摆目录 → 写数据 → 报账**。
//
// ⚠️ 站点形态（票 32 §2）：**三份数据 + 一份共用 bundle**
//     index.html / shell.js / site.json / game-config.json
//   `shell.js` 是仓库的构建产物，**所有站点共用同一份字节**（R8 的「外壳永不改变」是字面意义）。
//
// ⚠️ **HTTP server 的根必须是 `pack/` 与 `site/` 的父目录**（票 03 实测）——
//   写死路径的下场是 404，而 **Phaser 的 loader 静默失败**。
import fs from "node:fs";
import path from "node:path";
import {
  CommandError, auditGameConfig, parseAssetPack, parseCoverage, parseGameConfig,
  FILLED,
  type AssetPackManifest, type CommandResult, type ConfigIssue, type GameConfig, type LayerCoverage,
} from "@game-maker/contracts";
import { BACKDROP, SHELL_VERSION, VIEWPORT, buildWorld, type Box, type WorldDescription } from "./world.js";

// ── 第四族 · 几何可行性 ─────────────────────────────────────────────────────
//
// ⚠️ **这一族只能落在装配期** —— 它要同时知道**世界多宽**（只有 game-config 知道）
//   与**视口多大**（只有外壳知道，票 32 裁决 1 的常量）。
//
// ⚠️ 它跑在 `buildWorld` 的产物上，**不是**另算一遍 —— 于是「校验过的」与
//   「外壳要画的」是同一份描述，不可能漂移。

/** 镜头走到尽头时，这一层在屏幕上还剩多长（**算出来的，不是拍的**）。 */
function coveredExtent(drawn: number, parallax: number, travel: number): number {
  // 镜头走 `travel` 像素时，跟着走 `parallax` 的层在屏幕上退掉 `parallax × travel`。
  // 最坏情况（镜头在尽头）剩下这么多，它必须还够铺满一屏。
  return drawn - parallax * travel;
}

export function auditGeometry(world: WorldDescription, coverage?: readonly LayerCoverage[]): ConfigIssue[] {
  const out: ConfigIssue[] = [];
  const err = (where: string, message: string) => out.push({ severity: "error", where, message });
  const warn = (where: string, message: string) => out.push({ severity: "warning", where, message });
  const V = world.viewport;
  const W = world.worldSize;
  const travelX = Math.max(0, W.w - V.w);
  const travelY = Math.max(0, W.h - V.h);

  // ── 背景层：盖得住世界吗 ────────────────────────────────────────────────
  world.background.forEach((l, i) => {
    const where = `scene.background[${i}]`;
    const name = l.draw.missing ? "(解不到的层)" : l.draw.frame;
    const coverX = coveredExtent(l.box.w, l.parallax, travelX);
    const coverY = coveredExtent(l.box.h, l.parallax, travelY);
    if (coverX < V.w || coverY < V.h)
      err(where, `层 "${name}" 盖不住世界：画出来 ${l.box.w}×${l.box.h}px，视差 ${l.parallax} 会跟着镜头退掉 ` +
        `${Math.round(l.parallax * travelX)}×${Math.round(l.parallax * travelY)}px，最坏时屏幕上只剩 ` +
        `${Math.round(coverX)}×${Math.round(coverY)}px，而视口要 ${V.w}×${V.h}px。` +
        `—— **不平铺的层只有 parallax = 0 才恒成立**（票 40 算过的那条）`);
  });

  // ── 最远的那一层必须画满（票 50）────────────────────────────────────────
  //
  // ⚠️ **只查最远那层**。`layers` 是从远到近排的 ⇒ `layers[0]` 后面**什么都没有**，
  //   它的透明透过去就是外壳的底色。而**其余层的留白是设计** ——
  //   实测 drawlist 真包的 `wall` 只有 42%、`ground` 只有 14%，那**正是它该有的样子**。
  //   ⇒「所有层都必须满」会当场拒掉那个包 —— 那是**错的**判据（票 50 量出来的）。
  //
  // ⚠️ **覆盖率的算法不在这里**（`@game-maker/demo` 没有 PNG 解码器）——
  //   它由 `pack` 算好写进包根的 `coverage.json`，这里**只判**。
  if (coverage && world.background.length > 0) {
    const far = world.background[0]!;
    const name = far.draw.missing ? null : far.draw.frame;
    const c = name === null ? undefined : coverage.find((x) => x.frame === name);
    if (c && c.ratio < FILLED)
      err("scene.background[0]", `**最远的那一层没画满**："${c.frame}" 只有 ${(100 * c.ratio).toFixed(1)}% 的像素画了东西，` +
        `而它后面没有别的层 —— 透过去就是外壳的底色（${BACKDROP}）。` +
        `⚠️ 其余层的留白是设计；**只有最远这层必须满**（票 50）`);
  }

  // ── HUD：**屏幕空间**的，尺子是视口不是世界 ──────────────────────────────
  //
  // ⚠️ 世界宽 1440、视口宽 480 —— 一个摆在 x:1000 的 HUD **过得了世界校验、却在屏幕外**。
  //   硬失败：HUD 摆到看不见的地方**几乎不可能是设计**（它没有「另一条路」这回事，
  //   与「越不过这块台阶可能是设计」正相反），而它又是**精确可算**的。
  //   —— 这一条与本票其它几何检查的「上界报警告」纪律不同，是**有意**的。
  const fitViewport = (where: string, b: Box) => {
    if (b.x < 0 || b.y < 0 || b.x + b.w > V.w || b.y + b.h > V.h)
      err(where, `HUD 活在**屏幕空间**，必须整个落在视口 ${V.w}×${V.h} 内；` +
        `而它的盒子是 (${b.x},${b.y}) ${b.w}×${b.h}。⚠️ 尺子是**视口**不是 world.size —— ` +
        `世界宽 ${W.w} 而屏幕只有 ${V.w}，对世界校验会放它过去`);
  };
  fitViewport("hud.panel", world.hud.panel.box);
  world.hud.pips.forEach((p, i) => fitViewport(`hud.pip[${i}]`, p.box));

  // ── 近端边：盒子的左边 / 上边探出世界（**警告**，不是硬失败）──────────────
  //
  // ⚠️ 票 48 有意把这条留给本票判（自洽族只查**远端边**）。判成**警告**的理由：
  //   远端越界意味着「这东西压根不在世界里」，而近端探出只是**被裁掉一角** ——
  //   一堵从画面外伸进来的墙、一个半截的装饰，都可能是**有意**的。
  //   与票 27 立的规矩一致：**精确的硬失败、有解释余地的报警告**。
  const pokeOut = (where: string, b: Box) => {
    if (b.x < 0 || b.y < 0)
      warn(where, `盒子探出了世界的左边/上边（(${b.x},${b.y}) ${b.w}×${b.h}）—— 会被裁掉一角。` +
        `若这是有意的（从画面外伸进来的东西）忽略本条；**远端**越界才是硬失败，那条在自洽族`);
  };
  world.terrain.forEach((b, i) => pokeOut(`terrain[${i}]`, b));
  for (const e of world.entities) pokeOut(`entity "${e.id}"`, e.box);
  pokeOut("player.at", world.player.box);

  return out;
}

/** 把一族 issue 拼成一条能读的 error —— 硬失败**一次报全**，别让人跑五遍。 */
const failWith = (title: string, issues: ConfigIssue[]): never => {
  const lines = issues.map((i) => `  · ${i.where}: ${i.message}`);
  throw new CommandError("invalid", `${title}（${issues.length} 条）：\n${lines.join("\n")}`);
};

export type SiteOptions = {
  /** 资源包目录（**已解开的目录** —— 票 18 Q1：交付形态只出目录，zip 是导出动作不是生成动作）。 */
  packDir: string;
  configPath: string;
  /** 外壳 bundle（`packages/demo/dist/shell.js`）。**所有站点共用同一份字节**。 */
  shellJsPath: string;
  outRoot: string;
  /** 站点目录名。缺省用包自己的 id。 */
  gameId?: string;
};

const jstr = (o: unknown) => JSON.stringify(o, null, 2) + "\n";
const rel = (root: string, p: string) => path.relative(root, p).split(path.sep).join("/");

/** 下一个站点版本号 —— **绝不覆盖**（票 18 与票 24 同一条规矩）。 */
function nextSiteVersion(siteDir: string): number {
  if (!fs.existsSync(siteDir)) return 1;
  const ns = fs.readdirSync(siteDir)
    .map((d) => /^v(\d+)$/.exec(d))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => Number(m[1]));
  return ns.length === 0 ? 1 : Math.max(...ns) + 1;
}

/**
 * 装配一个站点。**成功返回 `CommandResult`，失败抛 `CommandError`**（票 30 的形状）。
 *
 * ⚠️ **校验不过 = 失败，不是降级**（票 30 抓到过「校验不过时退出码是 0」，
 *   于是篡改过的包骗过了校验脚本 —— 同一个坑不踩第二次）。
 */
export function assembleSite(opts: SiteOptions): CommandResult {
  // ── 输入 ────────────────────────────────────────────────────────────────
  if (!fs.existsSync(opts.packDir)) throw new CommandError("usage", `不是资源包目录（不存在）：${opts.packDir}`);
  const manifestPath = path.join(opts.packDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) throw new CommandError("usage", `不是资源包（没有 manifest.json）：${opts.packDir}`);
  if (!fs.existsSync(opts.configPath)) throw new CommandError("usage", `找不到 game-config：${opts.configPath}`);
  if (!fs.existsSync(opts.shellJsPath))
    throw new CommandError("usage", `找不到外壳 bundle：${opts.shellJsPath} —— 先跑 pnpm --filter @game-maker/demo bundle`);

  const mp = parseAssetPack(JSON.parse(fs.readFileSync(manifestPath, "utf8")));
  if (!mp.ok) throw new CommandError("invalid", `资源包不过 schema：\n${mp.errors.slice(0, 6).map((e) => "  · " + e).join("\n")}`);
  const cp = parseGameConfig(JSON.parse(fs.readFileSync(opts.configPath, "utf8")));
  if (!cp.ok) throw new CommandError("invalid", `game-config 不过 schema：\n${cp.errors.slice(0, 6).map((e) => "  · " + e).join("\n")}`);

  const manifest: AssetPackManifest = mp.value;
  const config: GameConfig = cp.value;
  const gameId = opts.gameId ?? manifest.id;
  const packVersion = `v${manifest.version}`;
  const outRoot = path.resolve(opts.outRoot);
  const gameDir = path.join(outRoot, gameId);

  // ── 校验：三族（契约层）+ 第四族（几何）+ 第五族（HUD 屏幕空间）──────────
  //
  // ⚠️ 三族就在**这里**跑 —— 票 32 划的缝：「原问 4 引用校验」是**构建期**的事。
  const audit = auditGameConfig(config, manifest);

  // ⚠️ **覆盖率由 `pack` 算好写进包里**（票 50）—— 这里**没有 PNG 解码器**，只能读。
  //   没有它**不算错**：票 50 之前产的包都不带它（与 ledger.json 同一条规矩）。
  const coveragePath = path.join(opts.packDir, "coverage.json");
  let coverageLayers: LayerCoverage[] | undefined;
  if (fs.existsSync(coveragePath)) {
    const c = parseCoverage(JSON.parse(fs.readFileSync(coveragePath, "utf8")));
    if (!c.ok) throw new CommandError("invalid", `coverage.json 不过 schema：${c.errors.slice(0, 4).join("；")}`);
    if (c.value.packId !== manifest.id || c.value.packVersion !== manifest.version)
      throw new CommandError("invalid", `覆盖率与包对不上：coverage.json 说自己是 "${c.value.packId}" v${c.value.packVersion}，而 manifest 是 "${manifest.id}" v${manifest.version}`);
    coverageLayers = c.value.layers;
  }

  const geometryIssues = auditGeometry(buildWorld(manifest, config, {
    packBase: `../../pack/${packVersion}/`,
  }), coverageLayers);
  const all = [...audit, ...geometryIssues];
  const errors = all.filter((i) => i.severity === "error");
  if (errors.length > 0) failWith("装配期校验不过 —— 硬失败，不产出站点", errors);

  // ── 摆目录 ──────────────────────────────────────────────────────────────
  // 包：**拷进 out 树**（站点因此自带它消费的那个包，整体搬走就能跑）。
  // ⚠️ 同一个版本**已存在就不动** —— 「绝不覆盖」，而且换包时不会把上一次的产物踩掉。
  const packDest = path.join(gameDir, "pack", packVersion);
  const packCopied = !fs.existsSync(packDest);
  if (packCopied) {
    fs.mkdirSync(path.dirname(packDest), { recursive: true });
    fs.cpSync(opts.packDir, packDest, { recursive: true });
  }

  const siteRoot = path.join(gameDir, "site");
  fs.mkdirSync(siteRoot, { recursive: true });
  const n = nextSiteVersion(siteRoot);
  const siteDir = path.join(siteRoot, `v${n}`);

  fs.mkdirSync(siteDir, { recursive: true });
  fs.copyFileSync(opts.shellJsPath, path.join(siteDir, "shell.js"));
  fs.copyFileSync(opts.configPath, path.join(siteDir, "game-config.json"));

  // ⚠️ **经典 script**（不是 module）：票 03 实测 module script 撞 CORS —— 少一个失败模式
  fs.writeFileSync(path.join(siteDir, "index.html"), `<!doctype html>
<html lang="zh"><head><meta charset="utf-8"><title>${gameId}</title>
<style>html,body{margin:0;height:100%;background:#101014;display:grid;place-items:center}</style>
</head><body><div id="game"></div>
<script src="./shell.js"></script>
</body></html>
`);

  // 站点**自己说明自己是怎么来的**（票 18 / 票 32 裁决 6）：外壳版本 + 消费的包版本。
  // ⚠️ 这两样是 R6 说的 A/B 之间**唯一**的依赖 —— 有了它，「换包不重建」才成立。
  fs.writeFileSync(path.join(siteDir, "site.json"), jstr({ shell: SHELL_VERSION, pack: packVersion }));

  // ── 报账 ────────────────────────────────────────────────────────────────
  const warnings = all.filter((i) => i.severity === "warning");
  return {
    command: "site",
    summary: [
      `站点：${rel(outRoot, siteDir)}（${packCopied ? "拷入" : "复用已存在的"}包 ${rel(outRoot, packDest)}）`,
      `消费：外壳 v${SHELL_VERSION} · 资源包 ${packVersion}（${manifest.assets.length} 个资源）`,
      `校验：三族 + 第四族（几何）+ 第五族（HUD 屏幕空间）全过${warnings.length ? `；${warnings.length} 条警告` : ""}` +
        (coverageLayers ? "" : " ⚠️（这个包没有 coverage.json，「最远层画满」那条没查 —— 它不是错，老包都不带）"),
      ...warnings.map((i) => `  ⚠️ ${i.where}: ${i.message}`),
      `⚠️ 起服务时 **HTTP server 的根必须是 ${rel(outRoot, gameDir)}/** —— ` +
        `打开 /site/v${n}/index.html（根指到 site 里面会 404，而 Phaser 静默失败）`,
    ],
    data: {
      gameId, siteVersion: n, shellVersion: SHELL_VERSION, packVersion,
      packCopied, siteDir: rel(outRoot, siteDir), packDir: rel(outRoot, packDest),
      warnings: warnings.map((i) => `${i.where}: ${i.message}`),
      serveRoot: rel(outRoot, gameDir),
      entry: `${rel(outRoot, siteDir)}/index.html`,
    },
    artifacts: [{ path: rel(outRoot, siteDir), kind: "demo-site" }],
  };
}
