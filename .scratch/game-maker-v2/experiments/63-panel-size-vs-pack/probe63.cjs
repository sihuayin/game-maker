#!/usr/bin/env node
/**
 * 票 63 探针：`hud.panel.size` **从配置读、不从包读** —— 那条例外的**射程由谁看着**
 *
 * **为什么要有它**：票面已经量到「本包那件是九宫格 ⇒ 72×32 的声明站得住」，
 * 并据此把真问题换成「**那条例外的射程，由谁看着？**」——
 * 候选是「无条件」（照 `game-config.ts:142` 那句「唯一例外」原样）
 * 还是「以九宫格为条件」（那就得有人检查条件）。
 *
 * 本探针把**选项空间**量成读数：今天**有没有人**检查那个条件（①②）、
 * 盘上**发生过几次**「声明的 size ≠ 包里的 size」而**其中几件是九宫格**（③④⑧⑨）、
 * 以及**那个数字在两代外壳里是不是同一条规矩**（⑥⑦）。
 *
 * **免费**：只 `require` 已构建的 `packages/contracts/dist` + 盘上**真包**与**真 config**。
 * 不碰网络、不跑管线、零付费、源码一个字节没动。
 */
const path = require("path");
const fs = require("fs");

const ROOT = path.resolve(__dirname, "../../../..");
const C = require(path.join(ROOT, "packages/contracts/dist/index.js"));

const P = (...p) => path.join(ROOT, ...p);
const load = (p) => JSON.parse(fs.readFileSync(P(p), "utf8"));
const line = (s) => console.log(s);
const S = (p) => fs.readFileSync(P(p), "utf8").split("\n");

// 盘上四份真包（三份横版 + 一份塔防）
const PACKS = {
  "12th-wasteland": ".scratch/game-maker-v2/experiments/e2e-wasteland/raw/run-out-2026-10-13e/ruined-city-scavenger/pack/v1/manifest.json",
  "13th-wasteland": ".scratch/game-maker-v2/experiments/e2e-wasteland/raw/run-out-2026-10-13h/ruined-city-scavenger/pack/v1/manifest.json",
  "last-train/v2": "fixtures/packs/last-train/v2/manifest.json",
  "counter-siege/v4": "fixtures/packs/counter-siege/v4/manifest.json",
};

const nine = (a) => a && a.scale9Borders !== undefined;

line("=== ⓪ 盘上四份真包的 ui 资源：几件带九宫格 ===");
for (const [name, p] of Object.entries(PACKS)) {
  if (!fs.existsSync(P(p))) { line(`  ${name}: （盘上没有）`); continue; }
  const m = load(p);
  const ui = m.assets.filter((a) => a.kind === "ui");
  line(`  ${name}: ui ${ui.length} 件，其中带 scale9Borders 的 ${ui.filter(nine).length} 件`);
  for (const a of ui)
    line(`      ${a.id.padEnd(22)} ${String(a.size.w) + "×" + a.size.h}`.padEnd(46) +
      (nine(a) ? `九宫格 ${JSON.stringify(a.scale9Borders)}` : "—"));
}

// ── ①② 「有人检查那个条件吗」：把两件东西喂给今天所有的闸 ────────────────────
line("\n=== ①② 同一份 config，只换面板那一格，今天的闸分得出来吗 ===");
// 用**盘上那份真 config**（`out/last-train/site/v4`）当底子，只动 `hud.panel` 的两个字段 ——
//   这样剩下的判决全是「既有判据对这份输入的意见」，换进来的那一格是唯一的变量。
const BASE = load("out/last-train/site/v4/game-config.json");
const ltPack = load(PACKS["last-train/v2"]);
const man = C.parseAssetPack(ltPack);
if (!man.ok) { line("包解析失败：" + JSON.stringify(man.errors)); process.exit(1); }
const M = man.value;
line(`  底子：out/last-train/site/v4/game-config.json（面板 = hud-lost-slots / 72×32 / at {8,262}）`);
line(`  包：fixtures/packs/last-train/v2 —— hud-lost-slots **72×32 是九宫格**，hud-pip **12×12 没有九宫格**`);

const CASES = [
  ["hud-lost-slots", { w: 72, h: 32 }],   // 盘上 10 份 config 的真实形状（声明 == 包 + 九宫格）
  ["hud-lost-slots", { w: 120, h: 32 }],  // 拉宽一点（九宫格的正当用法）
  ["hud-pip", { w: 12, h: 12 }],          // 非九宫格、声明 == 包
  ["hud-pip", { w: 72, h: 32 }],          // 非九宫格、声明 ≠ 包  ← 要治的那一格
];
for (const [asset, size] of CASES) {
  const a = ltPack.assets.find((x) => x.id === asset);
  // ⚠️ `at` 摆在视口正中 —— 这样**位置**那一族判据（世界尺/视口尺）一律安静，
  //   换进来的「声明 vs 包 vs 九宫格」是四格里**唯一的变量**。
  const cfg = { ...BASE, hud: { ...BASE.hud, panel: { asset, at: { x: 200, y: 100 }, size } } };
  const p = C.parseGameConfig(cfg);
  const tag = `${asset.padEnd(15)} 包 ${String(a.size.w) + "×" + a.size.h} ${nine(a) ? "九宫格" : "  —   "} · 声明 ${size.w}×${size.h}`;
  if (!p.ok) { line(`\n  ${tag}\n     parseGameConfig  : **拒收** —— ${p.errors.join("；")}`); continue; }
  const audit = C.auditGameConfig(p.value, M);
  const ss = C.auditScreenSpace({ w: 480, h: 270 }, C.gameHudScreenItems(p.value, M, { lineHeight: 8 }));
  line(`\n  ${tag}`);
  line(`     全部硬判据：auditGameConfig ${audit.length} 条 · auditScreenSpace ${ss.length} 条`);
  for (const i of audit) line(`       · ${i.where}: ${i.message.slice(0, 90)}`);
  for (const i of ss) line(`       · ${i.where}: ${i.message.slice(0, 90)}`);
}
line("\n  ⇒ 四格**没有一格的差别**来自「声明值与包里的值一致不一致」或「这件资源是不是九宫格」——");
line("     前两格（九宫格、一致/拉开）与后两格（非九宫格、一致/不一致）在今天**完全同罪同罚**。");

// ── ③④ 盘上人口普查：**所有由配置声明的 UI 尺寸** vs 包 vs 九宫格 ────────────
line("\n=== ③ 盘上所有真 config：**每一个由配置声明的 UI 尺寸** vs 包里的尺寸 vs 九宫格 ===");
// ⚠️ 「唯一例外」只在**横版**成立：塔防有三格由配置声明（panel / buttons / start）。
//   所以普查的单位是**格**（`where`），不是 config。
const cfgGlobs = [];
const walk = (dir) => {
  let ents = [];
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of ents) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== "node_modules") walk(p); }
    else if (e.name === "game-config.json" || e.name === "td-config.json") cfgGlobs.push(p);
  }
};
for (const d of ["out", "fixtures", ".scratch"]) walk(path.join(ROOT, d));

const manifestFor = (cfgPath) => {
  const dir = path.dirname(cfgPath);
  const sj = path.join(dir, "site.json");
  if (!fs.existsSync(sj)) return null;
  const rel = path.relative(ROOT, dir);
  const game = rel.split(path.sep)[1];
  const v = JSON.parse(fs.readFileSync(sj, "utf8")).pack;
  const mp = path.join(ROOT, "out", game, "pack", v, "manifest.json");
  return fs.existsSync(mp) ? JSON.parse(fs.readFileSync(mp, "utf8")) : null;
};

/** 一份 config 里**由配置声明尺寸**的那些格：（where, asset, 声明的 size）。 */
const declaredSlots = (c, td) => {
  const out = [];
  if (!c.hud) return out;
  if (c.hud.panel && c.hud.panel.size) out.push(["hud.panel", c.hud.panel]);
  if (td && c.hud.buttons && c.hud.buttons.size) out.push(["hud.buttons", c.hud.buttons]);
  if (td && c.hud.start && c.hud.start.size) out.push(["hud.start", c.hud.start]);
  return out;
};

const rows = [];
for (const cfgPath of cfgGlobs) {
  const c = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
  const td = cfgPath.endsWith("td-config.json");
  const m = manifestFor(cfgPath);
  for (const [where, slot] of declaredSlots(c, td)) {
    const a = m ? m.assets.find((x) => x.id === slot.asset) : null;
    rows.push({
      rel: path.relative(ROOT, cfgPath), td, where, asset: slot.asset, decl: slot.size,
      pack: a ? a.size : null, nine: a ? nine(a) : null,
      same: a ? (a.size.w === slot.size.w && a.size.h === slot.size.h) : null,
    });
  }
}
const withPack = rows.filter((r) => r.pack);
line(`  盘上由配置声明尺寸的 UI 格：**${rows.length}** 处，其中配得上包的 **${withPack.length}** 处`);
const agree = withPack.filter((r) => r.same);
const differ = withPack.filter((r) => !r.same);
line(`    声明 == 包里尺寸：**${agree.length}** 处    声明 ≠ 包里尺寸：**${differ.length}** 处`);
const uniq = (rs, f) => [...new Set(rs.map(f))];
line(`    ≠ 的分布：`);
for (const s of uniq(differ, (r) => `${r.td ? "塔防" : "横版"} ${r.where} → ${r.asset}：声明 ${r.decl.w}×${r.decl.h} / 包 ${r.pack.w}×${r.pack.h}`))
  line(`      · ${s}`);
for (const [name, td] of [["塔防", true], ["横版", false]]) {
  const rs = withPack.filter((r) => r.td === td);
  line(`    ${name}：${rs.length} 格 · 声明≠包 ${rs.filter((r) => !r.same).length} 处 · 九宫格 ${rs.filter((r) => r.nine).length} 处`);
}

line("\n=== ④ 那条例外的前置条件，在盘上被违反过几次 ===");
line(`    配置声明的尺寸所指的**都是九宫格**：${withPack.filter((r) => r.nine).length} / ${withPack.length}`);
line(`    不是九宫格的：${withPack.filter((r) => r.nine === false).length} 处  ⇒ ${withPack.filter((r) => !r.nine).map((r) => r.rel + " " + r.where).join(", ") || "零例"}`);
line(`    「声明 ≠ 包」**且**「不是九宫格」：**${withPack.filter((r) => !r.same && !r.nine).length}** 处  ← 要治的那一格`);
line(`    「声明 ≠ 包」**且**「是九宫格」（例外的正当用法）：**${withPack.filter((r) => !r.same && r.nine).length}** 处`);
line(`    对照：**不由配置声明**（尺寸取自包）的那些格 —— 如 hud.pip / hud.icons.* —— 包的资源**恰好都不是九宫格**`);
line(`      （12th-wasteland 的 hud-scrap-icon/hud-water-icon/hud-interact-prompt 16×16 全无 scale9Borders；`);
line(`        塔防 ui-icon-scrap/life 10×10 同理）—— 两族的资源与用法**对得上**`);

line("\n=== ⑧ 若把规则写成「声明必须 == 包」，今天要付多少代价 ===");
line(`    会被报的既有格：**${differ.length}** 处（全是九宫格被拉伸的正当用法）`);
line(`    ⇒ 「无条件要求一致」这条在**盘上人口里**就已经被证伪`);
line("\n=== ⑨ 若把规则写成「声明 ≠ 包 ⇒ 必须是九宫格」，今天要付多少代价 ===");
line(`    会被报的既有格：**${withPack.filter((r) => !r.same && !r.nine).length}** 处  ← 零`);
line(`    ⇒ 它一处既有格都不伤，而它把例外的**理由**变成**结构上为真**`);

// ── ⑤⑥ 「那个数字今天被谁用」────────────────────────────────────────────────
line("\n=== ⑤⑥ 那个数字的消费者（源码落点）＋ 两代外壳给它的权力不一样 ===");
line("    packages/contracts/src/game-config.ts:389  auditGameConfig 的世界尺（票面写的 :348 已漂） → 盒子");
line("    packages/contracts/src/screen-space.ts:94   横版 HUD 项的盒子（票面写的 :58 已漂） → auditScreenSpace 的视口尺");
line("    packages/contracts/src/td-config.ts:542     塔防世界尺 → 盒子（且锚点取自包）");
line("    packages/demo/src/world.ts:170-172          resolveDraw(…, panelSize) ⇒ 画出来的 w/h **就是声明值**");
line("    packages/demo/src/shell/scene.ts:214-215   九宫格那一路把它当 nineslice 的宽高；");
line("                                               ⚠️ 非九宫格那一路是 add.image(**不设 displaySize**) ⇒ 画的是原生像素");
line("    packages/demo/src/shell/td/scene.ts:161-166 ⚠️ 塔防**两路都给**：fallback 补一句 setDisplaySize");
line("                                               ⇒ 同一个字段，横版「九宫格才作数」、塔防「永远作数」");

const scene = fs.readFileSync(P("packages/demo/src/shell/scene.ts"), "utf8");
const tdScene = fs.readFileSync(P("packages/demo/src/shell/td/scene.ts"), "utf8");
line(`    实测：横版 scene.ts 里 setDisplaySize 出现 **${(scene.match(/setDisplaySize/g) || []).length}** 次；` +
     `塔防 scene.ts 里 **${(tdScene.match(/setDisplaySize/g) || []).length}** 次`);
line(`    实测：横版 addHud 那一段用的是 \`${(scene.match(/this\.add\.image\(p\.at\.x[^;]*/) || ["?"])[0]}\``);
line(`    实测：塔防 drawHud 那一段末尾有 \`${(tdScene.match(/setDisplaySize\(panel\.box[^;]*/) || ["（没有）"])[0]}\``);

// ── ⑦ 骨架那个数从哪来 ───────────────────────────────────────────────────────
line("\n=== ⑦ 骨架示例那一格 72×32 是「谁家包里的数」 ===");
const lt = load(PACKS["last-train/v2"]).assets.find((a) => a.id === "hud-lost-slots");
line(`  fixtures/packs/last-train/v2 的 hud-lost-slots = ${lt.size.w}×${lt.size.h}  ⇒ **与骨架示例逐字节相同**`);
line(`  12th-wasteland 的 hud-bar-backdrop     = 32×16  ⇒ 同一个骨架，这一包里是**另一件东西的尺寸**`);
line(`  而 ops.ts:817 那句算术 \`x > \${vp.w - 72}\` 把 72 **写死在提示词的规则里**`);

// ═════════════════════════════════════════════════════════════════════════════
// 补量（同日 · 第二轮探针 · 只量不裁）
//   ⑩ 那条例外在代码里是**看得见**的（三条相邻行）· ⑪ 视口尺那一侧原样重演 ·
//   ⑫ 每一处消费者手里都有 manifest · ⑬ ⭐ 仓库里**已经有一条**「配置声明 vs 包里尺寸」的判据 ·
//   ⑭ 与票 62 的接缝（删掉 389 之后，幸存的尺子拿不拿得到 manifest）· ⑮ 两代四个家
// ═════════════════════════════════════════════════════════════════════════════

const gc = S("packages/contracts/src/game-config.ts");
const ss = S("packages/contracts/src/screen-space.ts");
const tdc = S("packages/contracts/src/td-config.ts");
const at = (lines, needle) => { const i = lines.findIndex((l) => l.includes(needle)); return i; };

line("\n=== ⑩ ⭐ 那条例外在代码里是**看得见**的 —— 三条相邻行 ===");
const i389 = at(gc, 'inWorld("hud.panel"');
for (const [n, note] of [[i389 - 2, "从**包**取尺寸（`entity.body` 优先，否则 `sizeOf(asset)`）"],
                         [i389 - 1, "从**包**取尺寸"],
                         [i389, "⚠️ **从 config 取尺寸** —— 那条例外"]]) {
  line(`  game-config.ts:${n + 1}  ${gc[n].trim()}`);
  line(`                    ⇒ ${note}`);
}
const iSizeOf = at(gc, "const sizeOf = (assetId: string)");
line(`  ⚠️ 而 \`sizeOf\` 的定义就在 **同一条函数的第 ${iSizeOf + 1} 行**（上面 26 行处），**在这个作用域里**。`);
// 用真数据再证一次：387/388 与 389 在**同一个函数**里
line(`  ⇒ 量出来的一句话：**同一个函数里，隔一行就有一个「从包取尺寸」的反例。**`);

line("\n=== ⑪ 同一个例外在**视口尺**那一侧原样重演 ===");
const iPanel = at(ss, 'where: "hud.panel", at: panel.at');
line(`  screen-space.ts:${iPanel + 1}  ${ss[iPanel].trim()}`);
line(`  screen-space.ts:${iPanel + 2}  ${ss[iPanel + 1].trim()}   ⇒ ⚠️ 尺寸取 **config**`);
line(`  screen-space.ts:${iPanel + 4}  ${ss[iPanel + 3].trim()}   ⇒ 下一格（` + "`hud.pip`" + `）取 **包**`);
const iTdPanel = at(ss, 'items.push({ where: "hud.panel", at: hud.panel.at');
line(`  塔防视口尺 screen-space.ts:${iTdPanel + 1}  ${ss[iTdPanel].trim()}`);
line("  ⇒ ⭐ 两代的两个消费者**都是这个形状**：面板取 config、隔壁的 pip 取包。");

line("\n=== ⑫ 每一处消费者手里，**两份输入都在**吗 ===");
const iAudit = at(gc, "export function auditGameConfig");
line(`  · \`${gc[iAudit].trim()}\`  game-config.ts:${iAudit + 1}  ⇒ **manifest 是入参**`);
line(`     调用点：`);
for (const [f, needle] of [["packages/assets/src/ops.ts", "auditGameConfig(config, manifest)"],
                           ["packages/demo/src/site.ts", "auditGameConfig(config, manifest)"]]) {
  const L = S(f); const k = at(L, needle);
  line(`       ${f}:${k + 1}  ${L[k].trim()}`);
}
const iHudItems = at(ss, "export function gameHudScreenItems");
line(`  · \`${ss[iHudItems].trim()}\`  screen-space.ts:${iHudItems + 1}  ⇒ **manifest 是入参**`);
line(`     而它下面第 ${iPanel + 4} 行就是 \`${ss[iPanel + 3].trim()}\``);
const iTd541 = at(tdc, "const hudPanel = assetOf(config.hud.panel.asset)");
line(`  · \`${tdc[iTd541].trim()}\`  td-config.ts:${iTd541 + 1}  ⇒ 它**已经**在查包（取锚点），只是尺寸仍取 config`);
line(`     下一行：${tdc[iTd541 + 1].trim()}`);
line("  ⇒ ⭐ 判据要的两份东西（config 声明值 + 包里真实尺寸）在**每一处消费者手里都是现成的**。");

line("\n=== ⑬ ⭐⭐ 仓库里**已经有一条**「配置声明 vs 包里尺寸」的判据（票 07）===");
const iTile = at(tdc, "if (a.size.w !== config.arena.cell");
for (let i = iTile - 4; i <= iTile + 3; i++) line(`  td-config.ts:${i + 1}  ${tdc[i].trim()}`);
line("  ⇒ 它比对的就是**包里的尺寸**（`a.size`）与**配置声明的一个数**（`config.arena.cell`）——");
line("     而它的理由句式与本票要写的那句**同款**：「上面那条只要求引用解得开 —— 于是…；而…，**没有任何东西会报错**」。");
line("  ⚠️ 它自己还留了一句自证：**「三个真包的砖都是 cell×cell ⇒ 这条判据不误伤任何真产物」**。");
line("  ⇒ ⭐ 「声明 vs 包」这条路**在这个仓库里已经走过一次**，形状、层级（err）、措辞都是现成的。");

line("\n=== ⑭ ⚠️ 与票 62 的接缝：62 若删掉 389，63 会不会无家可归 ===");
line("  票 62 的推荐是**删掉 game-config.ts:389 那一行**（「HUD 该由哪把尺子判」）。");
line(`  ⇒ 幸存的那把尺子 = \`${ss[iHudItems].trim()}\`（screen-space.ts:${iHudItems + 1}）`);
line(`     它的第二个入参**就是 manifest**，而第 ${iPanel + 4} 行就在用 \`sizeOf(manifest, …)\`。`);
line("  ⇒ ⭐ 「62 删行 ⇒ 63 的判据无家可归」**不成立**：两处候选（config 审计 / 视口尺清单）**各自都有 manifest**。");

line("\n=== ⑮ 两代 · 四个家 ===");
line("  横版：game-config.ts:389（世界尺·config 审计）· screen-space.ts:94（视口尺·HUD 清单）");
line("  塔防：td-config.ts:542（世界尺·config 审计）· screen-space.ts:115（视口尺·HUD 清单）");
line("  ⇒ 四个家**都在 contracts 包里**，四处**都拿得到包**，而四处今天**都从 config 取尺寸**。");

// ═════════════════════════════════════════════════════════════════════════════
// 补量 · 第二轮（同日 · 第三轮探针 · 只读 / 假 `fetch` / 零付费 · 源码一个字节没动）
//   ⑯ ⭐⭐ 价签 A/B：**同一条形状的判据，落在两个位置差 2 发、失败语义还相反**
//   ⑰ ⭐ 模型那一侧看得见什么（尺寸在看 · 九宫格不在看）
//   ⑱ 那条例外的载体住在**哪一步**、谁看着它
//   ⑲ ⚠️ 反向证据：今天有一条测试正把「例外**无条件**」钉成规格
//   ⑳ ⭐ 量纲：声明的那个数不是资源尺寸，是**屏幕空间的盒子**
// ⚠️ 这一段包一层作用域：`.cjs` 的顶层全是同一张 const 表，重名会当场炸。
// ⚠️ ⑯ 会往 `os.tmpdir()/probe63-out` 写**探针自己的**产物（TD 那一格**照常落盘**正是读数之一），
//   跑完即删 —— **仓库里一个字节没动**。
// ═════════════════════════════════════════════════════════════════════════════
(async () => {
  const os = require("os");
  const A = require(path.join(ROOT, "packages/assets/dist/index.js"));
  const TMP = path.join(os.tmpdir(), "probe63-out");
  fs.rmSync(TMP, { recursive: true, force: true });
  const reply = (b) => ({ ok: true, status: 200, json: async () => b, text: async () => JSON.stringify(b) });

  line("\n=== ⑯ ⭐⭐ 价签 A/B：同一条形状的判据，落在两处 ===");
  line("  ⚠️ 口径：拿**假 `fetch`** 驱动**真的** `compileRuntime` / `compileTdGame` —— 走真代码（真循环、");
  line("     真契约、真账、真落盘），由探针**替上游**回话 ⇒ 量的是**链数了几发**，不是模型会怎么写。");
  line("     不发一个网络请求、不花一分钱。");

  // ── A) config 侧：一份**过契约、过不了业务校验**的配置 ──
  const cfgBase = load("out/last-train/site/v4/game-config.json");
  const cfgBad = JSON.parse(JSON.stringify(cfgBase));
  cfgBad.entities[0].at.x = 99999;
  const aIssues = C.auditGameConfig(cfgBad, M);
  line(`\n  A) config 侧 · 把 ${"entities[0].at.x"} 挪到世界外（${"99999"}）`);
  line(`     过得了契约？ parseGameConfig ⇒ **${C.parseGameConfig(cfgBad).ok ? "放行" : "拒收"}**`);
  line(`     业务校验的意见：**${aIssues.length} 条** —— ${aIssues[0].where}: ${aIssues[0].message.slice(0, 40)}…`);
  const aBodies = [];
  const designPath = (() => {
    const ds = [];
    (function walk(d) { let e = []; try { e = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
      for (const x of e) { const p = path.join(d, x.name);
        if (x.isDirectory()) { if (x.name !== "node_modules") walk(p); }
        else if (x.name === "game-design.json") ds.push(p); } })(path.join(ROOT, ".scratch"));
    return ds.find((f) => { try { return JSON.stringify(JSON.parse(fs.readFileSync(f, "utf8")).game?.runtimeProfile).includes("platformer"); } catch { return false; } });
  })();
  const toolEnv = (input) => ({
    stop_reason: "tool_use", model: "deepseek-flash",
    content: [{ type: "tool_use", name: A.CONFIG_TOOL_NAME, input }], usage: { input_tokens: 2100, output_tokens: 900 },
  });
  let aOut = "", aExit = "";
  try {
    const r = await A.compileRuntime({
      designPath, packDir: P("fixtures/packs/last-train/v2"), outRoot: TMP,
      transport: { baseUrl: "http://upstream.test", apiKey: "k" },
      fetchImpl: async (_u, init) => { aBodies.push(String(init.body)); return reply(toolEnv(cfgBad)); },
    });
    aOut = `**返回了**（ok=${r.data.ok}）`;
  } catch (e) {
    aOut = `抛 \`${e.constructor.name}\` · 报文首行「${e.message.split("\n")[0].slice(0, 26)}…」`;
    aExit = ` · 退 **${A.exitCodeOfError(e)}**`;
  }
  line(`     ⇒ **${aBodies.length} 发** · ${aOut}${aExit} · 落盘：**${fs.existsSync(path.join(TMP, "last-train")) ? "落了" : "一个字节都没落"}**`);

  // ── B) TD 侧：一份撞 ⑬ 那条判据（票 07 砖尺寸）的关卡 ──
  const tdBase = load("out/counter-siege/site/v1/td-config.json");
  const tdBad = JSON.parse(JSON.stringify(tdBase));
  tdBad.arena.tiles["="] = { asset: "slot-ring" };   // 20×20，而 arena.cell = 15
  const mt = C.parseAssetPack(load("fixtures/packs/counter-siege/v4/manifest.json")).value;
  const tIssues = C.auditTdConfig(tdBad, mt).filter((i) => i.severity === "error");
  line(`\n  B) TD 侧 · 把 ${"arena.tiles[\"=\"]"} 指到另一件砖（20×20 vs cell 15）`);
  line(`     过得了契约？ parseTdConfig ⇒ **${C.parseTdConfig(tdBad).ok ? "放行" : "拒收"}**`);
  line(`     **⑬ 那条判据**（票 07 砖尺寸）的意见：**${tIssues.length} 条**`);
  line(`       · ${tIssues[0].where}: ${tIssues[0].message.slice(0, 56)}…`);
  const bBodies = [];
  const tdTxt = { stop_reason: "end_turn", model: "deepseek-flash",
    content: [{ type: "text", text: JSON.stringify(tdBad) }], usage: { input_tokens: 2100, output_tokens: 900 } };
  let bOut = "", bLedger = "";
  try {
    const r = await A.compileTdGame({
      requirementPath: P("docs/td-requirement.md"), packDir: P("fixtures/packs/counter-siege/v4"),
      outRoot: path.join(TMP, "td"), transport: { baseUrl: "http://upstream.test", apiKey: "k" },
      fetchImpl: async (_u, init) => { bBodies.push(String(init.body)); return reply(tdTxt); }, attempts: 3,
    });
    bOut = `**返回了**（ok=${r.data.ok}）· 报文里 ❌ ${r.data.issues.filter((i) => i.startsWith("❌")).length} 条`;
    const l = r.data.ledger && r.data.ledger[0];
    if (l) bLedger = ` · 账上 \`attempts=${l.attempts}\` · 这一格有的键 = [${Object.keys(l).sort().join(", ")}]`;
  } catch (e) { bOut = `抛 \`${e.constructor.name}\``; }
  const tdWritten = path.join(TMP, "td", "counter-siege", "td-configs");
  const written = fs.existsSync(tdWritten) ? fs.readdirSync(tdWritten) : [];
  line(`     ⇒ **${bBodies.length} 发** · ${bOut}${bLedger}`);
  line(`     ⇒ 落盘：**${written.length > 0 ? "落了 " + written.join(" / ") + "（" + fs.statSync(path.join(tdWritten, written[0])).size + " 字节）" : "没落"}**`);
  line(`     ⇒ 三发 body 逐字节相同？ **${bBodies.length > 1 && bBodies.every((x) => x === bBodies[0])}**`);
  line("     ⚠️ 而这一格的键里**没有 `failures`** —— 三发全白花，账上只看得见 `attempts=3`（票 27 的那条纪律：");
  line("       「上游没交出可用的东西」与「这一份关卡设计得差」**不是同一个数**，这里留的是后者）。");
  line("  ⇒ ⭐⭐ **同一条形状的判据（「配置声明的数 vs 包里的数」），落在两处差 2 发、失败语义还相反**：");
  line("     config 侧 = **1 发 · 抛 · 不落盘 · 退 4**（拒绝面，票 14 的 Q5）；");
  line("     TD 侧   = **3 发盲重采样 · 不抛 · 照常落盘 · 退 0**（票 06/09：人过目之前提是他看得到哪儿不对）。");
  line("  ⚠️ 而 **⑬ 那条先例（票 07 砖尺寸）落在贵的那一支** —— 而它的两份输入都是**确定性的**");
  line("     （`a.size` vs `arena.cell`）⇒ 重抽一次**救不了**它 ⇒ 那 2 发是纯浪费。");
  line("     ⚠️ 登记，**不在本票射程**（要动的是既有判据的行为）。");

  // ── ⑰ 模型那一侧看得见什么 ──
  line("\n=== ⑰ ⭐ 模型那一侧：尺寸在看，九宫格不在看 ===");
  const wire = JSON.parse(aBodies[0]);
  const brief = (wire.messages[0].content[0].text.split("# 资源包清单")[1] || "").split("# 锚点的意思")[0];
  line(`  真发出去的那份 body 里，「# 资源包清单」那一节里**每一件 ui** 都逐行写着真实尺寸：`);
  for (const l of brief.split("\n").filter((l) => l.trim().startsWith("- `") && l.includes(" · ui · ")))
    line("    " + l.trim());
  const full = wire.messages[0].content[0].text;
  const rb = S("packages/assets/src/ops.ts");
  const iRb = at(rb, "function resourceBrief");
  line(`  而 \`resourceBrief\`（ops.ts:${iRb + 1}）那一行的模板逐字：`);
  line(`    ${rb.slice(iRb, iRb + 8).find((l) => l.includes("lines.push")).trim()}`);
  line(`  ⇒ 真 body 里含 \`scale9Borders\`？ **${full.includes("scale9Borders")}** · 含 \`九宫格\`？ **${full.includes("九宫格")}** · 含 \`ninePatch\`？ **${full.includes("ninePatch")}**`);
  line(`  ⇒ 而它含**真实尺寸**？ **${/·\s*\d+×\d+px/.test(brief)}**（清单里每一件都写着 W×Hpx）`);
  line("  ⇒ ⭐ **config 那一步的模型看得到「包里的真实尺寸」，看不到「这件是不是九宫格」** ——");
  line("     而 `manifest` 里**有** \`scale9Borders\`（`contracts/src/assetpack.ts:155`）⇒ **判据拿得到，模型拿不到**。");
  line("     ⚠️ 所以 Q2 若收窄成条件，那半个条件**不在这一发调用的视野里**：它得靠**配方那一步**（另一发）的记忆。");

  // ── ⑱ 那条例外的载体住在哪一步、谁看着它 ──
  line("\n=== ⑱ 那条例外的载体：哪一步的哪一段散文，谁看着它 ===");
  const pr = S("packages/assets/src/prompt.ts");
  const iSpec = at(pr, "export const recipeShapeSpec");
  const iEmbed = at(pr, "recipeShapeSpec()");
  const iNine = at(pr, "「九宫格」是可选的");
  line(`  · 载体 = \`${pr[iSpec].trim().slice(0, 60)}…\`（prompt.ts:${iSpec + 1}）`);
  line(`    那句判据化的散文在 **prompt.ts:${iNine + 1}**：`);
  for (const l of pr.slice(iNine, iNine + 8)) if (l.trim() !== "") line(`      ${l.trim()}`);
  line(`  · 它被填进 \`assetPlanPrompt\`（prompt.ts:${iEmbed + 1}）—— 而 \`assetPlanPrompt\` 是`);
  line(`    **配方那一步**（\`planAssets\`）的提示词 ⇒ ⚠️ **载体在那一步的模型手里，而这一格是 config 那一步写的**。`);
  const ptp = S("packages/assets/tests/prompt.test.ts");
  line(`  · 谁看着它：\`packages/assets/tests/prompt.test.ts\` 里**两条** \`it\` 钉着它（describe ${"「清单的形状说明：**同时钉住两边**（票 08）」"}）：`);
  for (const [n, note] of [[at(ptp, "**面板那头必须保留**"), "钉 \`✅ 该写：面板\` / \`❌ 不该写：图标\`"],
    [at(ptp, "说了**害处**"), "钉 \`中央区必须平坦且可任意重复\` / \`一圈空心框\`"]])
    line(`      :${n + 1}  ${ptp[n].trim().slice(0, 66)}…  ⇒ ${note}`);
  line("  ⇒ ⭐ **与票 70 正好相反**：那句话**有人看着**（两道判据）—— 但它住的是**另一次调用**");
  line("     与**另一个包**（`assets/tests`），而本票要加的东西在 **config 侧**（`contracts`）。");

  // ── ⑲ 反向证据 ──
  line("\n=== ⑲ ⚠️ 反向证据：今天有一条测试正把「例外**无条件**」钉成规格 ===");
  const gct = S("packages/contracts/tests/game-config.test.ts");
  const iLee = at(gct, "而唯一的例外**照样合法**");
  for (const n of [iLee, iLee + 1, iLee + 2]) line(`  game-config.test.ts:${n + 1}  ${gct[n].trim()}`);
  const iBasePanel = at(gct, 'panel: { asset: "hud-lost-slots"');
  const ltP = load(PACKS["last-train/v2"]).assets.find((a) => a.id === "hud-lost-slots");
  line(`  ⚠️ 而它的样本（\`base()\` 的 panel，:${iBasePanel + 1}）是 \`hud-lost-slots / 72×32\` ——`);
  line(`     包里的那一件 = **${ltP.size.w}×${ltP.size.h}**（九宫格 ${JSON.stringify(ltP.scale9Borders)}）⇒ **声明 == 包**。`);
  line("  ⇒ ⭐ 若 Q2 = (a)（收窄成「声明 ≠ 包 ⇒ 必须是九宫格」），这条测试**不会变红** ——");
  line("     它钉的那一格**恰好落进新判据射程之外**（声明 == 包，新判据根本不看它）⇒");
  line("     ⚠️ **它的名字（「唯一的例外照样合法」）会被架空**：它不再证明「例外无条件」这件事。");
  line("     而它上下两条邻测（`scale` 进不来 / 实体不许自声明 `size`）正是 Q3 要的**负例族**的现成形状。");

  // ── ⑳ 量纲 ──
  line("\n=== ⑳ ⭐ 量纲：声明的那个数不是资源尺寸 ===");
  const iVp = at(rb, "export const DEFAULT_VIEWPORT");
  line(`  ${rb[iVp].trim()}   （ops.ts:${iVp + 1} —— config 与 td 两条路都用它：\`opts.viewport ?? DEFAULT_VIEWPORT\`）`);
  line(`  盘上塔防 \`hud.panel\` 声明 **480×30** / 包 96×26 ⇒ 声明的宽 **480 = \`DEFAULT_VIEWPORT.w\`**（整屏宽）。`);
  const stretch = differ.filter((r) => r.decl.w >= r.pack.w && r.decl.h >= r.pack.h);
  const shrink = differ.filter((r) => r.decl.w <= r.pack.w && r.decl.h <= r.pack.h);
  const mixed = differ.filter((r) => !stretch.includes(r) && !shrink.includes(r));
  line(`  那 30 处「声明 ≠ 包」的形状：**放大 ${stretch.length} 处 · 缩小 ${shrink.length} 处 · 一维大一维小 ${mixed.length} 处**`);
  line(`    （放大：${uniq(stretch, (r) => `${r.where} ${r.decl.w}×${r.decl.h} ← 包 ${r.pack.w}×${r.pack.h}`).join(" · ")}）`);
  line(`    （缩小：${uniq(shrink, (r) => `${r.where} ${r.decl.w}×${r.decl.h} ← 包 ${r.pack.w}×${r.pack.h}`).join(" · ")}）`);
  line("  ⇒ ⭐ 这个字段声明的量纲是**屏幕空间的盒子**，与包里的**像素资源**不是同一件事 ——");
  line("     所以「声明必须 == 包」不只被 30 处反例证伪，它**在量纲上就不成立**。");
  line("  ⚠️ 而 ⑱ 那句散文给的判据是「这件东西**会不会被拉伸**到任意尺寸？会，才写」——");
  line(`     盘上却有 **${shrink.length} 处是缩小**（声明比包小：hud.start 28×22 ← 包 44×22），`);
  line("     那句话的字面（「拉伸」）盖不住它们；九宫格那个机制盖得住（中央被压），**只是没人这么说**。");

  fs.rmSync(TMP, { recursive: true, force: true });
})();
