// 双基线汇总判定：不信任 step success，逐项检查 outcome / summary / report / anchor / freeze。
import fs from "node:fs";
import path from "node:path";
import { loadRegistry, RegistryError } from "./baseline-registry.mjs";

function readJson(p, label) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    throw new RegistryError("aggregate.json", `${label} 不可读或不是 JSON：${p}（${e instanceof Error ? e.message : String(e)}）`);
  }
}

function sameManifestPath(reportPath, expectedAbs, expectedRel) {
  if (typeof reportPath !== "string" || reportPath.length === 0) return false;
  if (path.isAbsolute(reportPath)) return path.resolve(reportPath) === path.resolve(expectedAbs);
  return path.posix.normalize(reportPath) === path.posix.normalize(expectedRel);
}

export function aggregateDualBaseline({ registryPath, repoRoot, a, b, outPath }) {
  const absRepo = path.resolve(repoRoot);
  const { byId } = loadRegistry({ registryPath: path.resolve(registryPath), repoRoot: absRepo });
  const A = byId.get("fpvs-v1");
  const B = byId.get("p0-02-second-demo-v2");
  if (A === undefined || B === undefined) throw new RegistryError("aggregate.registry", "Registry 缺少 fpvs-v1 或 p0-02-second-demo-v2");
  const problems = [];

  const checkOutcome = (label, outcome) => {
    if (outcome !== "success") problems.push(`${label} outcome=${outcome ?? "(missing)"}（期望 success）`);
  };
  const checkSummary = (label, entry, summaryPath) => {
    if (!summaryPath) return problems.push(`${label} summary 路径缺失`);
    if (!fs.existsSync(summaryPath)) return problems.push(`${label} summary 不存在：${summaryPath}`);
    const s = readJson(summaryPath, `${label} summary`);
    if (s.pass !== true) problems.push(`${label} summary.pass=${s.pass}`);
    if (s.status !== "pass") problems.push(`${label} summary.status=${s.status}`);
    if (s.exitCode !== 0) problems.push(`${label} summary.exitCode=${s.exitCode}`);
    if (s.manifestSha256 !== entry.manifestSha) problems.push(`${label} summary.manifestSha256=${s.manifestSha256} != ${entry.manifestSha}`);
    if (s.expectedManifestSha256 !== entry.manifestSha) problems.push(`${label} summary.expectedManifestSha256=${s.expectedManifestSha256} != ${entry.manifestSha}`);
    if (s.baselineId !== undefined && s.baselineId !== null && s.baselineId !== entry.id) problems.push(`${label} summary.baselineId=${s.baselineId} != ${entry.id}`);
  };
  const checkReport = (label, entry, reportPath, expectedManifestAbs) => {
    if (!reportPath) return problems.push(`${label} report 路径缺失`);
    if (!fs.existsSync(reportPath)) return problems.push(`${label} report 不存在：${reportPath}`);
    const r = readJson(reportPath, `${label} report`);
    if (r.status !== "pass") problems.push(`${label} report.status=${r.status}`);
    if (r.trust?.result !== "matched") problems.push(`${label} report.trust.result=${r.trust?.result}`);
    if (r.trust?.expectedSha256 !== entry.manifestSha) problems.push(`${label} report.trust.expectedSha256 不匹配`);
    if (r.trust?.actualSha256 !== entry.manifestSha) problems.push(`${label} report.trust.actualSha256 不匹配`);
    if (r.input?.manifest?.sha256 !== entry.manifestSha) problems.push(`${label} report.input.manifest.sha256 不匹配`);
    const rel = path.relative(absRepo, entry.manifestAbs).split(path.sep).join("/");
    if (!sameManifestPath(r.input?.manifest?.path, expectedManifestAbs, rel)) {
      problems.push(`${label} report.input.manifest.path=${r.input?.manifest?.path} 与期望 ${expectedManifestAbs} / ${rel} 不一致`);
    }
    if (r.comparison?.verdictMatch !== true) problems.push(`${label} report.comparison.verdictMatch=${r.comparison?.verdictMatch}`);
  };
  const checkFreeze = (freezePath) => {
    if (!freezePath) return problems.push("B-freeze JSON 路径缺失");
    if (!fs.existsSync(freezePath)) return problems.push(`B-freeze JSON 不存在：${freezePath}`);
    const f = readJson(freezePath, "B-freeze");
    if (f.pass !== true) problems.push(`B-freeze pass=${f.pass}`);
    if (!Number.isInteger(f.count) || f.count <= 0) problems.push(`B-freeze count=${f.count}`);
    for (const key of ["missing", "mismatched", "extra"]) {
      if (!Array.isArray(f[key]) || f[key].length > 0) problems.push(`B-freeze ${key} 非空（${Array.isArray(f[key]) ? f[key].length : "missing"}）`);
    }
  };

  checkOutcome("A", a.outcome);
  checkOutcome("B", b.outcome);
  checkOutcome("B-freeze", b.freezeOutcome);
  checkSummary("A", A, a.summaryPath);
  checkSummary("B", B, b.summaryPath);
  checkReport("A", A, a.reportPath, a.manifestPath);
  checkReport("B", B, b.reportPath, b.manifestPath);
  checkFreeze(b.freezePath);

  const result = {
    format: "dual-baseline-aggregate/v1",
    generatedAt: new Date().toISOString(),
    registry: path.relative(absRepo, path.resolve(registryPath)).split(path.sep).join("/"),
    outcomes: { A: a.outcome ?? null, B: b.outcome ?? null, BFreeze: b.freezeOutcome ?? null },
    summaries: { A: a.summaryPath ?? null, B: b.summaryPath ?? null },
    reports: { A: a.reportPath ?? null, B: b.reportPath ?? null },
    freeze: b.freezePath ?? null,
    problems,
    pass: problems.length === 0,
  };
  if (outPath !== undefined) {
    fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
    fs.writeFileSync(path.resolve(outPath), JSON.stringify(result, null, 2) + "\n");
  }
  return result;
}
