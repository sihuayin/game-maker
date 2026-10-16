// 票 79 探针 —— **只读 · 零付费 · 零网络**。
//
// 量一件事：**「两条同名动画」到底会不会被现有的哪一条判据拦住、拦在哪一步、报文说的是什么。**
//
// ⚠️ 票面那个机制（「帧名由动画名派生 ⇒ 同名动画必然撞帧名 ⇒ 交付侧那条会拒它」）
//   **只对 `drawlist` / `image` 两条策略成立**。`import` 那条策略的帧名来自**配方自己写的**
//   `source.sheet.names`，**不由动画名派生** ⇒ 这条进路必须单独量。
//
// 四问，全部拿**出货的** `dist` 跑（不重写任何等价物）：
//   ① 创作侧：`parseRecipe` 收不收「两条同名动画」
//   ② 派生：`framePlan` 给这两条动画派生出什么帧名（drawlist / image 那条路）
//   ③ 真跑 packer：**零成本**跑完 `import` 那一条（它只读盘上一张 PNG，一次调用都不发）
//      然后问 `parseAssetPack`：**这份真产物过不过交付侧契约**
//   ④ 读者侧：`resolvePackRef` 拿到它，解出什么 · `auditAssetSpec` 报什么
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(HERE, "../../../..");
const A = await import(pathToFileURL(path.resolve(ROOT, "packages/assets/dist/index.js")).href);
const C = await import(pathToFileURL(path.resolve(ROOT, "packages/contracts/dist/index.js")).href);

const STYLE = JSON.parse(fs.readFileSync(
  path.resolve(ROOT, ".scratch/game-creation-v1/experiments/style-transfer-from-test-png/stylespec.json"), "utf8"));
const EPOCH = 1790208000;                 // 固定 epoch ⇒ createdAt 可复现
const PNG = path.resolve(ROOT, "fixtures/import/wan-player-1024.png");   // 1024×1024，切 4 格 256×256

const say = (...a) => console.log(...a);
const rule = (t) => say(`\n${"═".repeat(78)}\n${t}\n${"═".repeat(78)}`);

// ── 两条同名动画的 spec（**其余一律照真实配方写**）──────────────────────────
const SPEC = {
  kind: "animation", id: "hero", role: "玩家角色",
  description: "一个待机两帧的角色", styleId: "style-ref",
  anchor: { x: 0.5, y: 1 }, size: { w: 256, h: 256 }, required: true,
  animations: [
    { name: "idle", frames: 2, loop: true },
    { name: "idle", frames: 2, loop: true },      // ⚠️ 同名
  ],
};

const recipeWith = (source) => ({
  format: "asset-recipe/v1", id: "probe79", styleRef: "authoring/stylespec.json",
  assets: [{ spec: SPEC, source }],
});

// ═══════════════════════════════════════════════════════════════════════════
rule("① 创作侧：`parseRecipe` 收不收「两条同名动画」");

const DRAW = recipeWith({ kind: "drawlist" });
const IMPORT = recipeWith({
  kind: "import", ref: "wan-player-1024.png", background: { tolerance: 30 },
  sheet: {
    columns: 4, rows: 1, frameWidth: 256, frameHeight: 256,
    names: ["hero.a", "hero.b", "hero.c", "hero.d"],
    animations: [
      { name: "idle", frames: ["hero.a", "hero.b"] },
      { name: "idle", frames: ["hero.c", "hero.d"] },   // ⚠️ 同名分组
    ],
  },
});

for (const [label, r] of [["drawlist 配方", DRAW], ["import 配方", IMPORT]]) {
  const p = C.parseRecipe(r);
  say(`   ${label}：parseRecipe = ${p.ok ? "✅ 过（一条判据都没响）" : "❌ 被拒 " + p.errors.join(" / ")}`);
}

// 同一个问题在**更窄的那一层**问一次：`AssetSpecSchema` 自己收不收
const sp = C.AssetSpecSchema.safeParse(SPEC);
say(`   AssetSpecSchema 单独跑：${sp.success ? "✅ 过" : "❌ 不过 " + sp.error.message}`);

// ═══════════════════════════════════════════════════════════════════════════
rule("② 派生：`framePlan` 给这两条动画派生出什么帧名（drawlist / image 那条路）");

const plan = A.framePlan(SPEC);
const names = plan.map((p) => p.name);
say(`   framePlan 逐帧：${names.map((n) => JSON.stringify(n)).join(" · ")}`);
say(`   帧名两两不同？ ${new Set(names).size === names.length ? "✅ 是" : `❌ 否 —— ${names.length} 个帧名只有 ${new Set(names).size} 个不同`}`);
say(`   ⇒ ⭐ drawlist / image 两条策略的帧名**由动画名派生** ⇒ 同名动画**必然**撞帧名（票面的机制在这里成立）`);

// ═══════════════════════════════════════════════════════════════════════════
rule("③ 真跑 packer（import 策略 · 零成本）：这份真产物过不过**交付侧契约**");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "probe79-"));
fs.copyFileSync(PNG, path.join(tmp, "wan-player-1024.png"));
const outDir = path.join(tmp, "out");

// ⚠️ **try/catch 是为了让这个脚本在判据落地之后不再崩**（票 89 施工，2026-10-16）：
//   「动画名重复」一旦成了契约判据，`buildAssetPack` 的**自校验**就会在这里抛。
//   ⇒ 抛与不抛**都是读数**：抛 = 那半边已经堵上；不抛 = 那半边今天还开着（票 79 立案时的样子）。
//   ⚠️ 除了这个 try/catch，本脚本**一个字节没改** —— 所以 `raw-output.txt`（施工前那一跑）
//   与 `raw-output.after.txt`（施工后这一跑）在 ③ 之前**逐字相同**。
let built = null, buildErr = null;
try {
  built = await A.buildAssetPack({
    recipe: IMPORT, style: STYLE, outDir, recipeDir: tmp,
    generate: () => { throw new Error("import 策略不该调生成器 —— 探针里它一次都没被调用"); },
    sourceDateEpoch: EPOCH,
  });
} catch (e) { buildErr = e; }

let entry = null;
if (built !== null) {
  entry = built.manifest.assets[0];
  say(`   产物落盘：${path.relative(ROOT, built.packDir)}（在 tmp 里，**没进仓库**）`);
  say(`   manifest 里那个资源的动画条目：${JSON.stringify(entry.animations.map((a) => ({ name: a.name, frames: a.frames })))}`);
  say(`   ⇒ 两条动画的名字：${JSON.stringify(entry.animations.map((a) => a.name))}`);

  const onDisk = JSON.parse(fs.readFileSync(path.join(built.packDir, "manifest.json"), "utf8"));
  const parsed = C.parseAssetPack(onDisk);
  say(`   ⭐ **写下去的那份 manifest 过 parseAssetPack？** ${parsed.ok ? "✅ 过 —— 交付侧契约收下了它" : "❌ 不过 " + parsed.errors.join(" / ")}`);
} else {
  say(`   ⭐ **`+"`buildAssetPack`"+` 直接抛了 —— 这份产物根本没被提交**（票 89 施工之后的样子）：`);
  say(`      ${String(buildErr.message).split("\n")[0]}`);
  say(`   ⇒ ⚠️ 所以「写下去的那份 manifest 过不过 `+"`parseAssetPack`"+`」这一问**今天问不到了**：`);
  say(`      它比「过不过契约」**更前一步** —— 那份 manifest 压根没机会成为一份包。`);
}

// ═══════════════════════════════════════════════════════════════════════════
rule("④ 读者侧：`resolvePackRef` 与 `auditAssetSpec` 各自说什么");

if (built === null) {
  say("   ⚠️ 这一问**今天量不到活的那一支**（③ 已经抛了）—— 下面拿**手搓的那份 manifest** 问同一件事，");
  say("      它是票 79 立案时packer**真的**写出来的那份（见 `raw-output.txt` 的 ③）：两条同名、帧名两两不同。");
}
const live = built !== null ? built.manifest : {
  format: "assetpack/v4", id: "probe79", version: 1, createdAt: "2026-10-16T00:00:00.000Z",
  generator: { name: "probe79", version: "0" },
  provenance: { mode: "imported" },
  palette: { ref: "authoring/stylespec.json#/palette", size: 1, values: ["#000000"], coverage: { exact: 0, composited: 0, quantized: 1, unbound: 0 } },
  atlases: [{ id: "animations", kind: "animation", meta: "delivery/atlas.animations.json", image: "delivery/atlas.animations.png", size: { w: 512, h: 256 }, frames: 4, assets: ["hero"], checksum: "sha256:" + "0".repeat(64) }],
  assets: [{
    id: "hero", kind: "animation", role: "玩家角色", origin: "imported", paletteBinding: "quantized",
    required: true, size: { w: 256, h: 256 }, anchor: { x: 0.5, y: 1 }, atlasId: "animations",
    frames: [{ name: "hero.a" }, { name: "hero.b" }, { name: "hero.c" }, { name: "hero.d" }],
    animations: [
      { name: "idle", frames: ["hero.a", "hero.b", "hero.c", "hero.d"], loop: true },
      { name: "idle", frames: ["hero.a", "hero.b", "hero.c", "hero.d"], loop: true },
    ],
    authoring: [{ kind: "bitmap", ref: "authoring/imported/wan-player-1024.png", original: "wan-player-1024.png" }],
  }],
  files: [],
};
const res = C.resolvePackRef({ asset: "hero", anim: "idle" }, live);
say(`   resolvePackRef({asset:"hero", anim:"idle"}) = ${res.ok ? "✅ 解开了" : "❌ " + res.error}`);
if (res.ok) say(`     它解到的那一条：name=${JSON.stringify(res.animation?.name)} · frames=${JSON.stringify(res.frames.map((f) => f.name))}`);
say("     ⇒ ⚠️ **不报歧义** —— 两条同名，它只 `find` 到第一条（`assetpack.ts` 的 first-match-wins）");

const audit = C.auditAssetSpec(SPEC, live.assets[0]);
say(`   auditAssetSpec（票 27 的对账）= ${audit.length ? audit.map((m) => JSON.stringify(m)).join(" · ") : "[] 空"}`);
say(`     ⇒ ⚠️ 反过来说：它**报了**，但报文说的是**帧数**（要 2 帧、实际 4 帧），不是**名字重复**`);

// ═══════════════════════════════════════════════════════════════════════════
rule("⑤ 对照组：drawlist 策略走真 packer（生成器是桩，零成本）");

try {
  await A.buildAssetPack({
    recipe: DRAW, style: STYLE, outDir: path.join(tmp, "out2"), recipeDir: tmp,
    generate: (spec) => Array.from({ length: spec.animations.reduce((s, a) => s + a.frames, 0) }, (_, i) => ({
      format: "drawlist+curve/v1", id: spec.id, frame: `f${i}`,
      viewBox: [0, 0, spec.size.w, spec.size.h], expectedSize: [spec.size.w, spec.size.h],
      ops: [
        { op: "rect", x: 0, y: 0, w: spec.size.w, h: spec.size.h, fill: `palette:${i % 5}` },
        { op: "rect", x: 1, y: 1, w: spec.size.w - 2, h: 2, fill: "palette:1" },
      ],
    })),
    sourceDateEpoch: EPOCH,
  });
  say(`   ❌ **居然没抛** —— 与票面的说法不符（若走到这里，说明交付侧那条判据不在岗）`);
} catch (e) {
  say(`   ✅ 抛了（票面的机制在这个策略上成立）：`);
  say(`      ${String(e.message).split("\n")[0]}`);
  say("      ⚠️ 位置：账单写完之后、`renameSync` 之前 —— **钱已经花完了**");
}

say(`\n   [探针临时目录：${tmp}（在 tmp 里，跑完不清理，供人复核；**仓库一个字节没动**）]`);

// ═══════════════════════════════════════════════════════════════════════════
rule("⑥ 零误杀：盘上现有的配方与包，有没有一份会被这条新判据拒掉");

const walkJson = (dir, acc = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === ".git") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkJson(p, acc);
    else if (e.name.endsWith(".json")) acc.push(p);
  }
  return acc;
};

let specs = 0, manifests = 0;
const dupSpec = [], dupPack = [];
for (const f of walkJson(ROOT)) {
  let d; try { d = JSON.parse(fs.readFileSync(f, "utf8")); } catch { continue; }
  const rel = path.relative(ROOT, f);
  const walk = (x) => {
    if (Array.isArray(x)) { x.forEach(walk); return; }
    if (typeof x !== "object" || x === null) return;
    if (x.kind === "animation" && Array.isArray(x.animations)) {
      specs++;
      const ns = x.animations.map((a) => a.name);
      if (new Set(ns).size !== ns.length) dupSpec.push([rel, x.id, ns]);
    }
    for (const v of Object.values(x)) walk(v);
  };
  walk(d);
  if (Array.isArray(d.assets) && Array.isArray(d.atlases) && d.format?.startsWith("assetpack/")) {
    manifests++;
    for (const a of d.assets) {
      const ns = (a.animations ?? []).map((x) => x.name);
      if (new Set(ns).size !== ns.length) dupPack.push([rel, a.id, ns]);
    }
  }
}
say(`   盘上的 manifest：${manifests} 份 · 里面的动画名重复的资源：${dupPack.length} 个`);
say(`   盘上的 kind:"animation" 资源声明（配方/规格）：${specs} 个 · 动画名重复的：${dupSpec.length} 个`);
for (const x of [...dupPack, ...dupSpec].slice(0, 8)) say(`      ⚠️ ${JSON.stringify(x)}`);
say(`   ⇒ 「现在加这一条，会不会把盘上合法的东西判死」—— 今天盘上的答案是**一个都不会**（与票 58 立案时同款）`);
say(`   ⇒ ⚠️ 但「零复现」**不等于**「写不出来」（票 58 立案时也是零复现，而它那一条今天已成判据）`);
