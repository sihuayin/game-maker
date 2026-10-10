// 票 23：**pack 段的逐单元对账** —— 「声明了几笔 / 真买了几笔 / 省了几笔」，每一笔省在哪里。
//
// 为什么要它：pack 失败时**不写 `ledger.json`**（那是收尾才落的，`pack.ts` 的 `Promise.allSettled`
// 之后）⇒「到底花了几个图单元」只能从**盘上的文件**倒推。第三跑就是这么手算出来的，
// 而手算已经出过一次含糊（「treasure-chest-opened 到底是被 `dependsOn` 拦的还是被失败即止拦的」）。
// 这个脚本把那份手算固化成可重跑的代码，并且**把推不出来的部分标成「推定」，不冒充事实**。
//
// 单元划分**逐条照抄 `pack.ts:571-580`**（票 43 / 票 40 那两处裁定的形状）：
//   · animation → **一个动画一个 unit**   → `authoring/generated/<spec.id>.<anim.name>.png`
//   · background → **一层一个 unit**      → `authoring/generated/<spec.id>.<layer.name>.png`
//   · 其余       → **一个资源一个 unit**   → `authoring/generated/<spec.id>.png`
// 另加**母版**（`pack.ts:394-408`）：按 **distinct `spec.masterAsset`** 各一笔 → `authoring/masters/<masterId>.png`
//
// ⚠️ **只有 `source.kind === "image"` 的资产产生图单元**（drawlist 走 `pack.ts:508` 写 JSON，零图钱）。
// ⚠️ 这里算的是「**发出了几笔**」（`u.raw` 存在 = 那张图回来了）。**没回来的**（发出即记、但进程被杀）
//    在这个口径下会被算成「没买」—— 那一笔的真假只有 ledger 说得清，而失败时没有 ledger。**这一点是已知的盲区。**
//
// 跑法：
//   node .scratch/game-maker-v2/experiments/e2e-wasteland/pack-reconcile.mjs <sideDir>
//   node ... <sideDir> --recipe <path/to/asset-recipe.json>
//   <sideDir> 例：raw/run-out/wasteland-scavenger-assets（里面要有 run/v1 或 failed-*/authoring）
import fs from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const flag = (name) => { const i = argv.indexOf(name); return i === -1 ? undefined : argv[i + 1]; };
const SIDE = argv.find((a) => !a.startsWith("--") && a !== flag("--recipe"));
if (SIDE === undefined) {
  console.error("用法：node pack-reconcile.mjs <sideDir> [--recipe <asset-recipe.json>]");
  process.exit(2);
}
const SIDE_ABS = path.resolve(SIDE);

// ── 找 recipe ────────────────────────────────────────────────────────────────
function findRecipe() {
  const explicit = flag("--recipe");
  if (explicit !== undefined) return path.resolve(explicit);
  const runs = fs.existsSync(SIDE_ABS)
    ? fs.readdirSync(SIDE_ABS).filter((d) => d === "run").flatMap((d) =>
        fs.readdirSync(path.join(SIDE_ABS, d)).filter((v) => /^v\d+$/.test(v)).map((v) => path.join(SIDE_ABS, d, v, "asset-recipe.json")))
    : [];
  const ok = runs.filter((p) => fs.existsSync(p));
  if (ok.length === 0) return undefined;
  // 版本号大的赢
  return ok.sort((a, b) => (parseInt(/(\d+)/.exec(path.basename(path.dirname(a)))?.[1] ?? "0", 10)
                          - parseInt(/(\d+)/.exec(path.basename(path.dirname(b)))?.[1] ?? "0", 10))).at(-1);
}

// ── 找 pack 产物（authoring 那棵树）──────────────────────────────────────────
// 三条路都可能：成功落在 `pack/v<N>/`，失败落在 `failed-<ts>/`，跑到一半被杀留在 `.building-*`。
function findAuthoringRoots() {
  if (!fs.existsSync(SIDE_ABS)) return [];
  const hits = [];
  for (const e of fs.readdirSync(SIDE_ABS, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const inside = e.name === "pack"
      ? fs.readdirSync(path.join(SIDE_ABS, e.name)).filter((v) => /^v\d+$/.test(v)).map((v) => path.join(SIDE_ABS, e.name, v))
      : [path.join(SIDE_ABS, e.name)];
    for (const dir of inside) {
      const a = path.join(dir, "authoring");
      if (fs.existsSync(a)) hits.push({ dir, authoring: a, mtime: fs.statSync(a).mtimeMs });
    }
  }
  return hits.sort((x, y) => y.mtime - x.mtime);
}

const recipePath = findRecipe();
if (recipePath === undefined) { console.error(`❌ 在 ${SIDE_ABS} 找不到 asset-recipe.json（用 --recipe 指定）`); process.exit(2); }
const recipe = JSON.parse(fs.readFileSync(recipePath, "utf8"));
const assets = recipe.assets ?? [];

const roots = findAuthoringRoots();
if (roots.length === 0) { console.error(`❌ 在 ${SIDE_ABS} 找不到任何 authoring/（没到 pack？）`); process.exit(2); }
const root = roots[0];               // 最新的一棵
const A = root.authoring;
const exists = (rel) => fs.existsSync(path.join(root.dir, rel));

console.log(`对账对象：${path.relative(process.cwd(), SIDE_ABS)}`);
console.log(`  recipe ：${path.relative(process.cwd(), recipePath)}（${assets.length} 份资产）`);
console.log(`  产物   ：${path.relative(process.cwd(), root.dir)}${roots.length > 1 ? `  ⚠️ 另有 ${roots.length - 1} 棵 authoring，取最新这棵` : ""}`);
// ⚠️ recipe 与产物**可能不是同一次尝试**（失败的 pack 不改 run/v1 的 recipe）—— 明说出来，别让它悄悄成立
const rmt = fs.statSync(recipePath).mtimeMs;
if (rmt > root.mtime) console.log(`  ⚠️ recipe 比产物**新**（${new Date(rmt).toISOString()} > ${new Date(root.mtime).toISOString()}）——两者可能不是同一次尝试，读数存疑`);

// ── 声明：把 recipe 摊成「图单元」清单 ──────────────────────────────────────
const units = [];      // { asset, key, rel, what, cost }
const masters = new Map();  // masterId -> asset id（首个引用者）
for (const a of assets) {
  const s = a.spec ?? {}, src = a.source ?? {};
  if (src.kind !== "image") continue;                       // drawlist：零图钱
  if (s.masterAsset !== undefined && !masters.has(s.masterAsset)) masters.set(s.masterAsset, s.id);
  const list =
    s.kind === "animation" ? (s.animations ?? []).map((x) => ({ what: `动画 ${x.name}`, rel: `authoring/generated/${s.id}.${x.name}.png` }))
    : s.kind === "background" ? (s.layers ?? []).map((l) => ({ what: `层 ${l.name}`, rel: `authoring/generated/${s.id}.${l.name}.png` }))
    : [{ what: "单张", rel: `authoring/generated/${s.id}.png` }];
  for (const u of list) units.push({ asset: s.id, kind: s.kind, ...u });
}
for (const [mid, by] of masters) units.push({ asset: mid, kind: "master", what: `母版（首个引用者 ${by}）`, rel: `authoring/masters/${mid}.png` });

// ── 实买：文件在不在 ────────────────────────────────────────────────────────
for (const u of units) u.bought = exists(u.rel);

// ── 逐资产汇总 ─────────────────────────────────────────────────────────────
const byAsset = new Map();
for (const u of units) {
  const g = byAsset.get(u.asset) ?? { asset: u.asset, declared: 0, bought: 0, units: [] };
  g.declared += 1; if (u.bought) g.bought += 1; g.units.push(u);
  byAsset.set(u.asset, g);
}
const specOf = new Map(assets.map((a) => [a.spec?.id, a.spec ?? {}]));
const depsOf = new Map(assets.map((a) => [a.spec?.id, (a.spec?.dependsOn ?? []).filter((d) => specOf.get(d)?.source?.kind === "image")]));

// ── 省下的每一笔，给出**推定**原因（标了「推定」的就不是事实）──────────────
function reasonFor(g) {
  if (g.bought === g.declared) return undefined;
  const dep = (depsOf.get(g.asset) ?? []).find((d) => { const u = byAsset.get(d); return u !== undefined && u.bought < u.declared; });
  if (g.bought === 0) {
    if (dep !== undefined) return `推定：前置 "${dep}" 没造全 ⇒ 一个字节都没发（pack.ts:559 那道闸）`;
    return "推定：失败即止拦下（同一跑里已有别的调用失败，闸门不再放行）；也可能是 killed";
  }
  return `推定：**这一个资源内部中途断了**（已买 ${g.bought}/${g.declared}）—— 单元是**串行**的，前一个抛了后面就不发`;
}

console.log(`\n=== 逐资产（只列有图单元的）===`);
console.log("  资产".padEnd(26) + "声明".padStart(4) + "实买".padStart(4) + "省".padStart(4) + "  说明");
for (const g of [...byAsset.values()].sort((a, b) => a.asset.localeCompare(b.asset))) {
  const saved = g.declared - g.bought;
  const note = reasonFor(g) ?? "";
  console.log("  " + g.asset.padEnd(24) + String(g.declared).padStart(4) + String(g.bought).padStart(4)
    + String(saved).padStart(4) + "  " + (saved === 0 ? "（买齐）" : note));
  if (saved > 0 && g.bought > 0) for (const u of g.units) if (!u.bought) console.log(`      ↳ 没买：${u.what}`);
}

const D = units.length, B = units.filter((u) => u.bought).length;
const drawlist = assets.filter((a) => a.source?.kind === "drawlist");
console.log(`\n=== 合计 ===`);
console.log(`  资产总数        ${assets.length}（image 源 ${assets.length - drawlist.length} · drawlist 源 ${drawlist.length}，后者零图钱）`);
console.log(`  声明的图单元    ${D}`);
console.log(`  真买到的图单元  ${B}`);
console.log(`  **省下的图单元  ${D - B}**`);
console.log(`  省钱率          ${D === 0 ? "-" : ((D - B) / D * 100).toFixed(1) + "%"}`);

// ── 收尾产物在不在（成功才写；失败时没有 ledger —— 这是票 23 记过的一条）────
const tail = ["ledger.json", "coverage.json", "manifest.json"].map((f) => `${f}:${fs.existsSync(path.join(root.dir, f)) ? "有" : "无"}`);
const deliveryPng = fs.existsSync(path.join(root.dir, "delivery"))
  ? fs.readdirSync(path.join(root.dir, "delivery")).filter((f) => f.endsWith(".png")).length : 0;
console.log(`\n=== 收尾产物 ===\n  ${tail.join(" · ")} · delivery/*.png: ${deliveryPng}`);
if (tail.every((t) => t.endsWith("无"))) console.log("  ⚠️ 三个都没有 ⇒ 这一跑**没写完就断了**，图钱**只能靠上面的文件倒推**，没有账本可对。");

// ⚠️ 机器可读的那份**不写进现场目录**（现场要干净）—— 另落 `raw/reconcile/`。
const OUT = path.join(import.meta.dirname, "raw", "reconcile");
fs.mkdirSync(OUT, { recursive: true });
const outFile = path.join(OUT, path.basename(SIDE_ABS) + ".json");
fs.writeFileSync(outFile, JSON.stringify({
  side: SIDE_ABS, recipe: recipePath, authoring: root.dir,
  declared: D, bought: B, saved: D - B,
  perAsset: [...byAsset.values()],
}, null, 1));
console.log(`\n（机器可读的一份落在 ${path.relative(process.cwd(), outFile)}）`);
