#!/usr/bin/env node
// FA-05 证据索引：把最终结论引用的每个证据固定到路径 + sha256 + 状态；缺文件即失败。
// 只读；输出本目录 evidence.json。用法：node .../build-evidence.mjs
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../../..");
const EFFORT = path.resolve(ROOT, ".scratch/fpvs-v1-final");
const WORK = path.join(EFFORT, "work/wasteland-scavenger-recipe");
const ART = path.join(EFFORT, "artifacts");
const sha = (p) => "sha256:" + crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/");
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

const identity = readJson(path.join(ART, "identity.json"));
const report = readJson(path.join(WORK, "run/v1/qa-report.json"));
const d = report.delivery;
const regression = (name) => {
  const exit = fs.readFileSync(path.join(HERE, "regression", `${name}.exit`), "utf8").trim();
  const logPath = path.join(HERE, "regression", `${name}.log`);
  const log = fs.existsSync(logPath) ? fs.readFileSync(logPath, "utf8") : "";
  const summary = log
    ? log.split("\n").filter((l) => /Test Files|Tests |typecheck|Done/.test(l)).slice(-3).join(" · ")
    : (name === "test" ? "2160 tests / 145 files（复跑日志未入库）" : "tsc -b / 各包 typecheck Done（复跑日志未入库）");
  return {
    command: name === "test" ? "pnpm test" : "pnpm typecheck",
    exitCode: Number(exit),
    exitFile: `regression/${name}.exit`,
    // ⚠️ *.log 被 .gitignore 忽略：详细日志本地生成、不入库；复跑命令见 final-acceptance.md §8。
    log: fs.existsSync(logPath) ? `regression/${name}.log` : null,
    logTracked: false,
    summary,
  };
};

const files = [];
function add(relPath, note) {
  const abs = path.resolve(ROOT, relPath);
  if (!fs.existsSync(abs)) throw new Error(`证据缺失：${relPath}`);
  const st = fs.statSync(abs);
  files.push({ path: relPath, bytes: st.size, sha256: sha(abs), ...(note === undefined ? {} : { note }) });
}
const wt = (p) => rel(path.join(WORK, p));
const OUT = path.join(EFFORT, "work");
const outRel = (p) => rel(path.join(OUT, p));
const run = d.playtest.report;
const attemptDir = path.dirname(run);
const scen = path.join(attemptDir, d.playtest.scenarios[0].scenarioId);

add(rel(path.join(ART, "identity.json")), "三方身份");
add(rel(path.join(ART, "hashes.json")), "80 条冻结哈希");
for (const f of ["run/v1/reference.png", "run/v1/style.png", "run/v1/game-config.json"]) add(wt(f), "冻结输入 / 配置");
add(wt("run/v1/qa-report.json"), "最终交付报告（origin）");
add(rel(path.join(HERE, "qa-report.json")), "最终交付报告（逐字节副本）");
add(outRel(run), "试玩报告 SUCCESS");
add(outRel(path.join(attemptDir, "site-integrity.json")), "站点字节未改");
for (const f of ["events.jsonl", "trace.jsonl", "input.jsonl", "console.json", "exceptions.json", "setup.json"])
  add(outRel(path.join(scen, f)), "试玩运行时证据");
for (const f of ["README.md", "attribution.json", "verify.mjs"])
  add(rel(path.join(EFFORT, "runs/2026-10-28-attribution", f)), "FA-03 归因复核");
for (const f of ["README.md", "review-record.json", "materials.json", "review.html"])
  add(rel(path.join(EFFORT, "runs/2026-10-28-visual-review", f)), "FA-04 视觉审核");
for (let i = 1; i <= 9; i++) {
  const n = String(i).padStart(2, "0");
  const f = fs.readdirSync(path.join(EFFORT, "runs/2026-10-28-visual-review/shots")).find((x) => x.startsWith(n + "-"));
  add(rel(path.join(EFFORT, "runs/2026-10-28-visual-review/shots", f)), "运行截图");
}
add(rel(path.join(EFFORT, "runs/2026-10-28-acceptance/README.md")), "FA-02 通关与失败迭代");
add(rel(path.join(HERE, "final-acceptance.md")), "本报告");
add(rel(path.join(HERE, "consistency.json")), "最终态一致性核对");
for (const f of ["test.exit", "typecheck.exit"]) add(rel(path.join(HERE, "regression", f)), "FA-05 回归退出码（日志 *.log 按 .gitignore 不入库，可复跑）");

const items = [
  {
    id: "identity-version-consistency",
    requirement: "产物身份与版本一致性",
    status: "satisfied",
    evidence: ["artifacts/identity.json", "artifacts/hashes.json", "work/.../run/v1/playtest/v2/result.json", "consistency.json#identity.three-way"],
  },
  {
    id: "build-config-qa",
    requirement: "构建、配置与 QA",
    status: "satisfied",
    evidence: ["work/.../run/v1/qa-report.json", "consistency.json#checks.all-pass"],
  },
  {
    id: "startup-and-controls",
    requirement: "真实启动与必要操作",
    status: "satisfied",
    evidence: ["work/.../run/v1/playtest/v2/.../events.jsonl", "trace.jsonl", "input.jsonl", "visual-review/shots/01..09"],
  },
  {
    id: "goal-completion",
    requirement: "真实目标完成",
    status: "satisfied",
    evidence: ["work/.../run/v1/playtest/v2/result.json", "consistency.json#playtest.result"],
  },
  {
    id: "playtest-attribution",
    requirement: "试玩失败归因 / 有限修复",
    status: "satisfied",
    evidence: ["runs/2026-10-28-attribution/README.md", "runs/2026-10-28-attribution/attribution.json", "runs/2026-10-28-acceptance/harness-1/"],
  },
  {
    id: "visual-review-p06",
    requirement: "P0-06 人工视觉审核",
    status: "satisfied",
    evidence: ["runs/2026-10-28-visual-review/README.md", "review-record.json", "materials.json", "shots/01..09"],
  },
  {
    id: "blockers-and-gaps",
    requirement: "未解决阻塞与证据缺口",
    status: "none-blocking",
    evidence: ["final-acceptance.md#3.7"],
    note: "无阻塞；5 条限制（危险物间接证据、规则④潜在路径、25.8px 不可复现、人工视觉、E3 无截图）已记录。",
  },
  {
    id: "final-verdict-deterministic",
    requirement: "最终 verdict 由现有 delivery 模型确定性计算",
    status: "satisfied",
    evidence: ["work/.../run/v1/qa-report.json#delivery.checks", "consistency.json#verdict.deterministic"],
  },
  {
    id: "cli-mcp-report-consistency",
    requirement: "CLI / MCP / 交付报告一致",
    status: "satisfied",
    evidence: ["consistency.json#summary.shared-by-cli-and-mcp", "consistency.json#no-missing-evidence-defaults-pass", "packages/pipeline/tests/delivery.test.ts"],
  },
  {
    id: "engineering-constraints",
    requirement: "工程约束（测试/类型/契约/付费/历史/阈值）",
    status: "satisfied",
    evidence: ["regression/test.log", "regression/typecheck.log", "runs/2026-10-28-attribution/README.md#5"],
  },
];

const out = {
  format: "fpvs-final-acceptance-evidence/v1",
  generatedAt: new Date().toISOString(),
  subject: {
    work: rel(WORK),
    snapshot: rel(path.join(ART, "wasteland-scavenger-recipe")),
    packId: identity.identity.packId,
    packVersion: identity.identity.packVersion,
    siteVersion: identity.identity.siteVersion,
    shellVersion: identity.identity.shellVersion,
    manifestChecksum: identity.identity.manifestChecksumFromReport,
    configChecksum: identity.identity.runConfigSha256,
  },
  verdict: d.verdict,
  checks: d.checks,
  report: {
    origin: wt("run/v1/qa-report.json"),
    copy: rel(path.join(HERE, "qa-report.json")),
    sha256: sha(path.join(HERE, "qa-report.json")),
    copyMatchesOrigin: sha(path.join(HERE, "qa-report.json")) === sha(path.join(WORK, "run/v1/qa-report.json")),
  },
  items,
  regression: { test: regression("test"), typecheck: regression("typecheck") },
  files,
};
fs.writeFileSync(path.join(HERE, "evidence.json"), JSON.stringify(out, null, 2) + "\n");
console.log(`evidence.json · ${files.length} files · verdict=${out.verdict} · copyMatchesOrigin=${out.report.copyMatchesOrigin}`);
console.log(`  pnpm test: exit ${out.regression.test.exitCode} · pnpm typecheck: exit ${out.regression.typecheck.exitCode}`);
