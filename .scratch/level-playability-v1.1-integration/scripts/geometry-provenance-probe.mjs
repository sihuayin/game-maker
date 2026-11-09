#!/usr/bin/env node
// I00-02 · 几何证据来源只读探针。
//
//   node .scratch/level-playability-v1.1-integration/scripts/geometry-provenance-probe.mjs <packDir> [--json]
//
// 做四件事（全部只读；不写 packDir 内任何文件）：
//   1. verifyPack：manifest schema + 逐文件 checksum + 反向穷举。
//   2. acceptAnimationPack：与 `accept` 命令同一条结构验收（不落 report）。
//   3. 直接读 manifest + atlas JSON，逐帧列出 sourceSize / anchor 与 manifest 标称值的比较。
//   4. 复算 acceptance report 会记录的三个身份指纹（manifest / atlas meta / atlas image）。
//
// 退出码：0 = 全部通过（verify 通过且 acceptance 无 error）；1 = 有失败；2 = 用法错误。
// ⚠️ 只用于取证；不得接入生产构建 / CI。
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { acceptAnimationPack, verifyPack } from "../../../packages/assets/dist/index.js";

const packDirArg = process.argv[2];
const JSON_OUT = process.argv.includes("--json");
if (!packDirArg) {
  console.error("用法：node geometry-provenance-probe.mjs <packDir> [--json]");
  process.exit(2);
}
const packDir = path.resolve(packDirArg);
const sha256 = (buf) => `sha256:${crypto.createHash("sha256").update(buf).digest("hex")}`;
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

function runVerify() {
  try {
    const r = verifyPack({ packDir });
    return { ok: true, summary: r.summary, data: r.data };
  } catch (e) {
    return { ok: false, kind: e?.kind ?? null, message: e instanceof Error ? e.message : String(e) };
  }
}

function runAcceptance() {
  try {
    const r = acceptAnimationPack({ packDir });
    const errors = r.report.findings.filter((f) => f.severity === "error");
    const warnings = r.report.findings.filter((f) => f.severity === "warning");
    return {
      ok: true,
      hasErrors: r.hasErrors,
      findings: r.report.findings.map((f) => ({ code: f.code, severity: f.severity, frame: f.frame ?? null, assetId: f.assetId ?? null })),
      errorCount: errors.length,
      warningCount: warnings.length,
      // 与 report.json 会落盘的身份字段口径完全一致（acceptance.ts:501-514）
      identity: {
        pack: r.report.pack,
        baseline: r.report.baseline,
        humanVerdict: r.report.human.verdict,
      },
    };
  } catch (e) {
    return { ok: false, kind: e?.kind ?? null, message: e instanceof Error ? e.message : String(e) };
  }
}

function frameComparison(manifest) {
  const rows = [];
  for (const asset of manifest.assets ?? []) {
    const atlas = (manifest.atlases ?? []).find((a) => a.id === asset.atlasId);
    if (!atlas) { rows.push({ asset: asset.id, error: "atlas-not-declared" }); continue; }
    const metaPath = path.resolve(packDir, atlas.meta);
    let json = null;
    try { json = readJson(metaPath); } catch { /* 交给 verify / acceptance 报 */ }
    const frames = [];
    for (const ref of asset.frames ?? []) {
      const jf = json?.frames?.[ref.name];
      if (!jf) { frames.push({ frame: ref.name, missingInAtlas: true }); continue; }
      const sizeOk = jf.sourceSize?.w === asset.size?.w && jf.sourceSize?.h === asset.size?.h;
      const anchorPresent = jf.anchor !== undefined;
      const anchorOk = anchorPresent
        && Math.abs(jf.anchor.x - asset.anchor.x) <= 1e-9
        && Math.abs(jf.anchor.y - asset.anchor.y) <= 1e-9;
      frames.push({
        frame: ref.name,
        manifestSize: asset.size, frameSourceSize: jf.sourceSize, sizeOk,
        manifestAnchor: asset.anchor,
        frameAnchor: jf.anchor ?? null,
        anchorPresent, anchorOk,
      });
    }
    rows.push({
      asset: asset.id, kind: asset.kind, atlasId: asset.atlasId, meta: atlas.meta,
      manifestSize: asset.size, manifestAnchor: asset.anchor,
      frames,
    });
  }
  return rows;
}

function identityFingerprints(manifest) {
  const manifestPath = path.join(packDir, "manifest.json");
  const out = {
    manifestChecksum: sha256(fs.readFileSync(manifestPath)),
    atlases: (manifest.atlases ?? []).map((a) => {
      const metaPath = path.resolve(packDir, a.meta);
      const imagePath = path.resolve(packDir, a.image);
      return {
        id: a.id,
        metaChecksum: fs.existsSync(metaPath) ? sha256(fs.readFileSync(metaPath)) : null,
        imageChecksum: fs.existsSync(imagePath) ? sha256(fs.readFileSync(imagePath)) : null,
        declaredImageChecksum: a.checksum,
      };
    }),
    declaredFiles: (manifest.files ?? []).map((f) => {
      const abs = path.resolve(packDir, f.path);
      const actual = fs.existsSync(abs) ? sha256(fs.readFileSync(abs)) : null;
      return { path: f.path, declared: f.checksum, actual, match: actual === f.checksum };
    }),
  };
  return out;
}

const manifestPath = path.join(packDir, "manifest.json");
let manifest = null;
if (fs.existsSync(manifestPath)) {
  try { manifest = readJson(manifestPath); } catch { /* verify 会报 */ }
}

const result = {
  probe: "i00-02/geometry-provenance-probe",
  at: new Date().toISOString(),
  node: process.version,
  packDir,
  readOnly: true,
  verify: runVerify(),
  acceptance: runAcceptance(),
  frames: manifest === null ? null : frameComparison(manifest),
  identity: manifest === null ? null : identityFingerprints(manifest),
};

const serialized = JSON.stringify(result, null, 2) + "\n";
if (JSON_OUT) process.stdout.write(serialized);
else {
  const v = result.verify.ok ? "PASS" : "FAIL";
  const a = result.acceptance.ok ? (result.acceptance.hasErrors ? "ERRORS" : "CLEAN") : "THREW";
  console.log(`pack=${packDir}`);
  console.log(`verify=${v} acceptance=${a}`);
  if (!result.verify.ok) console.log(`  verify: ${result.verify.message.split("\n")[0]}`);
  if (!result.acceptance.ok) console.log(`  acceptance: ${result.acceptance.message.split("\n")[0]}`);
  else if (result.acceptance.errorCount > 0)
    console.log(`  acceptance errors: ${result.acceptance.findings.filter((f) => f.severity === "error").map((f) => f.code).join(", ")}`);
  if (result.identity) console.log(`  manifestChecksum=${result.identity.manifestChecksum}`);
  console.log(`  files=${result.identity?.declaredFiles.length ?? 0} mismatched=${result.identity?.declaredFiles.filter((f) => !f.match).length ?? "?"}`);
}

const exitFail = !result.verify.ok || !result.acceptance.ok || result.acceptance.hasErrors;
process.exitCode = exitFail ? 1 : 0;
