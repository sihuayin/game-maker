#!/usr/bin/env node
// P0-03a：用 P0-02 冻结原型跑 A/B/C 的分析器输入，验证夹具会触发预期的三态。
//
//   node .scratch/level-playability-v1.1-p0/tools/analyze-cases.mjs [--out <json>] [--json]
//
// ⚠️ 这是**夹具自检**，不是 P0-03 的案例判断；P0-03 必须用真实 trace 决定最终 lagMs 并重跑。
// ⚠️ 只读 cases/**；--out 只写本 effort 的证据 JSON。
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { analyze, verifyWitness } from "../prototype/temporal-model.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EFFORT = path.resolve(HERE, "..");
const ROOT = path.resolve(EFFORT, "../..");
const OUT = (() => {
  const i = process.argv.indexOf("--out");
  return i >= 0 && process.argv[i + 1] ? path.resolve(process.argv[i + 1]) : null;
})();
const JSON_OUT = process.argv.includes("--json");
const sha256 = (p) => `sha256:${crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex")}`;
const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/");

const files = [];
for (const c of ["a", "b", "c"]) {
  const dir = path.join(EFFORT, "cases", c);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir).filter((x) => x.startsWith("analyzer") && x.endsWith(".json")).sort()) files.push(path.join(dir, f));
}

const rows = files.map((p) => {
  const cfg = JSON.parse(fs.readFileSync(p, "utf8"));
  const r = analyze(cfg);
  const witness = r.witness ? {
    departAt: r.witness.departAt,
    arriveAt: r.witness.arriveAt,
    segments: r.witness.segments.length,
    movingSegments: r.witness.segments.filter((s) => Math.abs(s.x1 - s.x0) > 1e-9).length,
    verify: verifyWitness(cfg, r.witness, cfg.options?.lagMs),
  } : undefined;
  return {
    file: rel(p), fileSha256: sha256(p), case: cfg.case ?? path.basename(path.dirname(p)),
    lagMs: cfg.options?.lagMs, verdict: r.verdict, reason: r.reason,
    proof: r.proof, witness, stats: r.stats,
  };
});

const report = {
  script: "tools/analyze-cases.mjs",
  scriptVersion: "p0-03a-analyze-cases/1",
  at: new Date().toISOString(),
  command: "node .scratch/level-playability-v1.1-p0/tools/analyze-cases.mjs --out .scratch/level-playability-v1.1-p0/evidence/03a-fixture-smoke.json --json",
  node: process.version,
  note: "夹具自检，不是 P0-03 的案例判断；最终 lagMs 由 P0-03 的 trace 决定",
  rows,
};
const serialized = JSON.stringify(report, null, 2) + "\n";
if (OUT) { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, serialized); }
if (JSON_OUT || !OUT) process.stdout.write(serialized);
else console.log(`wrote ${rel(OUT)}`);
