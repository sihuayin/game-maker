# Phase 0 只读审计 — Evidence Integrity V1

> 票：[Phase 0 只读审计：记录 schema、证据依赖图与差距清单](../issues/02-phase0-readonly-audit.md)
> 日期：2026-10-29 · 方式：**只读**源码与证据文件；未构建、未启动浏览器、未调用付费模型、未写入任何证据目录。

## 0. 摘要（结论先行）

1. **正式交付路径不重算任何证据哈希。** `QAReportSchema` / `DeliveryReportSchema` 只做结构自洽
   （`packages/contracts/src/delivery.ts:172-257`），`delivery.evidence` 只有 `{ref, path}`；
   `publish-gate` 只比较 `subject` 的 pack id/version/checksum，不读证据字节。
2. **唯一在做证据核验的是 effort 脚本** `.scratch/generic-playtest-v1/scripts/07-verify-inherited.mjs`（27 项）。
3. **「重算最终结论」目前只重算到 declared 六项状态**：07 用 `deriveDeliveryVerdict` 重算 verdict，
   但六项状态来自 `delivery.checks` 的声明值，**没有从证据重新导出**（PRD EI-05 的真实缺口）。
4. 现有 `.scratch/fpvs-v1-final/artifacts/hashes.json` 是清单的**前身**但不是合格信任锚：
   80 条 = 66 snapshot + 14 reference；**work 树没有逐条列出**（只在冻结时与 snapshot 比过），
   而冻结后 work 已从 66 增长到 95 个文件（playtest v1/v2 写入）。
5. 记录 schema 基本支持 Q12 身份契约，但有字段命名与覆盖差异（见 §5、§9）：playtest 用 `packChecksum`、
   qa-report `subject` 无 site/shell/config、consistency 无 pack 身份、`*.log` 不入库。
6. 证据文件基本入库（fpvs-v1-final 511/530、generic-playtest-v1 202/535；差集是 `*.log` 与 `self-test-run/out/`），
   **git 提交可作为非日志证据的信任锚**。
7. 最小改动可落在 `packages/pipeline` + CLI：依赖图允许（pipeline → contracts/assets/qa；cli → pipeline），
   不需要新增 contracts 字段或第七个交付检查项。

## 1. 审计范围与方法

只读命令与文件：

- `packages/contracts/src/delivery.ts`、`qa.ts`、`playtest.ts`、`command.ts`、`run-ledger.ts`
- `packages/pipeline/src/{delivery,playtest,publish-gate,artifacts,index}.ts`
- `packages/assets/src/{ops,acceptance}.ts`（`verifyPack`、`writeAcceptanceReport`、`allocateReportDir`）
- `packages/cli/src/{cli,playtest}.ts`、`packages/mcp/src/server.ts`
- `packages/demo/probe/free-acceptance.mjs`
- `.scratch/generic-playtest-v1/scripts/07-verify-inherited.mjs`
- `.scratch/fpvs-v1-final/{freeze.mjs,artifacts/identity.json,artifacts/hashes.json}`
- FA-04 `review-record.json` / `capture.json` / `materials.json`
- FA-05 `evidence.json` / `consistency.json` / `qa-report.json#delivery`
- FA-06 `regression.json`
- 06 `attempt-{1,2}/attempt-v1/{result,site-integrity,strategy}.json`
- 09 `09-review-record.supplement.json` / `09-review-materials.json`
- `git ls-files` / `git status --ignored` 对两个 effort 目录做入库核对

## 2. 正式验收路径现状

### 2.1 `delivery` 的结构自洽（已有）

`DeliveryReportSchema.superRefine`（`packages/contracts/src/delivery.ts:172-257`）检查：

- `checks` 不重复；六个必需 key 全部出现；必需项不得 `not-required`；
- `verdict === deriveDeliveryVerdict(必需项)`；
- `site` 字段与 `site` 检查项一致；
- `playtest` 在场时：`mapPlaytest` 与 `playable-smoke` 一致、证据 ref 可解析、
  `playtest.report` 与 `playtest-result` 路径一致、pass 要求所有必需场景 executed+SUCCESS。

⚠️ 这些都是**报告内部**的自洽，不读磁盘上的证据文件，不重算哈希，不验证证据身份。

### 2.2 发布闸（只绑 pack）

`packages/pipeline/src/publish-gate.ts` 的 `subjectProblem` 只比较报告 `subject` 与当前包的
id/version/`manifestChecksum`；不校验 config 身份、不校验证据文件。注释明确「不在这里跑 `verifyPack`」。

### 2.3 CLI / MCP

- `accept` 是**资源结构验收**（`packages/assets/src/acceptance.ts`，动画/图集），与交付证据无关。
- `playtest` / `review-verdict` 写回 `delivery.playtest` / `delivery.visualReview`，不重算历史证据。
- `pnpm test:acceptance` = `free-acceptance.mjs`：意图→机制覆盖闭环（vitest + mechanic-probe），与证据完整性无关。

### 2.4 结论

正式路径回答的是「报告写得自洽吗」；PRD 要的是「报告所引用的当前证据还在、没变、属于这份交付吗」。
后者今天只由 07 脚本回答。

## 3. `07-verify-inherited.mjs` 的 27 项检查

| # | check id | 对象 | 期望 |
|---|---|---|---|
| 1 | `identity.delivery.pack` | qa-report.delivery.pack ↔ identity.json | packId / packVersion 相等 |
| 2 | `identity.delivery.manifest` | delivery.pack.manifestChecksum ↔ identity.manifestFileSha256 | 相等 |
| 3 | `identity.delivery.site-shell` | delivery.site ↔ 身份 | siteVersion=1、shell="2" |
| 4 | `identity.delivery.config` | delivery.config.file ↔ identity.siteConfigSha256 | 路径尾部匹配、配置哈希相等 |
| 5 | `identity.manifest-file` | `pack/v1/manifest.json` 实际字节 | 等于 identity.manifestFileSha256 |
| 6 | `identity.site-config-file` | `site/v1/game-config.json` 实际字节 | 等于 identity.siteConfigSha256 |
| 7 | `inherit.review-record.subject` | FA-04 review-record.subject ↔ delivery/identity | 六字段全等 |
| 8 | `inherit.capture.subject` | capture.subject | 同上 |
| 9 | `inherit.materials.subject` | materials.subject | 同上 |
| 10 | `inherit.review-record.overall` | review-record | overall=pass、六项逐项 pass |
| 11 | `inherit.materials.hashes` | materials 44 条（17 材料 + 27 generated） | 工作区哈希 + snapshot 哈希 + frozen 语义 |
| 12 | `inherit.capture.shots` | 9 张截图 | 全部可哈希、8 个不同字节 |
| 13 | `inherit.capture.site-integrity` | capture.siteIntegrity | unchanged、before=after |
| 14 | `inherit.capture.site-files` | site 四文件实际字节 | 等于 capture.siteIntegrity.before |
| 15 | `inherit.fa05.evidence` | evidence.json.files（36） | 逐文件哈希相等 |
| 16 | `inherit.fa05.consistency` | consistency.checks（12） | 12/12 pass |
| 17 | `inherit.fa05.report-hash` | qa-report 实际字节 | 等于 consistency.subject.reportSha256 |
| 18 | `delivery.verdict` | delivery.checks | 六项齐全、`deriveDeliveryVerdict` = declared = pass |
| 19 | `delivery.visual+playtest` | delivery.visualReview / delivery.playtest | pass / SUCCESS |
| 20 | `inherit.fa06.regression` | regression.commands（4） | 全部 exitCode=0 |
| 21 | `round06.attempts` | 两份 attempt | 身份、成功终态、无 stop、site 未变 |
| 22 | `round06.projection` | 两份 attempt 的 `playtestProjectionOf` | 投影一致 |
| 23 | `snapshot.50-files` | snapshot pack+site（46+4） | 当前 = before/after-1/after-2 |
| 24 | `supplement.subject` | 09 supplement.subject | 六字段全等 |
| 25 | `supplement.items` | 09 supplement | overall=pass、4 项 pass、problems=[] |
| 26 | `supplement.fa04-unmodified` | FA-04 三份记录 | 等于 supplement.constraints.historicalRecordHashes |
| 27 | `supplement.scope` | 09 约束 | 8 帧非 9、非七项全审、历史未改 |

覆盖缺口（新校验器要补）：路径逃逸 / 符号链接、不可读、`reference-invalid` 的引用图、
**六项状态从证据重导出**、声明与重算 verdict 的显式并列、清单本身作为输入契约。

## 4. 证据依赖图

```
qa-report.json#delivery
├─ pack          ← pack/v1/manifest.json（manifestChecksum）+ manifest.files[] 的逐文件 checksum
├─ site          ← site/v1/site.json → {shell:"2", pack:"v1", config:"game-config.json"}
├─ config.file   ← <outRoot>/wasteland-scavenger-recipe/run/v1/game-config.json
│                   （实际 outRoot = .scratch/fpvs-v1-final/work；site/v1/game-config.json 同字节）
├─ playable-smoke← run/v1/playtest/v2/result.json（harness/rules v1）
│                 + site-integrity.json + 5 个 scenario 证据文件
├─ visual-review ← FA-04 review-record.json / materials.json / capture.json
│                 ├─ 44 材料（2 reference + 11 delivered + 4 visual + 27 generated）
│                 ├─ 9 截图（8 个不同字节；08-goal = 09-final）
│                 └─ FA-09 supplement.json + 09-review-materials.json（4 项补审）
└─ evidence[]    → 36 个文件（含 qa-report 原件 + 副本、identity.json、hashes.json、
                     playtest v2、FA-04/05/06 目录、09 补审）

artifacts/identity.json
├─ snapshot（66 文件，只读）· work（冻结时 66，现 95）· reference（14，只读）
├─ manifestChecksumFromReport = manifestFileSha256
├─ runConfigSha256 = siteConfigSha256
└─ verification.{snapshotVsSource, workVsSnapshot, sourceStable, snapshotReadOnly, referenceReadOnly}

artifacts/hashes.json（80 条：66 snapshot + 14 reference；work 只计数未列）
FA-05 evidence.json（36）→ consistency.json（12 checks）→ verdict pass
FA-06 regression.json（4 命令）
06 attempt-1/2（各 14 文件：result + site-integrity + strategy + 6 scenario + 3 harness + exit/summary/rejections/determinism）
07-inherited-verification.json（27）→ 07-final-verdict.json（pass）
```

## 5. 记录 schema × 身份字段矩阵（对照 Q12）

**期望身份（清单 `subject`）**：`packId`、`packVersion`、`siteVersion`、`shellVersion`、
`manifestChecksum`、`configChecksum`。

| 记录 | format | packId | packVersion | siteVersion | shellVersion | manifestChecksum 等价字段 | configChecksum 等价字段 | 备注 |
|---|---|---|---|---|---|---|---|---|
| qa-report.delivery | `qa-report/v1` | `pack.packId` | `pack.packVersion` | `site.version` | `site.shell` | `pack.manifestChecksum` | **无**（由 `config.file` 实际哈希导出） | 身份以 delivery 为准 |
| qa-report.subject | 同上 | ✓ | ✓ | — | — | `manifestChecksum` | — | 可选；不含 site/config |
| playtest result（work v2） | `playtest-report/v1` | ✓ | ✓ | ✓ | ✓（字符串） | `packChecksum` | `configChecksum` | harness/rules **v1** |
| playtest result（06 attempt-1/2） | `playtest-report/v1` | ✓ | ✓ | ✓ | ✓ | `packChecksum` | `configChecksum` | harness/rules **v2** |
| FA-04 review-record | `fpvs-visual-review-record/v1` | ✓ | ✓ | ✓ | ✓ | `manifestChecksum` | `configChecksum` | 另有 snapshot/work 路径 |
| FA-04 capture | `fpvs-visual-review-capture/v1` | ✓ | ✓ | ✓ | ✓ | `manifestChecksum` | `configChecksum` | `reviewedAt: null` |
| FA-04 materials | `fpvs-visual-review-materials/v1` | ✓ | ✓ | ✓ | ✓ | `manifestChecksum` | `configChecksum` | `siteJson` |
| FA-05 evidence | `fpvs-final-acceptance-evidence/v1` | ✓ | ✓ | ✓ | ✓ | `manifestChecksum` | `configChecksum` | 36 文件自述哈希 |
| FA-05 consistency | `fpvs-final-acceptance-consistency/v1` | — | — | — | — | — | — | 只有 `subject.reportSha256` |
| FA-06 regression | `fpvs-regression-closure-results/v1` | — | — | — | — | — | — | 无身份，只有命令/退出码 |
| FA-09 supplement | `fpvs-visual-review-supplement/v1` | ✓ | ✓ | ✓ | ✓ | `manifestChecksum` + `siteHashes.manifest` | `configChecksum` + `siteHashes.config` | 历史记录哈希 |
| FA-09 materials | `fpvs-visual-review-supplement-materials/v1` | ✓ | ✓ | ✓ | ✓ | `manifestChecksum` + `siteHashes.manifest` | `configChecksum` + `siteHashes.config` | `siteDir`/`snapshot` |
| identity.json | `fpvs-final-identity/v1` | ✓ | ✓ | ✓ | ✓ | `manifestChecksumFromReport` + `manifestFileSha256` | `siteConfigSha256` / `runConfigSha256` | 身份源之一 |

**字段映射（Q12 实施时必须固定）**：

- `manifestChecksum` ↔ `packChecksum`（playtest）/ `manifestChecksum`（其余）/ `siteHashes.manifest`（09）。
- `configChecksum` ↔ `configChecksum` / `siteHashes.config`（09）/ `siteConfigSha256`（identity.json）。
- `shellVersion` 在所有记录里都是**字符串**；`delivery.site.shell` 也是字符串 `"2"`。
- 缺失 = `blocked`，不符 = `fail`；`consistency.json` 与 `regression.json` 不在 Q12 的「必需身份」名单里，
  它们由文件哈希 + 内容一致性校验（不要把「无身份」误判为缺失）。

## 6. 哈希来源与信任边界

### 6.1 现有 `hashes.json`（前身，不是合格信任锚）

- 由 `.scratch/fpvs-v1-final/freeze.mjs` 在冻结时生成（第 178-190 行）。
- `entries` 只含 **snapshot 66 + reference 14 = 80 条**；`counts.workFiles = 66` 只用于
  `workVsSnapshot` 的内存比较，**work 没有逐条入清单**。
- 冻结后 work 已增长到 **95** 个文件（playtest v1/v2、rejections）；work 与 snapshot 不再逐字节同构。
- 因此新清单必须**显式声明 work 文件**，不能从 snapshot 推导。

### 6.2 证据自述哈希（三方核对的第二、三方）

- `identity.json`：manifest / runConfig / siteConfig 哈希。
- `evidence.json.files[]`：36 条 `{path, bytes, sha256}`。
- `materials.json`：44 条 `{path, sha256, frozen, snapshotSha256?}`。
- `supplement.constraints.historicalRecordHashes`：FA-04 三份记录哈希。
- `capture.siteIntegrity.before/after`：site 四文件哈希。
- `consistency.subject.reportSha256`：qa-report 原件哈希。
- `playtest/v2/site-integrity.json` 与 06 attempt 的 `site-integrity.json`：site 四文件前后哈希。

### 6.3 git 入库事实

- `.scratch` 整体入库；fpvs-v1-final 511/530 跟踪，generic-playtest-v1 202/535 跟踪。
- 未跟踪差集 = `*.log`（`.gitignore` 的 `*.log`）与 `self-test-run/out/`。
- 结论：**非日志证据可由 git 提交锚定**；`chrome.log` 等日志不能入清单为必需项（或只能 `required:false`，
  并声明它不在信任边界内）。
- 现有 `hashes.json` 自身也被 `evidence.json` 记录哈希 —— 存在自指；新清单必须独立于被验证据、单独入 git。

### 6.4 信任边界（报告必须写明）

清单能发现「相对清单的改动」；发现不了「清单与被验证据一起被改并提交」。
后者由 git 提交历史与人工审查负责。三方核对只增加内部矛盾检测，不增加防篡改强度。

## 7. 差距清单（PRD EI / AC）

| 需求 | 现状 | 差距 | 承接票 |
|---|---|---|---|
| EI-01 正式证据清单 | 无；`hashes.json` 只覆盖 snapshot/reference | 需要输入契约清单（roots/subject/files/records） | 03 / 04 |
| EI-02 重算哈希 | 07 脚本做部分；产品路径不做 | 需要 `verified/missing/unreadable/hash-mismatch/path-invalid/reference-invalid` 分类 + 路径安全 | 04 |
| EI-03 交付身份 | 07 有身份检查；delivery schema 只做 pack | 需要通用身份矩阵 + 字段映射 | 04 |
| EI-04 记录一致性 | schema superRefine + 07 + consistency.json | 需要三方哈希、引用图、qa↔delivery↔playtest↔审核一致 | 04 |
| EI-05 重算结论 | `deriveDeliveryVerdict` 存在；07 只重算 verdict 不重算六项 | 需要从证据重导出六项 + declared/recomputed 并列 | 04 |
| EI-06 正式入口 | 无 | CLI `verify-delivery` + `pnpm test:evidence` | 05 |
| EI-07 只读 | 07 只写自己的输出 | 需要机械化的 `--out` 越界拒绝 + 运行前后哈希证明 | 04 / 06 / 07 |
| AC-01 基线通过 | 07 27/27 pass | 新校验器需独立复现并交叉解释 | 07 |
| AC-02–06 负向 | 无 | `mkdtemp` fixture + 七类失败 + 路径五类 | 06 |
| AC-07 历史不改 | 07 脚本不写证据 | 运行前后快照比对 | 06 / 07 |
| AC-08 回归 | 既有四个命令 | 新增 `test:evidence`；五个命令全绿 | 08 |

## 8. 最小改动方案

### 8.1 模块（`packages/pipeline`）

建议新增 `packages/pipeline/src/evidence-integrity.ts`（必要时拆 `evidence-integrity/` 子目录）：

- `EvidenceManifestSchema`（本地 zod，`delivery-verification/v1` 输入）。
- `resolveRoots` / `resolveEvidencePath`：双端 `realpath` + 规范化组件包含性；悬空/越界拒绝。
- `verifyFile`：`verified | missing | unreadable | hash-mismatch | path-invalid`。
- `verifyIdentity`：Q12 矩阵 + 字段映射（`packChecksum` ↔ `manifestChecksum` 等）。
- `verifyConsistency`：三方哈希、引用解析、qa↔delivery↔playtest↔审核一致性。
- `recomputeDeliveryChecks`：六项重导出（Q13 表）。
- `verifyEvidence(manifestPath, opts)`：汇总 + 状态映射（Q7）+ `deriveDeliveryVerdict`。
- `DeliveryVerificationReportSchema` + `renderMarkdown` + `writeVerificationReport`（原子分配目录）。

复用：`verifyPack`（`assets`，但注意它会抛错 —— 包一层结构化结果）、`qaVerdict`、
`playtestSummaryOf` / `mapPlaytest`、`deriveDeliveryVerdict`、`manifestChecksumOf`。
**不新增 contracts 字段**；记录解析器（FA-04/05/06/09）放在本模块内，不升为对外契约。

### 8.2 CLI

- `packages/cli/src/evidence.ts`：解析 `--manifest` / `--out`，调用 pipeline，渲染 `CommandResult`。
- `packages/cli/src/cli.ts`：`case "verify-delivery"` + `USAGE` + 退出码映射。
- 依赖方向：`cli → pipeline` 已允许；`pipeline → assets/qa/contracts` 已允许（`scripts/check-deps.mjs`）。

### 8.3 `pnpm test:evidence`

建议新增一个 probe 脚本（`packages/demo/probe/evidence-acceptance.mjs` 或 `scripts/`），职责：
build → 用固定清单跑 `verify-delivery` → 校验退出码 / 报告结构 / 重算结论 → 保留报告。
`package.json` 只加这一条脚本；不并入 `pnpm test` / `test:acceptance`。
真实耗时与读取规模在票 05 量。

### 8.4 测试

- `packages/pipeline/tests/evidence-integrity.test.ts`：纯函数 + `mkdtemp` 负向 fixture。
- `packages/cli/tests/cli.test.ts`：参数、退出码、`--out` 越界。
- 基线重验：票 07 的运行证据，不进单测。

### 8.5 报告目录

沿用 `allocateReportDir` 的 `mkdirSync` + EEXIST 分配语义（`packages/assets/src/acceptance.ts:759-772`）。
该函数当前未导出；最小做法是在 pipeline 内实现同语义的小函数并加测试，避免为复用而扩 assets 的公开面。

## 9. 清单冻结前必须裁定的差异（D1–D12）

| # | 事实 | 影响 | 建议 |
|---|---|---|---|
| D1 | work 的 `playtest/v2/result.json` 是 harness/rules **v1**；06 两份 attempt 是 **v2**；06 未写回 delivery | `playable-smoke` 从哪份报告重导出？ | 以 `delivery.playtest.report` 指向的报告重导出（与声明一致），06 两份作为**额外必需证据**核对身份/结果；报告里并列说明 harness 版本差异 |
| D2 | `qa-report.subject` 无 site/shell/config | 不能只靠 qa-report 验身份 | 身份期望来自清单 `subject`；qa-report 只提供 pack 三项 |
| D3 | playtest 用 `packChecksum`，其余用 `manifestChecksum`；09 用 `siteHashes.*` | 直接字符串比较会全错 | 在 `verifyIdentity` 内做固定字段映射表 |
| D4 | `delivery.config.file` = `wasteland-scavenger-recipe/run/v1/game-config.json`（相对 outRoot），实际文件在 `.scratch/fpvs-v1-final/work/` 下 | 路径解析需先映射 outRoot | 清单 `roots.out = .scratch/fpvs-v1-final/work`；所有 delivery 相对路径按它解析 |
| D5 | `hashes.json` 不列 work，且 work 已从 66 增至 95 | 不能复用 hashes.json 当清单 | 新清单显式列 work 当前文件（含 playtest v1/v2、rejections） |
| D6 | reference 14 文件（FA-02 playtest-v1 + prior delivery）是历史材料 | 是否必需？ | `required:false`（记录性），除非 PRD 要求把它们当当前证据 |
| D7 | 9 张截图只有 8 个不同字节（08-goal = 09-final） | 「9 张 / 8 distinct」的一致性规则 | 9 个文件都可哈希；去重结果单独作为一致性项 |
| D8 | `evidence.json` 同时登记 qa-report 原件与副本；自身也被清单引用 | 三方核对的自指风险 | 两者都作为普通文件条目；报告注明证据集包含副本，不把它当独立信任源 |
| D9 | `capture.reviewedAt` 为 null；review-record 有 reviewedAt | 不能把 reviewedAt 当必需身份 | 只在存在时记录，不作必需项 |
| D10 | `consistency.json` 无 pack 身份，只有 `subject.reportSha256` | Q12 名单不含它 | 按文件哈希 + reportSha256 校验，不要求身份 |
| D11 | qa-report `failures` 有 2 条（warning），`qaVerdict` 仍 pass | 重算 qa 时需沿用 `qaVerdict`，不能自创规则 | 直接调用 `qaVerdict(report)` |
| D12 | `*.log` 被 gitignore；36 条 evidence 不含 log，但目录里有 chrome.log | 未入库文件不能作为必需证据的信任锚 | 清单不列 `*.log`；若列，只 `required:false` 并声明不在信任边界内 |

## 10. Phase 0 六问逐条回答

1. **07 实际检查了什么、来源在哪？** 见 §3 的 27 行表；来源是 §4 依赖图里的记录与文件。
2. **正式验收读哪些文件/报告/哈希？** 读 `qa-report.json`（含 `delivery`）、pack `manifest.json`
   （publish gate 的 id/version/checksum）、站点四文件、config；**不读证据文件哈希**。
3. **最终结论计算入口与优先级？** `deriveDeliveryVerdict`（`packages/contracts/src/delivery.ts:47-60`），
   `fail > blocked > incomplete > pass`；`DeliveryReportSchema.superRefine` 在写前保证 `verdict` 与 checks 一致；
   `deliveryVerdictOf` 是 checks → verdict 的唯一折法。
4. **路径解析与原子写入约定？** `path.resolve` + `path.relative` 前缀检查（`packages/cli/src/playtest.ts:47-51`，
   仅此一处，且是字符串判断）；原子写：`writeJsonAtomic`（tmp + rename，`pipeline/src/delivery.ts`）、
   `allocateReportDir`（`mkdirSync` + EEXIST，`assets/src/acceptance.ts:759-772`）。
5. **纯函数 / contracts / CLI / QA 边界？** contracts 只放 schema 与纯函数（`deriveDeliveryVerdict`、`qaVerdict`、
   `mapPlaytest`、`playtestSummaryOf`）；pipeline 做 I/O 与编排；assets 做包校验；qa 做 QA 合成；
   CLI/MCP 是薄壳。新校验器应落在 pipeline，纯判断可留在本模块，不升 contracts。
6. **哈希清单怎么生成、可信来源？** 现状由 `freeze.mjs` 生成 `hashes.json`（80 条，snapshot+reference），
   可信来源是 effort 流程 + git；work 未列入。新清单由票 03 从当前冻结基线重新生成、人工审查、随 git 提交固定，
   校验器只读。

## 附录：关键文件与行号

- `packages/contracts/src/delivery.ts:47-60` `deriveDeliveryVerdict`
- `packages/contracts/src/delivery.ts:172-257` `DeliveryReportSchema.superRefine`
- `packages/contracts/src/qa.ts:405-409` `qaVerdict`
- `packages/contracts/src/playtest.ts:178-192` `PlaytestIdentitySchema`
- `packages/contracts/src/playtest.ts:518-...` `mapPlaytest`
- `packages/contracts/src/playtest.ts:546-...` `playtestSummaryOf`
- `packages/contracts/src/command.ts` `EXIT = { ok:0, failure:1, usage:2, upstream:3, invalid:4 }`
- `packages/assets/src/ops.ts:1836-1898` `verifyPack`
- `packages/assets/src/acceptance.ts:759-772` `allocateReportDir`
- `packages/pipeline/src/delivery.ts` `writeDeliveryToReport` / `writeVisualReviewToReport` / `deliverySummaryOf`
- `packages/pipeline/src/publish-gate.ts` `subjectProblem`
- `packages/cli/src/playtest.ts:47-51` `requireUnder`
- `scripts/check-deps.mjs` 允许图
- `.scratch/fpvs-v1-final/freeze.mjs:178-190` `hashes.json` 生成
- `.scratch/generic-playtest-v1/scripts/07-verify-inherited.mjs` 27 项检查
