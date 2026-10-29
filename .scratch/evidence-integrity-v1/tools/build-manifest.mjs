#!/usr/bin/env node
// 生成「冻结期望哈希清单」（票 03）。一次性、人工审查后随 git 固定；校验器只读它。
// 用法：node .scratch/evidence-integrity-v1/tools/build-manifest.mjs [--force]
// 规则（与 PRD A3 / 审计 D1–D12 对齐）：
//   · 只列已入库的非日志证据；*.log 永不入清单；self-test-run/out 排除。
//   · required 项缺失/不可读 ⇒ blocked；hash 不符 ⇒ fail。
//   · work 显式枚举（D5）；delivery 相对路径按 roots.out 解析（D4）。
//   · 06 attempt（harness v2）与交付内 playtest v2（harness v1）都登记（D1）；
//     历史 reference / snapshot run / playtest v1 / rejections 记为 required:false（D6）。
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const MANIFEST_DIR = path.join(ROOT, ".scratch/evidence-integrity-v1/manifest");
const OUT = path.join(MANIFEST_DIR, "expected-hashes.json");
const FORCE = process.argv.includes("--force");
const P = (rel) => path.join(ROOT, rel);
const relOf = (abs) => path.relative(ROOT, abs).split(path.sep).join("/");
const sha = (abs) => "sha256:" + crypto.createHash("sha256").update(fs.readFileSync(abs)).digest("hex");

const ROOTS = {
  out: ".scratch/fpvs-v1-final/work",
  snapshot: ".scratch/fpvs-v1-final/artifacts/wasteland-scavenger-recipe",
  reference: ".scratch/fpvs-v1-final/artifacts/reference",
  artifacts: ".scratch/fpvs-v1-final/artifacts",
  fa04: ".scratch/fpvs-v1-final/runs/2026-10-28-visual-review",
  fa05: ".scratch/fpvs-v1-final/runs/2026-10-28-final-acceptance",
  fa06: ".scratch/fpvs-v1-final/runs/2026-10-28-regression-closure",
  runs: ".scratch/fpvs-v1-final/runs",
  gp: ".scratch/generic-playtest-v1/evidence",
};
const ROOT_ABS = Object.fromEntries(Object.entries(ROOTS).map(([k, v]) => [k, P(v)]));

function walk(relDir, { excludeExt = [], excludeDirs = [] } = {}) {
  const absDir = P(relDir);
  const out = [];
  const rec = (dir) => {
    for (const name of fs.readdirSync(dir).sort()) {
      const abs = path.join(dir, name);
      const rel = path.relative(ROOT, abs).split(path.sep).join("/");
      const st = fs.lstatSync(abs);
      if (st.isDirectory()) {
        if (excludeDirs.includes(name)) continue;
        rec(abs);
      } else if (st.isFile()) {
        if (excludeExt.some((e) => name.endsWith(e))) continue;
        out.push(rel);
      } else {
        throw new Error(`unsupported entry: ${rel}`);
      }
    }
  };
  rec(absDir);
  return out;
}

const files = new Map(); // abs -> { required, role }
function add(rel, { required, role }) {
  const abs = path.resolve(ROOT, rel);
  if (!fs.existsSync(abs)) throw new Error(`candidate missing: ${rel}`);
  const prev = files.get(abs);
  files.set(abs, {
    required: (prev?.required ?? false) || required,
    role: prev?.role ?? role,
  });
}
function addAll(rels, opts) { for (const r of rels) add(r, opts); }

// ── 1. 交付核心（work = roots.out）────────────────────────────────────────
const OUT_WORK = ".scratch/fpvs-v1-final/work/wasteland-scavenger-recipe";
add(`${OUT_WORK}/run/v1/qa-report.json`, { required: true, role: "delivery" });
add(`${OUT_WORK}/run/v1/game-config.json`, { required: true, role: "delivery" });
add(`${OUT_WORK}/run/v1/playtest/v2/result.json`, { required: true, role: "playtest" });
add(`${OUT_WORK}/run/v1/playtest/v2/site-integrity.json`, { required: true, role: "playtest" });
addAll(walk(`${OUT_WORK}/run/v1/playtest/v2/acceptance-win-wasteland-v1`, { excludeExt: [".log"] }), { required: true, role: "playtest" });
// 历史：playtest v1 与 rejections（可选项，仍登记哈希）
addAll(walk(`${OUT_WORK}/run/v1/playtest/v1`, { excludeExt: [".log"] }), { required: false, role: "playtest-historical" });
addAll(walk(`${OUT_WORK}/run/v1/playtest/rejections`, { excludeExt: [".log"] }), { required: false, role: "playtest-rejection" });

// ── 2. 受保护快照（pack + site 50 文件）与历史 reference ──────────────────
addAll(walk(".scratch/fpvs-v1-final/artifacts/wasteland-scavenger-recipe/pack"), { required: true, role: "protected" });
addAll(walk(".scratch/fpvs-v1-final/artifacts/wasteland-scavenger-recipe/site"), { required: true, role: "protected" });
addAll(walk(".scratch/fpvs-v1-final/artifacts/wasteland-scavenger-recipe/run"), { required: false, role: "snapshot-run" });
addAll(walk(".scratch/fpvs-v1-final/artifacts/reference", { excludeExt: [".log"] }), { required: false, role: "reference" });

// ── 3. 冻结身份与旧哈希清单 ───────────────────────────────────────────────
add(".scratch/fpvs-v1-final/artifacts/identity.json", { required: true, role: "identity" });
add(".scratch/fpvs-v1-final/artifacts/hashes.json", { required: false, role: "freeze-manifest" });

// ── 4. FA-04 视觉审核记录 + 材料（44 条）─────────────────────────────────
const VR = ".scratch/fpvs-v1-final/runs/2026-10-28-visual-review";
add(`${VR}/review-record.json`, { required: true, role: "visual-record" });
add(`${VR}/capture.json`, { required: true, role: "visual-record" });
add(`${VR}/materials.json`, { required: true, role: "visual-record" });
addAll(walk(`${VR}/shots`), { required: true, role: "visual-shot" });
const materials = JSON.parse(fs.readFileSync(P(`${VR}/materials.json`), "utf8"));
for (const e of [...materials.materials.reference, ...materials.materials.deliveredAssets, ...materials.materials.visualContext, ...materials.generated])
  add(e.path, { required: true, role: "visual-material" });

// ── 5. FA-05 证据 / 一致性 / 报告 ────────────────────────────────────────
const FA5 = ".scratch/fpvs-v1-final/runs/2026-10-28-final-acceptance";
add(`${FA5}/evidence.json`, { required: true, role: "acceptance-record" });
add(`${FA5}/consistency.json`, { required: true, role: "acceptance-record" });
addAll(walk(FA5, { excludeExt: [".log"] }), { required: true, role: "acceptance-record" });
const evidence = JSON.parse(fs.readFileSync(P(`${FA5}/evidence.json`), "utf8"));
for (const f of evidence.files) add(f.path, { required: true, role: "acceptance-evidence" });

// ── 6. FA-06 回归 ────────────────────────────────────────────────────────
const FA6 = ".scratch/fpvs-v1-final/runs/2026-10-28-regression-closure";
add(`${FA6}/regression.json`, { required: true, role: "regression" });
addAll(walk(`${FA6}/regression`, { excludeExt: [".log"] }), { required: true, role: "regression" });
const regression = JSON.parse(fs.readFileSync(P(`${FA6}/regression.json`), "utf8"));
for (const c of regression.commands) add(`${FA6}/${c.log}`, { required: true, role: "regression" });

// ── 7. 本轮 06 两份真实 attempt（harness/rules v2）───────────────────────
addAll(walk(".scratch/generic-playtest-v1/evidence/06-attempt-1/attempt-v1", { excludeExt: [".log"] }), { required: true, role: "playtest-attempt" });
addAll(walk(".scratch/generic-playtest-v1/evidence/06-attempt-2/attempt-v1", { excludeExt: [".log"] }), { required: true, role: "playtest-attempt" });

// ── 8. FA-09 补审 ────────────────────────────────────────────────────────
add(".scratch/generic-playtest-v1/evidence/09-review-record.supplement.json", { required: true, role: "visual-supplement" });
add(".scratch/generic-playtest-v1/evidence/09-review-materials.json", { required: true, role: "visual-supplement" });

// ── 9. 映射 root（最长前缀）──────────────────────────────────────────────
const rootList = Object.keys(ROOTS).sort((a, b) => ROOT_ABS[b].length - ROOT_ABS[a].length);
function rootOf(abs) {
  for (const k of rootList) {
    const base = ROOT_ABS[k];
    const rel = path.relative(base, abs);
    if (rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel))
      return { root: k, path: rel.split(path.sep).join("/") };
  }
  throw new Error(`no root for ${relOf(abs)}`);
}

const entries = [...files.entries()]
  .map(([abs, meta]) => {
    const { root, path: rel } = rootOf(abs);
    return { root, path: rel, role: meta.role, required: meta.required, bytes: fs.statSync(abs).size, sha256: sha(abs) };
  })
  .sort((a, b) => (a.root === b.root ? a.path.localeCompare(b.path) : a.root.localeCompare(b.root)));

const identity = JSON.parse(fs.readFileSync(P(".scratch/fpvs-v1-final/artifacts/identity.json"), "utf8")).identity;
const qa = JSON.parse(fs.readFileSync(P(`${OUT_WORK}/run/v1/qa-report.json`), "utf8"));
const subject = {
  packId: identity.packId,
  packVersion: identity.packVersion,
  siteVersion: identity.siteVersion,
  shellVersion: String(identity.shellVersion),
  manifestChecksum: identity.manifestFileSha256,
  configChecksum: identity.siteConfigSha256,
};
if (qa.delivery?.pack?.packId !== subject.packId || qa.delivery?.pack?.packVersion !== subject.packVersion)
  throw new Error("subject 与 qa-report.delivery 不一致");
if (qa.delivery?.pack?.manifestChecksum !== subject.manifestChecksum)
  throw new Error("manifestChecksum 与 qa-report.delivery 不一致");

const records = [
  { root: "out", path: "wasteland-scavenger-recipe/run/v1/qa-report.json", role: "qa-report", required: true, identity: true },
  { root: "out", path: "wasteland-scavenger-recipe/run/v1/playtest/v2/result.json", role: "playtest-result", required: true, identity: true },
  { root: "gp", path: "06-attempt-1/attempt-v1/result.json", role: "playtest-attempt", required: true, identity: true },
  { root: "gp", path: "06-attempt-2/attempt-v1/result.json", role: "playtest-attempt", required: true, identity: true },
  { root: "fa04", path: "review-record.json", role: "visual-review", required: true, identity: true },
  { root: "fa04", path: "capture.json", role: "visual-capture", required: true, identity: true },
  { root: "fa04", path: "materials.json", role: "visual-materials", required: true, identity: true },
  { root: "fa05", path: "evidence.json", role: "acceptance-evidence", required: true, identity: true },
  { root: "fa05", path: "consistency.json", role: "acceptance-consistency", required: true, identity: false },
  { root: "fa06", path: "regression.json", role: "regression", required: true, identity: false },
  { root: "gp", path: "09-review-record.supplement.json", role: "visual-supplement", required: true, identity: true },
  { root: "gp", path: "09-review-materials.json", role: "visual-supplement-materials", required: true, identity: true },
  { root: "artifacts", path: "identity.json", role: "identity", required: true, identity: true },
];

const manifest = {
  format: "delivery-evidence-manifest/v1",
  generatedAt: new Date().toISOString(),
  generatedBy: ".scratch/evidence-integrity-v1/tools/build-manifest.mjs",
  note: "一次性生成、人工审查后随 git 固定；校验器只读、绝不回写。信任边界：能发现相对本清单的改动，发现不了清单与被验证据一起被改并提交。",
  subject,
  roots: Object.fromEntries(Object.entries(ROOTS).map(([k, v]) => [k, path.relative(MANIFEST_DIR, P(v)).split(path.sep).join("/")])),
  files: entries,
  records,
};

if (fs.existsSync(OUT) && !FORCE) {
  console.error(`拒绝覆盖已存在的清单：${relOf(OUT)}（确要重建请加 --force）`);
  process.exit(2);
}
fs.mkdirSync(MANIFEST_DIR, { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(manifest, null, 2) + "\n");

const req = entries.filter((e) => e.required);
console.log(`manifest: ${relOf(OUT)}`);
console.log(`files: ${entries.length}（required ${req.length} / optional ${entries.length - req.length}）`);
console.log(`bytes: ${entries.reduce((n, e) => n + e.bytes, 0)}`);
console.log(`records: ${records.length}（identity ${records.filter((r) => r.identity).length}）`);
console.log("by root:", Object.fromEntries([...new Set(entries.map((e) => e.root))].map((r) => [r, entries.filter((e) => e.root === r).length])));
console.log("required roles:", Object.fromEntries([...new Set(req.map((e) => e.role))].map((r) => [r, req.filter((e) => e.role === r).length])));
