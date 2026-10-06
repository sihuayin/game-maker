// 票 14 的探针：**运行档编译**那一发，4 次真实请求。
//
// ⚠️ 它量的**不是**「过不过线形状」—— 那件事票 12 刚量过（工具路 4/4）。这一票的真问题是
//   **「设计 + 包 → 一份过得了三族校验的 config」成不成**，而那条路最靠后、最贵。
//   ⇒ 所以这里直接调**出货的那个 op**（`compileRuntime`），而不是手搓一次请求：
//     它把「提示词 → 工具调用 → v3 契约 → 三族校验 → 落盘」整条路都跑一遍。
//
// 输入是**两样真东西**：
//   · 真设计 —— 票 10 的探针真跑出来过的那一份（把三个「调用方才知道」的值照真流程注入）
//   · 真资源包 —— `fixtures/packs/last-train/v2`（票 40 的产物）
//   ⚠️ 两者的 id **不必对上** —— 映射（设计层的实体 → 包里的资源）**是模型的事**，
//     而三族校验查的正是「它映射得对不对」。
//
// 跑法：node .scratch/game-maker-v2/experiments/runtime-first-shot/run.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const HERE = import.meta.dirname;
const ROOT = path.resolve(HERE, "../../../..");
const req = createRequire(path.join(ROOT, "packages/contracts/package.json"));
const { GameDesignSpecSchema } = await import(pathToFileURL(path.join(ROOT, "packages/contracts/dist/game-design.js")).href);
const { compileRuntime } = await import(pathToFileURL(path.join(ROOT, "packages/assets/dist/ops.js")).href);

const BASE = (process.env.ANTHROPIC_BASE_URL ?? "").replace(/\/$/, "");
const KEY = process.env.ANTHROPIC_AUTH_TOKEN ?? process.env.ANTHROPIC_API_KEY ?? "";
if (!BASE || !KEY) throw new Error("凭据没配：ANTHROPIC_BASE_URL / ANTHROPIC_AUTH_TOKEN");
const SHOTS = 4;
const PACK = path.join(ROOT, "fixtures/packs/last-train/v2");
const VIEWPORT = { w: 480, h: 270 };
const HUD_LINE_HEIGHT = 10;

// ── 真设计（票 10 的探针产物）++++++++ 照真流程注入那三个「调用方才知道」的值 ──────────
const rawDesign = JSON.parse(fs.readFileSync(path.join(ROOT, ".scratch/game-maker-v2/experiments/design-first-shot/raw/01-normal.json"), "utf8")).input;
const design = GameDesignSpecSchema.parse({
  ...rawDesign,
  game: { ...rawDesign.game, genre: "platformer", camera: "side", runtimeProfile: { id: "platformer", version: "1" } }
});
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "runtime-probe-"));
const designPath = path.join(tmp, "game-design.json");
fs.writeFileSync(designPath, JSON.stringify(design));

const AVOID = ["http", "timeout"];   // 传输层那两档**不该**出现在这一票的失败分布里
async function shot(i) {
  const label = `${String(i).padStart(2, "0")}-compile-runtime`;
  const t0 = Date.now();
  const outRoot = path.join(tmp, String(i));
  const rec = { label, levelId: design.levels[0]?.id ?? null, ok: false, kind: null, message: null, ms: 0, ledger: null, issues: null, config: null };
  try {
    const r = await compileRuntime({
      designPath, packDir: PACK, outRoot,
      transport: { baseUrl: BASE, apiKey: KEY },
    });
    rec.ok = true;
    rec.ms = Date.now() - t0;
    rec.ledger = r.data.ledger ?? null;
    rec.issues = r.data.issues ?? [];
    rec.configPath = r.data.configPath;
    rec.config = JSON.parse(fs.readFileSync(path.join(outRoot, r.data.configPath), "utf8"));
  } catch (e) {
    rec.ms = Date.now() - t0;
    rec.kind = e?.kind ?? "（不是 CommandError）";
    rec.message = String(e?.message ?? e);
    rec.ledger = e?.ledger ?? null;
  }
  fs.writeFileSync(path.join(HERE, "raw", `${label}.json`), JSON.stringify(rec, null, 2));
  return rec;
}

console.log(`票 14 探针 —— ${SHOTS} 发（base=${BASE}）`);
console.log(`真设计：${design.levels.length} 关 · ${design.entities ? "" : ""}${design.enemies.length} 敌 · 真包：fixtures/packs/last-train/v2`);
console.log(`视口 ${VIEWPORT.w}×${VIEWPORT.h} · 这一步走 R16（工具调用 + 3 次重采样）\n`);

const rows = [];
for (let i = 1; i <= SHOTS; i++) {
  const r = await shot(i);
  rows.push(r);
  const l = r.ledger?.[0];
  console.log(`  ${r.label}: ${r.ms}ms · ${r.ok ? "✅ 过契约 + 过三族校验" : `❌ ${r.kind}`} · 往返 ${l?.attempts ?? "?"}` +
    `${l?.failures ? ` · failures=${JSON.stringify(l.failures)}` : ""}` +
    `${r.ok ? ` · 警告 ${r.issues.length} 条` : ""}`);
  if (!r.ok) console.log(`      病因：${String(r.message).split("\n").slice(0, 4).join(" ／ ").slice(0, 300)}`);
}

const okN = rows.filter((r) => r.ok).length;
console.log("\n── 汇总 ──────────────────────────────────────────────");
console.log(`① **过契约 + 过三族校验**：**${okN}/${rows.length}**`);
const byKind = {}; for (const r of rows) if (!r.ok) byKind[r.kind] = (byKind[r.kind] ?? 0) + 1;
console.log(`   失败分布：${Object.entries(byKind).map(([k, n]) => `${k}×${n}`).join(" · ") || "（无失败）"}`);
console.log(`   传输层那两档（${AVOID.join(" / ")}）出现 ${rows.filter((r) => AVOID.includes(r.kind)).length} 次 —— **它不该出现在这里**`);
if (okN > 0) {
  const oks = rows.filter((r) => r.ok);
  console.log(`② 账：往返 ${oks.map((r) => r.ledger[0].attempts).join(" / ")}（首发就成的几发：${oks.filter((r) => r.ledger[0].attempts === 1).length}/${okN}）`);
  console.log(`③ 警告条数：${oks.map((r) => r.issues.length).join(" / ")}`);
  const w = oks[0].config;
  console.log(`④ 落盘那份：world ${w.world.size.w}×${w.world.size.h}（**必须 270**）· ${w.entities.length} 实体 · objective=${w.objective.kind} gate=${w.objective.gate}`);
}
console.log(`raw/ 落 ${rows.length} 份（含落盘的配置或失败消息，无凭据）`);
