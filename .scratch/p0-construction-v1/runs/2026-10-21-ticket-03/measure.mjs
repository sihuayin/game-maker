// 票 03（P0-05a）· 只读测量：对既有包跑 `inspect`，记录像素指标的分布。
// ⚠️ 全程只读：运行前后对每个包的每个文件做 sha256 + mtime 快照并比对；不写 out/、不调上游。
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const CLI = "packages/cli/dist/cli.mjs";
const RUN = ".scratch/p0-construction-v1/runs/2026-10-21-ticket-03";
const PACKS = [
  [".scratch/asset-integration-v1/runs/2026-10-20f-lurker/ruin-scavenger-extraction-assets/pack/v7", "v7（最终包 / 已验收）"],
  ["fixtures/packs/last-train/v2", "last-train v2（已接受 fixture）"],
  ["fixtures/packs/counter-siege/v4", "counter-siege v4（已接受 fixture）"],
  [".scratch/game-maker-v2/experiments/e2e-wasteland/raw/run-out-2026-10-17d/wasteland-scavenger-assets/pack/v1", "e2e 10-17d（真实单跑）"],
  [".scratch/game-maker-v2/experiments/e2e-wasteland/raw/run-out-2026-10-18a/wasteland-scavenger-assets/pack/v2", "e2e 10-18a（真实单跑 / 清单不完整）"],
  [".scratch/style-migration-v1/runs/2026-10-19j-salvage/ruin-scavenger-extraction-assets/pack/v1", "style-migration 10-19j"],
  [".scratch/style-migration-v1/runs/2026-10-19k-standby3-fix/standby3-fix/pack/v1", "style-migration 10-19k"],
  ["out/shift-change-mixed/pack/v7", "shift-change-mixed v7（旧真实跑）"],
  ["out/last-train/pack/v17", "last-train v17（旧真实跑）"],
  [".scratch/game-maker-v2/experiments/e2e-wasteland/raw/run-out-2026-10-13h/ruined-city-scavenger/pack/v1", "e2e 10-13h（旧真实跑）"],
];

const walk = (dir, base = "") => fs.readdirSync(dir, { withFileTypes: true })
  .flatMap((d) => d.isDirectory() ? walk(path.join(dir, d.name), `${base}${d.name}/`) : [`${base}${d.name}`]);
const snapshot = (dir) => {
  const out = {};
  for (const rel of walk(dir).sort()) {
    const p = path.join(dir, rel);
    const st = fs.statSync(p);
    out[rel] = { size: st.size, mtimeMs: st.mtimeMs, sha256: createHash("sha256").update(fs.readFileSync(p)).digest("hex") };
  }
  return out;
};

const before = {}, after = {}, results = [];
for (const [pack, label] of PACKS) {
  if (!fs.existsSync(path.join(pack, "manifest.json"))) { console.log("SKIP (no pack):", pack); continue; }
  before[pack] = snapshot(pack);
  let raw;
  try {
    raw = execFileSync(process.execPath, [CLI, "inspect", pack, "--json"], { encoding: "utf8" });
  } catch (e) {
    console.log("INSPECT FAILED", pack, e.status ?? e.message);
    after[pack] = snapshot(pack);
    continue;
  }
  const parsed = JSON.parse(raw);
  fs.writeFileSync(path.join(RUN, "raw", `${label.split("（")[0].replace(/[^\w.-]+/g, "-")}.json`), raw);
  results.push({ pack, label, data: parsed.data });
  after[pack] = snapshot(pack);
}

// ── 只读证据 ────────────────────────────────────────────────────────────────
const drift = [];
for (const pack of Object.keys(before)) {
  const b = before[pack], a = after[pack] ?? {};
  const keys = new Set([...Object.keys(b), ...Object.keys(a)]);
  for (const k of keys) {
    const x = b[k], y = a[k];
    if (!x || !y || x.size !== y.size || x.mtimeMs !== y.mtimeMs || x.sha256 !== y.sha256)
      drift.push(`${pack}: ${k}`);
  }
}
fs.writeFileSync(path.join(RUN, "readonly-check.json"), JSON.stringify({ packs: Object.keys(before).length, files: Object.values(before).reduce((n, o) => n + Object.keys(o).length, 0), drift }, null, 2));

// ── 汇总 ────────────────────────────────────────────────────────────────────
const rows = { offPalette: [], aspect: [], coverage: [], packOff: [] };
for (const r of results) {
  const d = r.data;
  rows.packOff.push({ pack: r.label, packId: d.packId, assets: d.assets.length, off: d.paletteUsage.offPalette.pixels, share: d.paletteUsage.offPalette.share, opacity: d.paletteUsage.perAsset.reduce((n, x) => n + x.opacityPixels, 0) });
  for (const a of d.paletteUsage.perAsset)
    rows.offPalette.push({ pack: r.label, id: a.id, pixels: a.offPalettePixels, opacity: a.opacityPixels, share: a.opacityPixels === 0 ? 0 : a.offPalettePixels / a.opacityPixels });
  for (const s of d.sourceSizes)
    rows.aspect.push({ pack: r.label, id: s.id, unit: s.unit, source: `${s.source.w}x${s.source.h}`, target: `${s.target.w}x${s.target.h}`, deltaAr: s.deltaAr });
  for (const l of d.layerCoverage)
    rows.coverage.push({ pack: r.label, asset: l.asset, frame: l.frame, ratio: l.ratio });
}
fs.writeFileSync(path.join(RUN, "measurements.json"), JSON.stringify({ packs: results.map((r) => ({ label: r.label, pack: r.pack })), ...rows }, null, 2));

const pct = (x) => (x * 100).toFixed(2) + "%";
console.log("== packs ==");
for (const p of rows.packOff) console.log(`${p.pack} · ${p.packId} · ${p.assets} 资源 · 色板外 ${p.off}/${p.opacity} (${pct(p.share)})`);
console.log("\n== 色板外像素 / 资源（非零） ==");
for (const o of rows.offPalette.filter((x) => x.pixels > 0).sort((a, b) => b.share - a.share))
  console.log(`${o.pack} · ${o.id}: ${o.pixels}/${o.opacity} (${pct(o.share)})`);
console.log("\n== 长宽比差（|delta| 最大的 20 条） ==");
for (const a of [...rows.aspect].sort((x, y) => Math.abs(y.deltaAr) - Math.abs(x.deltaAr)).slice(0, 20))
  console.log(`${a.pack} · ${a.id}${a.unit ? "." + a.unit : ""}: ${a.source} → ${a.target} · ${a.deltaAr > 0 ? "+" : ""}${a.deltaAr.toFixed(1)}%`);
console.log("\n== 背景层覆盖率（每包最小 / 分布） ==");
const byPack = new Map();
for (const c of rows.coverage) { const k = c.pack; (byPack.get(k) ?? byPack.set(k, []).get(k)).push(c.ratio); }
for (const [k, arr] of byPack) { arr.sort((a, b) => a - b); console.log(`${k}: n=${arr.length} min=${pct(arr[0])} p50=${pct(arr[Math.floor(arr.length / 2)])} max=${pct(arr[arr.length - 1])}`); }
console.log("\nread-only drift:", drift.length === 0 ? "无（sha256 + mtime 全一致）" : drift);
