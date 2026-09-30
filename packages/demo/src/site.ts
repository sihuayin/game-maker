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
  CommandError, auditGameConfig, auditScreenSpace, gameHudScreenItems, parseAssetPack, parseCoverage, parseGameConfig,
  FILLED,
  type AssetPackManifest, type CommandResult, type ConfigIssue, type GameConfig, type LayerCoverage,
} from "@game-maker/contracts";
import { BACKDROP, HUD_LINE_HEIGHT, SHELL_VERSION, VIEWPORT, buildWorld, type Box, type WorldDescription } from "./world.js";
import { failWith, laySite } from "./layout.js";

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

  // ── 反过来那半边：**不是最远的那几层，不准画满**（2026-09-30 补）────────────
  //
  // ⚠️ 上面那条只查了一个方向，于是留下一个**正好反过来**的洞：
  //   一层「一个透光的地方都没有」的近层，会把后面那几层**整个挡住** —— 这个背景白做。
  //   两种成因，而**两种都会让「最远层画满」那条反而通过**：
  //   ① **抠图底色没抠掉**：提示词里逐字写着要用的纯色（`keyColorFor`），而模型画的是**另一个**
  //      颜色 —— `keyBackground` 一个像素都删不掉 ⇒ 每层的不透明率恒为 1；
  //   ② **每层都把整张场景画了一遍**：每一层的提示词里塞的都是**整张场景**的描述
  //      （`layers` 只带 `{name, tileable}`，没有逐层描述 —— 那处缝在契约里）。
  //
  // ⚠️ 判据凭什么不是「多少」：17 个包 · 126 张生图原图 · 两个上游实测下来，
  //   **抠掉 0 像素的只有 3 张**（同一个包的三层背景），而**其次最低的一档是 3.5%**；
  //   真包的近层按设计就停在 14% / 42%。⇒ 「满」与「不满」之间**不是多少，是两种东西**
  //   （与那条 `killed === 0` 同一个道理）。用同一个 `FILLED` 当界：最远那层**要**够到它，
  //   其余层**不许**够到它。
  if (coverage && world.background.length > 1)
    world.background.slice(1).forEach((l, k) => {
      const i = k + 1;
      const name = l.draw.missing ? null : l.draw.frame;
      const c = name === null ? undefined : coverage.find((x) => x.frame === name);
      if (!c || c.ratio < FILLED) return;
      err(`scene.background[${i}]`, `层 "${c.frame}" **一个透光的地方都没有**（${(100 * c.ratio).toFixed(1)}% 都画了东西）—— ` +
        `它会把后面那 ${i} 层整个挡住，这个背景等于只有一层。两种成因：\n` +
        `  · **抠图底色没抠掉**：提示词逐字要求背景用某个纯色，而模型画了另一个颜色 —— ` +
        `抠不掉就一层洞都没有（⚠️ 这会顺带让「最远层必须画满」那条**假通过**）；\n` +
        `  · **每层都画了整张场景**：分层背景的每一层只该画**它自己那一层**的东西。\n` +
        `⚠️ 其余层的留白**是设计**（票 50 实测：真包 \`wall\` 42% · \`ground\` 14%）—— ` +
        `这条要的是「**别满**」，不是「要满」`);
    });

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
  // ⚠️ **第五族（HUD 屏幕空间）与它分开、而且共用一份**（票 03）——
  //   「有哪些 HUD 项」只有一份名单，compile 与 site 读的是同一个（票 03 量到两份会各漏各的）。
  const screenIssues = auditScreenSpace(VIEWPORT, gameHudScreenItems(config, manifest, { lineHeight: HUD_LINE_HEIGHT }));
  const all = [...audit, ...screenIssues, ...geometryIssues];
  const errors = all.filter((i) => i.severity === "error");
  if (errors.length > 0) failWith("装配期校验不过 —— 硬失败，不产出站点", errors);

  // ── 摆目录（**与塔防共用同一份**，见 `layout.ts`）────────────────────────
  const laid = laySite({
    packDir: opts.packDir, outRoot, gameId, packVersion,
    shellJsPath: opts.shellJsPath, config, configFileName: "game-config.json",
  });
  const { siteDir, siteVersion: n, packCopied } = laid;

  // ── 报账 ────────────────────────────────────────────────────────────────
  const warnings = all.filter((i) => i.severity === "warning");
  return {
    command: "site",
    summary: [
      `站点：${rel(outRoot, siteDir)}（${packCopied ? "拷入" : "复用已存在的"}包 ${rel(outRoot, laid.packDest)}）`,
      `消费：外壳 v${SHELL_VERSION} · 资源包 ${packVersion}（${manifest.assets.length} 个资源）`,
      `校验：三族 + 第四族（几何）+ 第五族（HUD 屏幕空间）全过${warnings.length ? `；${warnings.length} 条警告` : ""}` +
        (coverageLayers ? "" : " ⚠️（这个包没有 coverage.json，「最远层画满」那条没查 —— 它不是错，老包都不带）"),
      ...warnings.map((i) => `  ⚠️ ${i.where}: ${i.message}`),
      `⚠️ 起服务时 **HTTP server 的根必须是 ${rel(outRoot, gameDir)}/** —— ` +
        `打开 /site/v${n}/index.html（根指到 site 里面会 404，而 Phaser 静默失败）`,
    ],
    data: {
      gameId, siteVersion: n, shellVersion: SHELL_VERSION, packVersion,
      packCopied, siteDir: rel(outRoot, siteDir), packDir: rel(outRoot, laid.packDest),
      warnings: warnings.map((i) => `${i.where}: ${i.message}`),
      serveRoot: rel(outRoot, gameDir),
      entry: `${rel(outRoot, siteDir)}/index.html`,
    },
    artifacts: [{ path: rel(outRoot, siteDir), kind: "demo-site" }],
  };
}
