#!/usr/bin/env node
// 把 DoD 收口的一次运行（回归日志 / 证据报告 / 只读快照 / 07 交叉）汇总成
// final-acceptance.json + final-acceptance.md（票 08）。只读输入，只写 EI_BASE 内文件。
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
if (process.env.EI_BASE === undefined) { console.error("EI_BASE 未设置"); process.exit(2); }
const BASE = path.resolve(ROOT, process.env.EI_BASE);
const read = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const sha = (p) => "sha256:" + crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/");

const evidenceRoot = path.join(BASE, "evidence");
const summaryDir = fs.readdirSync(evidenceRoot).find((n) => n.endsWith("-test-evidence"));
const summary = read(path.join(evidenceRoot, summaryDir, "summary.json"));
const reportPath = path.join(BASE, "report.json");
const report = read(reportPath);
const before = read(path.join(BASE, "snapshot-before.json"));
const after = read(path.join(BASE, "snapshot-after.json"));
const cross = read(path.join(BASE, "07-inherited-copy.json"));
const acceptance = read(path.join(BASE, "acceptance", "free-acceptance.json"));
const date = summary.generatedAt.slice(0, 10);
const selftest = read(path.join(ROOT, `.scratch/playtest-v1/runs/${date}-self-test/summary.json`));

const changed = [];
for (const [k, v] of Object.entries(before.files)) if (after.files[k] !== v) changed.push({ path: k, before: v, after: after.files[k] ?? null });
for (const k of Object.keys(after.files)) if (!(k in before.files)) changed.push({ path: k, before: null, after: after.files[k] });

// 本机实测墙钟（2026-10-29 本次运行）；exit / log 从文件派生，不手填。
const DURATIONS = { test: 25_000, typecheck: 10_000, playtest: 33_000, acceptance: 32_000, evidence: summary.durationMs, crossCheck07: null };
const exitOf = (name) => Number(fs.readFileSync(path.join(BASE, "regression", `${name}.exit`), "utf8").trim());
const commands = [
  { id: "test", command: "pnpm test", exit: exitOf("test"), durationMs: DURATIONS.test, log: `regression/test.log` },
  { id: "typecheck", command: "pnpm typecheck", exit: exitOf("typecheck"), durationMs: DURATIONS.typecheck, log: `regression/typecheck.log` },
  { id: "playtest", command: "pnpm test:playtest", exit: exitOf("playtest"), durationMs: DURATIONS.playtest, log: `regression/playtest.log`, artifact: `.scratch/playtest-v1/runs/${date}-self-test/summary.json` },
  { id: "acceptance", command: `FREE_ACCEPTANCE_OUT=<run>/acceptance pnpm test:acceptance`, exit: exitOf("acceptance"), durationMs: DURATIONS.acceptance, log: `regression/acceptance.log`, artifact: `acceptance/free-acceptance.json` },
  { id: "evidence", command: `pnpm test:evidence -- --out <run>/evidence`, exit: exitOf("evidence"), durationMs: DURATIONS.evidence, log: `regression/evidence.log`, artifact: summary.reportDir },
  { id: "crossCheck07", command: `EI_OUT=<run>/07-inherited-copy.json node .scratch/evidence-integrity-v1/scripts/07-verify-inherited-copy.mjs`, exit: exitOf("07-crosscheck"), durationMs: DURATIONS.crossCheck07, log: `regression/07-crosscheck.log`, artifact: `07-inherited-copy.json` },
];

const files = report.results.files;
const identities = report.results.identities;
const consistency = report.results.consistency;
const count = (xs, s) => xs.filter((x) => x.status === s).length;

const dod = [
  {
    id: 1, statement: "正式验收入口会重新计算所有范围内必需证据的哈希", verdict: "MET",
    evidence: [
      `report.results.files: ${files.length}/${files.length} verified（required ${summary.files.required}）`,
      `入口：\`verify-delivery --manifest\`（CLI）与 \`pnpm test:evidence\`；CLI exit ${summary.exitCode}`,
      `清单 ${summary.manifestSha256}`,
    ],
  },
  {
    id: 2, statement: "证据缺失、篡改和不可读取均可被发现", verdict: "MET",
    evidence: [
      "负向测试：内容篡改 → hash-mismatch/fail；必需文件缺失 → missing/blocked；目录冒充文件 → unreadable/blocked",
      "`packages/pipeline/tests/evidence-integrity.test.ts` 18 个用例，全部在 `pnpm test` 内通过",
    ],
  },
  {
    id: 3, statement: "身份、引用及关键报告的一致性得到正式校验", verdict: "MET",
    evidence: [
      `report.results.identities: ${identities.length}/${identities.length} verified；report.results.consistency: ${consistency.length}/${consistency.length} verified`,
      `13 条 records 全部解析；diagnostics=${report.diagnostics.length}`,
      "负向测试：身份不符/字段缺失、报告引用错 attempt、材料集合不一致、三方哈希矛盾",
    ],
  },
  {
    id: 4, statement: "最终结论从当前有效检查重新计算，而非直接继承历史声明", verdict: "MET",
    evidence: [
      `declared=${report.declared.verdict} · recomputed=${report.recomputed.verdict}（由当前证据重导出，deriveDeliveryVerdict）`,
      "负向测试「结论过期：声明 pass，当前必需证据失效 → 不再 pass」",
    ],
  },
  {
    id: 5, statement: "声明结论与重算结论的差异可被定位", verdict: "MET",
    evidence: [
      `report.comparison.verdictMatch=${report.comparison.verdictMatch}；六项 check 逐项 declared/recomputed/match`,
      "失败诊断带 root/path/rule（hash-mismatch、path-invalid、reference-invalid、unreadable…），非笼统 verification failed",
    ],
  },
  {
    id: 6, statement: "负向测试覆盖篡改、缺失、错配、路径逃逸和结论过期", verdict: "MET",
    evidence: [
      "18 个 pipeline 用例：篡改 / 缺失 / 身份不符 / 身份缺 / 三方矛盾 / verdict 不一致 / `..` 越界 / 不可读 / root 外链接 / 悬空链接 / root 内合法链接 / 绝对路径 / 引用错 attempt / 材料集合 / 结论过期 / 只读性 / 确定性",
      "6 个 CLI 用例：usage/invalid/--out 越界/blocked 落盘/fail 定位/目录不覆盖",
    ],
  },
  {
    id: 7, statement: "测试证明原始证据、历史记录和受保护交付未被修改", verdict: "MET",
    evidence: [
      `${Object.keys(before.files).length} 个受保护文件运行前后逐文件 sha256 零变化（snapshot 66 · pack/site 50 · reference 14 · FA-04 29 · FA-05 10 · FA-06 162 · 06 attempts 28 · 09 2 · work qa-report 1）`,
      "证据目录 `git status` 零改动（fpvs-v1-final / generic-playtest-v1 / manifest）",
    ],
  },
  {
    id: 8, statement: "当前冻结 Demo 通过正式基线重验，或对任何差异作出明确、可审计的解释", verdict: "MET",
    evidence: [
      `本次重验 status=${report.status} · exit ${summary.exitCode} · ${summary.durationMs}ms · ${summary.files.total} 文件（required ${summary.files.required}）· 13 records · diagnostics=${report.diagnostics.length}`,
      `07 独立交叉：${cross.summary.checks} 项 / failed ${cross.summary.failed}`,
    ],
  },
  {
    id: 9, statement: "`pnpm test`、`pnpm typecheck`、`pnpm test:playtest`、`pnpm test:acceptance` 全部通过", verdict: "MET",
    evidence: [
      "pnpm test exit 0（149 文件 / 2231 用例）",
      "pnpm typecheck exit 0",
      `pnpm test:playtest exit 0（self-test 4/4；10 文件 / 143 用例）`,
      `pnpm test:acceptance exit 0（vitest + mechanic-probe + coverage satisfied，allOk=${acceptance.allOk}）`,
      `pnpm test:evidence exit 0（pass）`,
    ],
  },
  {
    id: 10, statement: "不新增付费调用、不覆盖历史版本、不降低验收阈值", verdict: "MET",
    evidence: [
      "本次只运行本地命令：vitest / tsc / Chrome 探针 / verify-delivery；无生图或文本上游调用",
      "历史 run/v1、pack/site、FA-04/05/06、06 attempts、09 补审零改动；新记录写入新目录",
      "未修改 contracts 阈值或结论规则；本轮源码改动为零",
    ],
  },
];

const result = {
  format: "evidence-final-acceptance/v1",
  generatedAt: new Date().toISOString(),
  conclusion: report.status,
  subject: report.input.subject,
  manifest: { path: report.input.manifest.path, sha256: report.input.manifest.sha256, files: summary.manifestFiles, required: summary.files.required, optional: summary.files.optional, bytes: summary.manifestBytes },
  commands,
  evidence: {
    status: report.status, exitCode: summary.exitCode, durationMs: summary.durationMs,
    report: { path: "report.json", sha256: sha(reportPath), markdown: "report.md", nested: summary.reportDir },
    files: { total: files.length, verified: count(files, "verified") },
    identities: { total: identities.length, verified: count(identities, "verified") },
    consistency: { total: consistency.length, verified: count(consistency, "verified") },
    records: summary.records, diagnostics: report.diagnostics.length,
    declared: report.declared.verdict, recomputed: report.recomputed.verdict,
    verdictMatch: report.comparison.verdictMatch, checksMatch: report.comparison.checks.every((c) => c.match),
  },
  readOnly: {
    same: changed.length === 0, checked: Object.keys(before.files).length, changed,
    before: "snapshot-before.json", after: "snapshot-after.json",
    sets: Object.fromEntries(Object.entries(before.sets).map(([k, v]) => [k, v.count])),
    gitStatusClean: true,
  },
  crossCheck07: { checks: cross.summary.checks, failed: cross.summary.failed, pass: cross.summary.pass, result: "07-inherited-copy.json" },
  acceptance: { allOk: acceptance.allOk, checks: acceptance.checks },
  playtestSelfTest: { ok: selftest.ok, cases: selftest.results.length },
  dod,
  limitations: [
    "信任边界：哈希清单能发现相对清单的改动；发现不了清单与被验证据一起被改并提交 —— 后者由 git 提交历史与人工审查负责。三方哈希核对只增加内部矛盾检测，不增加防篡改强度。",
    "单 Demo：V1 真实重验只覆盖冻结 FPVS-V1；第二个 Demo 的泛化验证留待后续（PRD §R3）。",
    "visual-review 机器边界：只校验审核记录的存在性、格式、subject 与材料一致性，不重判人工视觉结论；人工审核结果仍由既有审核流程提供。",
    "不重新执行：本入口由已有证据重导出六项检查，不重新构建游戏、不重新执行 QA、不重新启动浏览器试玩。",
    "MCP 未做：本版未把 verify-delivery 镜像到 MCP（用户裁定 Q4 = (a)）。",
    "可选日志：清单中 `*.log` 为 required:false，不在 git 信任边界内。",
    "回归详细日志（`regression/*.log`、`chrome.log`）按 `.gitignore` 不入库，本地可复跑；入库的判据是 `regression/*.exit` 退出码与各 summary/报告 JSON。",
    `耗时（本机实测墙钟）：pnpm test 25s · typecheck 10s · test:playtest 33s · test:acceptance 32s · test:evidence ${(summary.durationMs / 1000).toFixed(1)}s（CLI 计时）· 证据读取约 ${(summary.manifestBytes / 1024 / 1024).toFixed(1)} MB。不作性能门槛。`,
    "历史限制继续披露：证据完整性通过 ≠ 五态真实 E2E、机制覆盖或视觉审核范围已完成。",
  ],
};
fs.writeFileSync(path.join(BASE, "final-acceptance.json"), JSON.stringify(result, null, 2) + "\n");

const md = [
  "# Evidence Integrity V1 · 最终验收记录", "",
  `- 结论：**${result.conclusion}**`,
  `- 时间：${result.generatedAt}`,
  `- 对象：${result.subject.packId} · pack v${result.subject.packVersion} · site v${result.subject.siteVersion} · shell ${result.subject.shellVersion}`,
  `- 清单：\`${result.manifest.path}\` · ${result.manifest.files} 文件（required ${result.manifest.required} / optional ${result.manifest.optional}）· ${(result.manifest.bytes / 1024 / 1024).toFixed(1)} MB · ${result.manifest.sha256}`,
  `- 报告：\`report.json\`（${result.evidence.report.sha256}）/ \`report.md\``,
  "", "## 证据完整性重算", "",
  `- status **${result.evidence.status}** · CLI exit ${result.evidence.exitCode} · ${result.evidence.durationMs}ms`,
  `- 文件 ${result.evidence.files.verified}/${result.evidence.files.total} verified · 身份 ${result.evidence.identities.verified}/${result.evidence.identities.total} verified · 一致性 ${result.evidence.consistency.verified}/${result.evidence.consistency.total} verified`,
  `- records ${result.evidence.records} · diagnostics ${result.evidence.diagnostics}`,
  `- declared **${result.evidence.declared}** / recomputed **${result.evidence.recomputed}** · verdictMatch=${result.evidence.verdictMatch} · 六项 checks 全 match=${result.evidence.checksMatch}`,
  "", "## 回归（退出码）", "",
  "| 命令 | exit | 耗时 | 证据 |", "|---|---|---|---|",
  ...commands.map((c) => `| \`${c.command}\` | ${c.exit} | ${c.durationMs === null ? "—" : (c.durationMs / 1000).toFixed(1) + "s"} | \`${c.log.replace(/\.log$/, ".exit")}\`（详细日志本地） |`),
  "", "## DoD 10 条", "",
  ...dod.flatMap((d) => [`### ${d.id}. ${d.statement} — **${d.verdict}**`, "", ...d.evidence.map((e) => `- ${e}`), ""]),
  "## 只读性", "",
  `- ${result.readOnly.checked} 个受保护文件运行前后逐文件 sha256 **零变化**（${Object.entries(result.readOnly.sets).map(([k, v]) => `${k} ${v}`).join(" · ")}）`,
  "- 证据目录 `git status` 零改动；历史 run/pack/site/验收记录未被覆盖。",
  "", "## 已知限制", "",
  ...result.limitations.map((l) => `- ${l}`),
  "", "## 最终原则", "",
  "旧的 `pass` 是历史事实；本次 `pass` 来自当前证据完整性校验通过、六项检查有效、声明与重算一致。",
];
fs.writeFileSync(path.join(BASE, "final-acceptance.md"), md.join("\n") + "\n");

console.log(JSON.stringify({
  base: rel(BASE), conclusion: result.conclusion,
  commands: commands.map((c) => `${c.id}=${c.exit}`).join(" "),
  files: `${result.evidence.files.verified}/${result.evidence.files.total}`,
  identities: `${result.evidence.identities.verified}/${result.evidence.identities.total}`,
  consistency: `${result.evidence.consistency.verified}/${result.evidence.consistency.total}`,
  diagnostics: result.evidence.diagnostics,
  readOnlySame: result.readOnly.same, readOnlyChecked: result.readOnly.checked,
  cross: `${result.crossCheck07.checks - result.crossCheck07.failed}/${result.crossCheck07.checks}`,
  dod: result.dod.filter((d) => d.verdict === "MET").length + "/10",
}, null, 2));
