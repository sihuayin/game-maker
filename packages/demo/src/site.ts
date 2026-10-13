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
  CommandError, auditGameConfig, auditLayerCoverage, auditScreenSpace, gameHudScreenItems, parseAssetPack, parseCoverage, parseGameConfig,
  FILLED,
  type AssetPackManifest, type CommandResult, type ConfigIssue, type GameConfig, type LayerCoverage,
} from "@game-maker/contracts";
import { BACKDROP, HUD_LINE_HEIGHT, SHELL_VERSION, VIEWPORT, buildWorld, type Box, type WorldDescription } from "./world.js";
import { failWith, laySite } from "./layout.js";

// ── 第四族 · 几何可行性 ─────────────────────────────────────────────────────
//
// ⚠️ **它跑在 `buildWorld` 的产物上，不是另算一遍** —— 于是「校验过的」与
//   「外壳要画的」是同一份描述，不可能漂移。
//
// ⚠️⚠️ **2026-10-13 · 票 65 改了这条的位置，但没改它的语义**：
//   「层盖不住世界」那条判据**本来也知道世界多宽**（`game-config` 就在手边）⇒ 它
//   **提前到了 `config` 步**（`ops.ts` 那个 `issues` 数组）—— 而**判据与规则本身**
//   都搬进了 `contracts`（`layer-coverage.ts`），**两个调用者调的是同一个函数**
//   ⇒ 一侧改了另一侧不会不跟着改，两侧对同一份输入产生的 message **逐字相等**。
//   ⚠️ 这一族另外那两条 coverage 判据（最远层必须满 / 非最远层不准满）**没动**：
//   它们吃 `coverage.json` 的**像素比例**，是另一件事（票 38 / 50）。

export function auditGeometry(world: WorldDescription, coverage?: readonly LayerCoverage[]): ConfigIssue[] {
  const out: ConfigIssue[] = [];
  const err = (where: string, message: string) => out.push({ severity: "error", where, message });
  const warn = (where: string, message: string) => out.push({ severity: "warning", where, message });

  // ── 背景层：盖得住世界吗（**与 config 步同一份判据**，票 65）──────────────
  out.push(...auditLayerCoverage(world.viewport, world.worldSize, world.background.map((l, i) => ({
    where: `scene.background[${i}]`,
    name: l.draw.missing ? "(解不到的层)" : l.draw.frame,
    parallax: l.parallax,
    drawn: { w: l.box.w, h: l.box.h },
  }))));

  // ── 最远的那一层必须画满（票 50）────────────────────────────────────────
  //
  // ⚠️ **只查最远那层**。`layers` 是从远到近排的 ⇒ `layers[0]` 后面**什么都没有**，
  //   它的透明透过去就是外壳的底色。而**其余层的留白是设计** ——
  //   实测 drawlist 真包的 `wall` 只有 42%、`ground` 只有 14%，那**正是它该有的样子**。
  //   ⇒「所有层都必须满」会当场拒掉那个包 —— 那是**错的**判据（票 50 量出来的）。
  //
  // ⚠️⚠️ **2026-10-10 · 票 38 带日期的自白：这条门禁今天（`ratio < FILLED`）永远不会响。**
  //   它不是坏了，是**当前设计的预期结果** —— 请**不要**把它当成一条活着的判据去依赖，
  //   更**不要**为了让它响起来而去改最远层的抠底：
  //   · 票 38 之后**最远层有意不抠底**（它本来就该铺满，按众数色抠它 = 把这一层自己抠掉）；
  //   · 而实测上游**14/14 张图一个 alpha 都不给**（100% 不透明），抠底之后的
  //     降采样 / 二值化 / 量化**都不动 alpha**（`downscaleArea` 格内均值、`thresholdAlpha`
  //     对 255 仍给 255、`quantize.ts` 原样拷 `out[s + 3] = a`）
  //   ⇒ 最远层交付态的 `ratio` **恒为 1.0** ⇒ `ratio < FILLED` 恒假。
  //   ⚠️ 这条判据**留着**是有意的（票 38 的 Q2）：它表达的是**目标**（最远层必须满），
  //   不是**今天会抓住谁**。代价是一条永远绿的判据 —— 与票 05 在契约里自白
  //   「那两条差集恒为空是预期的」是同一个做法。
  //   ⚠️ 它想守的那种错（最远层没画满）今天在**结构上不会发生**（不抠 + 上游不给 alpha ⇒ 恒满）；
  //   唯一还能发生的形态是**整张全透明**，那一条由 `pack` 侧「一个不透明像素都没有」直接抛。
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
  // ⚠️⚠️ **2026-10-10 · 票 38 带日期的更正：上面那两种成因，今天这条门禁都抓不到了。**
  //   票 38 之后**非最远层改按「这张图上量出来的众数色」抠**（此前按**声明色**，而模型从不交付它）：
  //   · **成因①**（抠图底色没抠掉）：众数色**至少能抠到它自己那些像素** ⇒ `ratio < 1` 恒成立
  //     ⇒ 再也够不到 `FILLED`；
  //   · **成因②**（每层都画了整张场景）：众数色**就是那张场景的主色**（天空）⇒ 抠掉约三到四成
  //     ⇒ `ratio ≈ 0.6`，**远在 `FILLED = 0.999` 的射程之外**。
  //   ⚠️ 实测：非最远层的**真样本只有 2 个**（`0.481` / `0.478`，两张都抠对了），
  //   而「画了整张场景」那一侧**一个 e2e 真样本都没有** ⇒ **阈值今天画不出来** ——
  //   别在这里随手补一条数值区间（那会是一条**恒真**的判据，比没有更糟）。
  //   ⇒ 这一种错今天**只有人眼**看得见（R9 的检查点）。**已知，记在地图的 `Not yet specified` 里。**
  //   ⚠️ 这条门禁本身**留着**（与上面那条同款：它表达目标，不是今天会抓住谁）。
  //   （下面那条 `err(...)` 的文案写的还是上面这两种成因 —— 它今天**打不出来**；
  //     改它等于给一条走不通的路做装修，所以**原样留着**。）
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
  /** ⚠️ **显式站点版本号**（票 16，承票 15 的 Q16/Q17：「父指定、子不自算」）。给了就不自算、撞名即拒。 */
  siteVersion?: number;
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
    // ⚠️ **父指定的版本号原样透下去**（票 15 的 Q16/Q17）—— 给了就不自算。
    ...(opts.siteVersion !== undefined ? { siteVersion: opts.siteVersion } : {}),
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
