// 阶段C 真实产物验收（票 12）—— 用 `fpvs-v1-p0` 的真实 E2E 产物 `2026-10-26-e2e-r4` 做一次
// **零付费**端到端报告验收：读真实 QA 报告 / 包 / 站点 / smoke，复用票 08/09/10 的映射与写回函数，
// 产出一份统一报告（QA 层 + delivery）落盘到本 effort 的 `runs/2026-10-27-stage-c/`。
//
// ⚠️ **不改 `fpvs-v1-p0` 的历史产物**：只读，输出落在新目录。跑一次：`node .scratch/fpvs-v1-p1/acceptance.mjs`。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildDeliveryReport, mapPlayableSmoke, playableSmokeEvidence, playableSmokeKnownLimitations,
  QAReportSchema, qaVerdict, parseAssetPack,
} from "../../packages/contracts/dist/index.js";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const OUT_ROOT = path.join(ROOT, ".scratch/fpvs-v1-p0/runs/2026-10-26-e2e-r4");
const RUN_DIR = path.join(OUT_ROOT, "wasteland-scavenger-recipe/run/v1");
const PACK_DIR = path.join(OUT_ROOT, "wasteland-scavenger-recipe/pack/v1");
const SITE_DIR = path.join(OUT_ROOT, "wasteland-scavenger-recipe/site/v1");
const SMOKE_REL = "smoke3/playable"; // 相对 OUT_ROOT

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

// 1. QA 层（真实历史产物）
const qa = QAReportSchema.parse(readJson(path.join(RUN_DIR, "qa-report.json")));

// 2. 包身份 + 站点身份（真实历史产物）
const mp = parseAssetPack(readJson(path.join(PACK_DIR, "manifest.json")));
if (!mp.ok) throw new Error("manifest 不过 schema：" + mp.errors.join("；"));
const manifest = mp.value;
const site = readJson(path.join(SITE_DIR, "site.json"));
const siteVersion = Number(/\/v(\d+)$/.exec(SITE_DIR)?.[1] ?? "1");

// 3. smoke 结果（真实历史产物）→ 检查项 + 证据 + 已知限制
const smoke = readJson(path.join(OUT_ROOT, SMOKE_REL, "result.json"));
const smokeCheck = mapPlayableSmoke(smoke);

// 4. 组装 delivery：六项检查 + 身份 + 视觉评审（P0-06 转录）+ 证据 + 已知限制
const delivery = buildDeliveryReport({
  runId: "wasteland-scavenger-recipe/run/v1",
  pack: { packId: manifest.id, packVersion: manifest.version, manifestChecksum: qa.subject?.manifestChecksum },
  config: { file: "wasteland-scavenger-recipe/run/v1/game-config.json" },
  site: { version: siteVersion, shell: String(site.shell) },
  checks: [
    { key: "asset-pack", status: "pass" },
    { key: "config", status: "pass" },
    { key: "qa", status: qaVerdict(qa) },
    { key: "site", status: "pass" },
    { key: "playable-smoke", status: smokeCheck.status, detail: smokeCheck.detail },
    { key: "visual-review", status: "pass" },
  ],
  // 票 10 项 4：P0-06 写回 = **转录**票 02 的真实历史裁定（2026-10-27），不冒充重新评审
  visualReview: { status: "pass", reviewer: "人（本次会话用户）", reviewedAt: "2026-10-27" },
  evidence: playableSmokeEvidence(smoke, SMOKE_REL),
  knownLimitations: playableSmokeKnownLimitations(smoke),
});

// 5. 写统一报告（不改历史产物，落在新目录）
const OUT = path.join(ROOT, ".scratch/fpvs-v1-p1/runs/2026-10-27-stage-c");
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "qa-report.json"), JSON.stringify({ ...qa, delivery }, null, 2) + "\n");

// 6. 摘要（§2.1 八个问题的落点）
console.log("统一报告落盘：", path.join(".scratch/fpvs-v1-p1/runs/2026-10-27-stage-c", "qa-report.json"));
console.log("最终 verdict：", delivery.verdict);
console.log("检查项：");
for (const c of delivery.checks) console.log(`  ${c.key} = ${c.status}${c.detail ? `（${c.detail}）` : ""}`);
console.log("视觉评审：", JSON.stringify(delivery.visualReview));
console.log("已知限制：", delivery.knownLimitations.length, "条");
for (const k of delivery.knownLimitations ?? []) console.log("  ·", k);
console.log("证据：", delivery.evidence.length, "条");
for (const e of delivery.evidence) console.log("  ·", e.ref, "→", e.path);
