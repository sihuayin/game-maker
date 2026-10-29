#!/usr/bin/env node
// 基线重验的只读快照（票 07）：对受保护证据做运行前后逐文件 sha256。
// 用法：node .scratch/evidence-integrity-v1/tools/snapshot-evidence.mjs --out <json>
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const args = process.argv.slice(2);
const outIdx = args.indexOf("--out");
if (outIdx < 0 || args[outIdx + 1] === undefined) {
  console.error("用法：node snapshot-evidence.mjs --out <json>");
  process.exit(2);
}
const OUT = path.resolve(ROOT, args[outIdx + 1]);

const SETS = {
  snapshot: [".scratch/fpvs-v1-final/artifacts/wasteland-scavenger-recipe"],
  packSite: [
    ".scratch/fpvs-v1-final/artifacts/wasteland-scavenger-recipe/pack",
    ".scratch/fpvs-v1-final/artifacts/wasteland-scavenger-recipe/site",
  ],
  reference: [".scratch/fpvs-v1-final/artifacts/reference"],
  fa04: [".scratch/fpvs-v1-final/runs/2026-10-28-visual-review"],
  fa05: [".scratch/fpvs-v1-final/runs/2026-10-28-final-acceptance"],
  fa06: [".scratch/fpvs-v1-final/runs/2026-10-28-regression-closure"],
  gp06: [
    ".scratch/generic-playtest-v1/evidence/06-attempt-1",
    ".scratch/generic-playtest-v1/evidence/06-attempt-2",
  ],
  gp09: [
    ".scratch/generic-playtest-v1/evidence/09-review-record.supplement.json",
    ".scratch/generic-playtest-v1/evidence/09-review-materials.json",
  ],
  workQa: [".scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/run/v1/qa-report.json"],
};

const walk = (abs) => {
  const st = fs.statSync(abs);
  if (st.isFile()) return [abs];
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap((d) => walk(path.join(abs, d.name)));
};
const sha = (p) => "sha256:" + crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/");

const sets = {};
const all = {};
for (const [label, roots] of Object.entries(SETS)) {
  const files = {};
  for (const r of roots) {
    const abs = path.join(ROOT, r);
    if (!fs.existsSync(abs)) continue;
    for (const p of walk(abs)) {
      const key = rel(p);
      files[key] = sha(p);
      all[key] = files[key];
    }
  }
  sets[label] = { files, count: Object.keys(files).length };
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ format: "evidence-readonly-snapshot/v1", generatedAt: new Date().toISOString(), sets, total: Object.keys(all).length, files: all }, null, 2) + "\n");
console.log(`snapshot → ${rel(OUT)} · ${Object.keys(all).length} 文件 · ${Object.entries(sets).map(([k, v]) => `${k}=${v.count}`).join(" · ")}`);
