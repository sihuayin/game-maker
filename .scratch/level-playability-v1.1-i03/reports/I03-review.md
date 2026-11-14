# I03-10 授权包独立审查报告

| 项 | 值 |
| --- | --- |
| 票 | I03-10 授权包独立审查 |
| 日期 | 2026-11-14 |
| 审查人 | claude（I03-10 session；`/clear` 后的独立会话，未参与 I03-00～I03-09 的撰写、组装或签署） |
| 分支 / HEAD | `wayfinder/level-playability-v1.1-i03` @ `69a336e3705ccaaef44df7ddde1a99a372156f9c` |
| Base | `wayfinder/level-playability-v1.1-i02` @ `2b57f2afdc09c50cb423663fb16914e2e98e7f8d` |
| 环境 | Darwin 24.6.0 arm64 · Node v22.23.2 · pnpm 10.7.1 |
| 审查对象 | `docs/v7.8/移动-I03.md` · `sha256:2f89d572008b538be5871fef11d9f539e16829d1f4ceafe6e25a8a250fb9a52e`（F2 修正后） |
| 审查输入包 | `.scratch/level-playability-v1.1-i03/reports/09-review-input-package.md` · `sha256:1227d1f3c78dda382cd4f6c6560740f512ac3fc4a131a33a35b436da5fda7abd`（F2 修正后） |
| 组装证据 | `.scratch/level-playability-v1.1-i03/evidence/09-package.md` · `sha256:c0948b9f7dc0bc09fcee7a7128de70381d1c3df67938314177c2f7ba3d8cf6a5`（含 F2 修正注记） |
| F2 修正证据 | `.scratch/level-playability-v1.1-i03/evidence/10-f2-correction.md` · `sha256:17ea5f9137b9dbf3dbf7ab715fc26e598c0ee419ff94794a9b974584086a8c2a` |
| 上游授权包 | `docs/v7.8/移动-I02.md` · `sha256:797cd6fc7b299e22b6e90b9ef8a9567376ea3a914d70f8b6f1fc0f9a6ecedc56`（未修改） |
| 结论 | **PASS（23/23 检查项）**；0 项会改变冻结语义 / 能力状态 / 实施授权边界的阻断性缺陷；6 项发现（F1–F6），**F2 / F6 已按用户裁定修正**，F1 / F3 / F4 / F5 为非阻断文字 / 流程问题 |

> **本报告只判断授权包是否适合交付用户签署。** 它不授权 I-03 实施、不授权 U1–U5、
> 不设置 `coverage.geometry`、不开放 `PUBLIC_NB` / `PUBLIC_PU`。
> `PUBLIC_NB` / `PUBLIC_PU` 仍 `BLOCKED`；I-03 实施仍 `NOT_AUTHORIZED`。

## 1. 独立性与方法

- 本会话在 `/clear` 之后启动，未参与授权包、审查输入包、决策票或组装证据的撰写。
- 只依据授权包、审查输入包、I-02 / U5 冻结材料、决策票 Answer 与源码事实工作；
  地图的 `Decisions so far` 只用于定位，未作为 PASS 依据。
- 对每个检查项重新读取原文、数行、复算 hash、重跑命令；作者摘要与审查输入包的
  自述不作为通过依据。
- 未修改授权包、I-02 原文、产品代码、测试或冻结证据。LP-06/07 复跑产生的两个
  tracked 证据文件在比较后已 `git checkout --` 复原；`git status` 仅剩本票的
  `Status: claimed` 变更。

## 2. 输入 / 输出 hash 与冻结完整性

| 检查 | 命令 / 方法 | 结果 |
| --- | --- | --- |
| 授权包 hash | `shasum -a 256 docs/v7.8/移动-I03.md` | `2f89d572…`（F2 修正后）；I03-09 组装时 `0edf5005…` |
| 审查输入包 hash | `shasum -a 256 …/09-review-input-package.md` | `1227d1f3…`（F2 修正后） |
| 组装证据 hash | `shasum -a 256 …/evidence/09-package.md` | `c0948b9f…`（含 F2 修正注记；I03-09 原 `0c92bf2e…`） |
| F2 修正证据 hash | `shasum -a 256 …/evidence/10-f2-correction.md` | `17ea5f91…` |
| I-02 授权包 hash | `shasum -a 256 docs/v7.8/移动-I02.md` | `797cd6fc…`，与已签署 hash 一致 |
| 产品树零 diff | `git diff --stat 2b57f2a -- packages fixtures` | 空 |
| 远端分支 | `git branch -r \| grep i03` | 无 `origin/…i03`；未推送 |
| 包状态 | 包首 / §12.1 / §17 | `ASSEMBLED / PENDING INDEPENDENT REVIEW / UNSIGNED`；`PUBLIC_NB` / `PUBLIC_PU` `BLOCKED`；I-03 实施 `NOT_AUTHORIZED` |

## 3. 复跑命令与退出码

| 命令 | 退出码 | 结果 / 说明 |
| --- | ---: | --- |
| `pnpm test` | **0** | 176 test files / 2877 tests 全部通过；vitest 另报 2 条 `[vitest-worker]: Timeout calling "onTaskUpdate"` unhandled error（runner 级警告，非测试失败；两次复跑均出现，属本机环境噪声） |
| `pnpm build` | **0** | `tsc -b` + bundle 全部完成 |
| `pnpm check:deps` | **0** | 依赖图合法（10 个包） |
| `pnpm check:links` | **0** | 相对链接零断裂（1233 份文档 · 4132 条链接） |
| `node .scratch/level-playability-v1-p1/acceptance-corpus.mjs`（LP-06） | **0** | 与冻结 evidence 语义一致（排除 `generatedAt`）；`uniqueConfigs=20`、`uniquePairs=96`、`usableConfigs=150` |
| `node .scratch/level-playability-v1-p1/acceptance-matrix.mjs`（LP-07） | **0** | 与冻结 evidence 语义一致（排除 `generatedAt`）；`cases=39`、`finalDistribution={IE:11, PU:19, NB:9}`，冻结输出中的 9 条 `expectedMismatch` 与复跑逐项一致 |

> LP-06/07 的原始 JSON 因 `generatedAt: new Date().toISOString()` 逐次不同，不能按整文件 SHA 比较；
> 本报告按“去掉 `generatedAt` 后 JSON 深度相等”比较，两个文件均为 `True`。
> 复跑后已将 `06-corpus-regression.json` / `06-matrix-acceptance.json` 复原到冻结版本。

## 4. 逐项审查（R01–R23）

| # | 检查项（对应审查输入包） | 结果 | 证据 / 说明 |
| --- | --- | --- | --- |
| R01 | 六条冻结边界逐条存在且未被削弱（2.1.1） | **PASS** | 包 §1.1 六条与地图六条逐字对应；无削弱 / 例外句 |
| R02 | 前沿裁定 Q1=A / Q2=分阶段 / Q3=最小面 / Q4=A 已体现（2.1.2） | **PASS** | §2.3 索引；§0.3（Q3）；§1.3（Q2）；§7.4（Q4）；§0.2 / §17（Q1：实施另开 effort） |
| R03 | `PUBLIC_NB` / `PUBLIC_PU` 仍 `BLOCKED`；I-03 实施 `NOT_AUTHORIZED`（2.1.3） | **PASS** | §12.1 / §17.2；源码 `publicCapability:"BLOCKED"` / `publicResult:null`（`temporal-result.ts:44-45`、`temporal.ts:380-381`） |
| R04 | 包中不出现越权表述（2.1.4） | **PASS** | 全文搜索 `已实施 / 已开放 / 已授权 U1–U5`：仅否定句或未来条件句；§17.2 明确“不表示 I-03 已实施” |
| R05 | NB 三阶段 + §8.2 十项准入条件完整（2.2.5） | **PASS** | §1.2 / §8.1 三阶段；§8.2 十项逐条（几何、几何复核、时序覆盖、双档 lag、Certificate、预算、确定性、体积、公共映射、Admission fixtures） |
| R06 | PU 六条件逐项状态 + 任一非 PASS 不得 ADMITTED；条件 2 / 5 硬阻断（2.2.6） | **PASS** | §9.2 六条件；条件 2 / 5 明示 `BLOCKED`；§9.1 / §9.2 聚合规则 |
| R07 | 条件 5 由 I03-PU-Air-Control-Closure 独立闭合；未用 U4 图割 / `midAirHits=0` / NB 替代（2.2.7） | **PASS** | §9.3；`midAirHits=0` 与 conditional 图割被明示排除；该票 Answer 冻结证据合同但条件 5 仍未闭合，包未误写为 PASS |
| R08 | 假 NB / 假 PU 全局关闭、基线失效、关闭优先级、不可逆向推导（2.2.8） | **PASS** | §8.6 / §9.5 / §9.6；含 `algorithmVersion / geometryBaseline / proofRulesVersion / fixtureVersion / puAdmissionRulesVersion` |
| R09 | 几何四状态、`coverage.geometry` 汇总、两层证据缺一不可（2.3.9） | **PASS** | §1.4 / §6.1 / §6.2；构建期 Atlas + 运行时 Phaser probe 两层 |
| R10 | 正例行 14、负例 11（10 geometry-mismatch + 1 missing-evidence）、失败码闭集与 class 映射（2.3.10） | **PASS** | 14 = hazard 2 + player 8 帧 + body 1 + graph 3；11 = 10 geometry-mismatch（含 `body-bounds-mismatch` 0.5 px recipe）+ 1 missing-evidence；F2 已修正 |
| R11 | 玩家坐标约定（锚点 / `playerBox=(24,204.4,32,48)` / 零容差 / 整数 lattice + 常量 foot 偏移）（2.3.11） | **PASS** | §6.7；与 I03-03B2a Answer 逐项一致；分数 foot 不可表达 ⇒ STOP + HITL |
| R12 | I03-03C 独立复核标准（12 项、分项 PASS、环境 / 非确定性处理、权限边界）（2.3.12） | **PASS** | §6.8；12 项与 I03-03C Answer 一致；复核 PASS 不设置 `coverage.geometry`、不开放能力 |
| R13 | 第一阶段拒稿输入闭集三项；无新增 throw；时序证据不产 `CommandError`（2.4.13） | **PASS（见 F3）** | §7.2；源码 `assertPublishableQa` 无 temporal throw；但“只允许三项抛错”未列出既有的缺报告 / 报告解析 / 候选查找 throw |
| R14 | `PublishGateResult.temporal` 为诊断字段；不落盘 / 不进 CLI / MCP / 不升契约；缺省 ≠ 不适用（2.4.14） | **PASS** | §7.1；源码 `configProblem` 在 `configPath === undefined` 时跳过，四个发布入口行为不变 |
| R15 | G1–G11 与变异测试完整（2.4.15） | **PASS** | §7.6 共 11 行；与 I03-06 Answer 逐行一致；含变异测试条款 |
| R16 | AC 21 条 / required 19；AC-11、AC-15 预先非 required 且 phase-1 `NOT_RUN`（2.4.16） | **PASS** | 数行：AC-01～AC-21 共 21；`是` 19；AC-11 / AC-15 为 `**否（phase-1 NOT_RUN）**` |
| R17 | 负向 N1–N18、回归命令、E1/E2/E3、报告路径、退出码 0/1/2 与 `INCOMPLETE` 语义（2.4.17） | **PASS（见 F1 / F5）** | §10.3 内 18 行；§10.4 回归；§10.5 证据格式 / 报告路径 / 退出码表；全文 `grep -cE '^\| N[0-9]+ \|'` 为 24（§3.7 另有 N1–N6），需按节作用域计数 |
| R18 | L1–L8 完整披露（2.4.18） | **PASS** | §10.6 共 8 行；与 I03-08 Answer 一致 |
| R19 | 单元 U1 → U2 → U4 → U5 → U3；依赖与“上一单元签署后才开始下一单元”（2.5.19） | **PASS** | §11.1；与 I03-07 Answer 一致 |
| R20 | 逐文件白名单：精确路径、操作类型、限定目的；`api.ts` 跨 U1/U2 非一次性授权；`wide-patrol` 仅该行（2.5.20） | **PASS** | §11.2；现有路径 11/11 存在，新增路径 4/4 未创建；`api.ts` 特别约束 1；`wide-patrol` 行存在于 fixture JSON |
| R21 | STOP 12 条原文；Q7-11 的 abort-only 墙钟措辞（2.5.21） | **PASS** | §11.3 共 12 条；第 11 条与 I03-07 Answer 逐字一致 |
| R22 | 五道复核门、U4/U5/U3 回滚演练、逆序正式回滚、关闭条件与“关闭 ≠ 开放”（2.5.22） | **PASS** | §11.4–§11.6；回滚顺序 U3 → U5 → U4 → U2 → U1 |
| R23 | Ledger 为空白表；无预填 SHA / 批准人 / 日期（2.5.23） | **PASS（见 F4）** | §12.2 五行为空，增量授权状态均为“未授权”；`docs/**` 全局禁区与 Ledger 更新路径存在流程歧义（F4） |

**逐项汇总：23 PASS / 0 FAIL / 0 NOT_RUN。**

## 5. 独立验证的关键断言

### IV-1：D9 20 个内部 degradation 码完整 many-to-one 到 13 个公共值（自选理由：闭集完整性是安全映射的核心；漏一个码就会把内部原因静默透传或误映射）

- 从 `packages/contracts/src/playability/temporal-result.ts:243-263` 提取 `DegradationReason` 联合，确认 **20** 个码。
- 与包 §3.2 表逐项比对：6 个 → `invalid-input`，3 个 → `budget-exhausted`，其余 11 个一一映射；合计 **20 / 20**。
- 与包 §3.1 `PublicTemporalDegradation` 联合比对：恰好 **13** 个公共值，无遗漏、无多余。
- 结论：**PASS**。内部 `budgetKind` 保留在 `limits.budgetKind`，未因 many-to-one 丢失类别。

### IV-2：几何夹具基底 / 归一化 hash 与行数可独立重建（自选理由：几何 gate 的信任链完全建立在这些 hash 与行清单上；hash 不符会使整个夹具矩阵失效）

- 按 `build-fixtures.py` 的同一 recipe 重算：
  - 源 pack tree hash = `sha256:570535deff5c2f4e1626b2680a4b555f631e51d6d87721507a0a1f6e2feb7383`；
  - 源 manifest hash = `sha256:145cb28d73e5723a458c2cffc7f3b362fa3009f8647ac879dad1ec819ffbd689`；
  - 归一化 manifest hash = `sha256:19f4da6fb9bf25b96b48b96e2e44bb1773ad0c1222dc865f72e77a56fc85cb98`；
  - 源 config hash = `sha256:d2786ee38793c47f682be58f13f2f4912ca811684fad0bc7356212d79bf011e3`；
  - 重建脚本 hash = `sha256:4253bbbb4c849d94654239f90c074e7d3161d07c97a8ed7beb3ba5a4c7a3ea66`（F2 修正后；旧 `1b58e35e…`）；
  - fixture manifest hash = `sha256:dd880628176f617819752d0d866c6adc923238e706444f20bbe0807e1e87943b`（F2 修正后；旧 `3b7196b3…`）。
- 与包 §6.6、I03-03B2 Answer、evidence/03b2-fixture-manifest.md 在 F2 修正后一致。
- 逐行解析 manifest：正例 **14**（hazard 2 / player 9 含 body 1 / graph 3）；负例 **11**（10 个 `geometry-mismatch`，含 `body-bounds-mismatch`，+ 1 个 `missing-evidence`）。
- 结论：hash、正例行数、负例组成均 **PASS**；F2 已修正。

### IV-3：冻结输入与产品树未被修改（自选理由：授权包的全部权威来自“不改 I-02、不改产品、只组装文档”）

- `git diff --stat 2b57f2a -- packages fixtures`：空。
- I-02 授权包 SHA-256：`797cd6fc…`，与已签署 hash 一致。
- 无 `origin/…i03` 远端分支；`git status` 仅本票 claim 变更。
- 结论：**PASS**。

### IV-4：基线回归与 LP-06/07 冻结输出一致（自选理由：授权包声称第一阶段不改变现有行为；必须用实际命令验证，而不是接受作者摘要）

- `pnpm test`：176 files / 2877 tests 通过，退出码 0；2 条 vitest worker `onTaskUpdate` timeout 警告，非测试失败。
- `pnpm build` / `pnpm check:deps` / `pnpm check:links`：退出码 0。
- LP-06 / LP-07：退出码 0；去掉 `generatedAt` 后与冻结 JSON 深度相等（`True` / `True`）。
- 结论：**PASS**（含“19 关”标签的精度问题，见 F5）。

### IV-5：包中“当前源码事实”逐条核对（自选理由：授权包必须准确描述实施前的现状，否则白名单 / STOP 约束会建立在错误前提上）

| 包中的事实断言 | 源码核对 | 结果 |
| --- | --- | --- |
| `publicCapability="BLOCKED"` / `publicResult=null` | `temporal-result.ts:44-45`；`temporal.ts:380-381` | 一致 |
| `runTemporalAudit` 生产 analyze 只用 `stubTemporalAnalyzer` | `ops.ts:1039`；T-58 | 一致 |
| `moving-hazard-phase` gap 仍由 `auditMechanic` 添加 | `mechanic.ts:119` | 一致 |
| `runTemporalAudit` 三处生产接线 | T-61：`ops.ts` / `create-game.ts` / `publish-gate.ts` | 一致 |
| `playabilityIssues` 只在 `PROVEN_UNPLAYABLE` 时由阻断型 evidence 产 error | `api.ts:113-118` | 一致 |
| `assertPublishableQa` 无时序 throw | `publish-gate.ts` 全文；`runTemporalAudit` 内部 catch | 一致 |
| `PublishGateResult.report / reportPath / manifest` 为现有字段 | `publish-gate.ts` 类型与返回 | 一致 |

结论：**PASS**。

## 6. 发现（F1–F6）

### F1（低 / 可追溯性）：负向编号命名空间冲突，且 §4.7 的“I03-02 原始编号”说法不准确

- **位置**：包 §3.7（第 295 行）使用 `N1–N6`；§4.7（第 381 行）使用 `V1–V10` 并写作“I03-02 原始编号 V1–V10”；§10.3 使用 `N1–N18`。
- **事实**：I03-02 决策票（`issues/03-i03-02-verdict-coverage.md:124-137`）的原始编号是 **N1–N10**，不是 V1–V10。包 §4.7 的内容与 I03-02 逐项一致，只是标签被重命名为 V，但“原始编号”四个字与事实不符。
- **影响**：同一份包内存在两套 `N1–N6`（§3.7 映射负例 vs §10.3 验收负例）；审查输入包 §4 的全文件 `grep -cE '^\| N[0-9]+ \|'` 会返回 24 而不是 18。实施 / 复核引用 “N1” 时可能指错表。
- **建议**：把 §3.7 的映射负例改为独立前缀（如 M1–M6），并把 §4.7 改为“I03-02 N1–N10 → 本包 V1–V10”；或至少在 §3.7 标题明确“本节 N1–N6 与 §10.3 N1–N18 无关”。非阻断。

### F2（中 → 已修正 / 夹具描述与覆盖）：§6.6 的负例组成与冻结 manifest 不一致；`body-bounds-mismatch` 无冻结负例

- **位置**：包 §6.6；§6.5；`evidence/03b2-fixture-manifest.md`；`fixtures/manifest.json` 的 `negative[]`。
- **原始事实**：
  - §6.6 原写“负例 10：7 个 geometry-mismatch + `atlas-missing` + body-size / body-offset / graph-solid override”。按加法读为 7 + 1 + 3 = 11；冻结 manifest 原为 **10**。
  - manifest 原 class 组成为 **9 个 `geometry-mismatch` + 1 个 `missing-evidence`**；§6.5 失败码闭集包含 `body-bounds-mismatch`，但上述 10 个冻结负例没有它。
- **用户裁定**：2026-11-14 选择 1，**先修正 F2，再进入 I03-11 签署；不接受将其作为已知限制带入签署。**
- **修正后**：
  - 新增 `body-bounds-mismatch` recipe：`target="player"`，`body.bounds.x=24.5`（canonical 24.0，仅 +0.5 px），size / offset 不变。
  - manifest 现为 **11** 个负例：**10 个 `geometry-mismatch` + 1 个 `missing-evidence`**。
  - 包 §6.6、§10.2 AC-15、§16 第 7 行与审查输入包 item 10 均同步为 11；§6.6 加入修正说明。
  - 新 script hash `4253bbbb…`、manifest hash `dd880628…`；见 [`evidence/10-f2-correction.md`](../evidence/10-f2-correction.md)（`sha256:17ea5f91…`）。
- **结论**：**F2 关闭。** 仍不改变当前 gate（AC-15 仍 `NOT_RUN`、probe 未实现），但冻结矩阵现已覆盖 §6.5 闭集中的 `body-bounds-mismatch`。

### F3（低 / 措辞精度）：§7.2 “只允许从现有三项检查抛错”未覆盖既有输入 / 报告定位 throw

- **位置**：包 §7.2（第 538–553 行）；`packages/pipeline/src/publish-gate.ts:191,215,226,233`。
- **事实**：`assertPublishableQa` 除了 `subjectProblem` / `verdictProblem` / `configProblem` 的拒稿判断外，还会因“找不到 QA 报告”“候选报告都不可用”“报告解析失败”“manifest 读取失败”抛 `CommandError`。包的三项闭集准确表达了**内容型拒稿输入**，但没有列出这些既有的输入 / 定位 throw。
- **影响**：实现的“无新增 throw”约束仍然清晰；但若按字面理解“只允许三项抛错”，可能误以为其他 throw 不存在，或在复核 diff 时误判。
- **建议**：改为“内容型拒稿输入仍是现有三项；既有的缺报告 / 报告解析 / 定位 throw 保持不变，且不得新增时序驱动的 throw”。非阻断。

### F4（低 / 流程歧义）：`docs/**` 全局禁区与 Ledger 更新路径

- **位置**：包 §11.2 特别约束 5（第 983 行）把 `docs/**` 列为全局禁区；§12.2（第 1048 行）把 Ledger 放在 `docs/v7.8/移动-I03.md`；§11.4 第 5 道门要求用户在该 Ledger 行签署。
- **事实**：单元实施者被禁止修改 `docs/**`，但 Ledger 的实施 SHA / 证据路径 / 回滚信息需要写入同一 docs 文件。
- **影响**：流程上不清楚由谁写入 Ledger 的技术字段；若由实施者写入，会与 §11.2 冲突；若由用户写入，需要明确记录。
- **建议**：明确“Ledger 更新是独立于单元 diff 的 docs 变更，由用户或获授权的 docs 操作完成；单元 diff 不得包含 `docs/**`”，或把该文件加入白名单并限定“仅 Ledger 行”。非阻断。

### F5（低 / 验收标签）：“19 关”与冻结语料的 20 个唯一 config 不一致

- **位置**：包第 104、568、648、778、860、900、931 行；`evidence/06-corpus-regression.json` 的 `counts.uniqueConfigs=20`、`uniquePairs=96`；I-02 `reports/U5-completion.md:76`（“20/20”）。
- **事实**：冻结 LP-06 语料实际是 **20 个唯一 config / 96 个 pair / 150 个可用 config**；U5 报告也写“20/20”。“19 关”更像是指 19 个 x 轴移动 Hazard（I02-05 口径）或沿用的旧标签，而不是唯一 config 数。
- **影响**：AC-21 与 §10.4 的“19 关 IE 不回归”在验收时无法直接对应到 LP-06 的 20 个 config；不过包同时要求“LP-06/07 原命令重跑与冻结基线逐项一致”，实际比较仍以冻结输出为准。
- **建议**：在 §10.4 / AC-21 / L5 明确“19 个 x 轴移动 Hazard / 20 个唯一 config / 96 个 pair”，或直接引用 LP-06 的 `counts` 字段。非阻断。

### F6（低 → 已修正 / 证据卫生）：`evidence/03b2-fixture-manifest.md` 的旧命令结果行

- **位置**：`evidence/03b2-fixture-manifest.md:77`。
- **原始事实**：同一文件的“正例行（14）”表和冻结 manifest 都是 14 行；该命令结果行仍是 13→14 修正前的旧文本。
- **修正后**：命令结果行已改为 `14 rows / 11 negatives`（同时反映 F2 新增的 `body-bounds-mismatch`）；负例表与 hash 已同步。
- **结论**：**F6 关闭。**

## 7. 未覆盖项与限制

- **U1–U5 尚未实施**：本审查只审授权包，不审实施代码；没有可审的 diff。
- **几何 probe 尚未实现**：AC-15 为 phase-1 `NOT_RUN`；没有真实 probe JSON / 逐帧证据可复核。
- **Runtime hitbox equality 未证**：`runtimeBody="unverified"`；不在本审查范围。
- **PU 条件 2 / 5 仍 `BLOCKED`**：本审查不判断其是否可开放；条件 5 的证据合同已由 I03-PU-Air-Control-Closure 冻结，但合同本身不等于条件 5 PASS。
- **I-02 / U5 冻结材料只做定向核对**：未重新审计整个 I-02 授权包或 U5 全部证据；只核对了 I-03 包引用到的 hash、事实与行数。
- **LP-06/07 的原始 hash 不可复现**：脚本写入 `generatedAt` 时间戳；本报告按去掉该字段后的语义相等比较。复跑后已复原 tracked 证据。
- **`pnpm test` 的 2 条 vitest worker `onTaskUpdate` timeout**：退出码仍为 0，176/176 文件、2877/2877 测试通过；按 runner 级环境噪声记录，不视为测试失败。
- **未验证 I03-PU-Air-Control-Closure 的 A/B 证明数学**：该票是证据合同，不是已执行的证明；条件 5 仍 `BLOCKED`。

## 8. 结论与独立签署

**总体结论：PASS（23/23 检查项）。**

- 未发现会改变六条冻结边界、公共 Verdict / coverage 语义、发布门拒稿行为、NB / PU 准入链、实施授权边界或能力状态的阻断性缺陷。
- 审查对象仍是 `ASSEMBLED / UNSIGNED`；`PUBLIC_NB` / `PUBLIC_PU` 仍 `BLOCKED`；I-03 实施仍 `NOT_AUTHORIZED`。
- 6 项发现均为文档 / 可追溯性 / 夹具描述问题。**F2 已按用户裁定修正**（11 负例，含 `body-bounds-mismatch`；见 `evidence/10-f2-correction.md`），**F6 一并修正**；F1 / F3 / F4 / F5 仍为非阻断，建议作为后续文字 / 流程清理，不影响签署。
- 本审查 **不**表示 I-03 已实施、**不**授权 U1–U5、**不**开放公共能力、**不**设置 `coverage.geometry`。授权包签署只建立后续实施依据。

| 项 | 值 |
| --- | --- |
| 审查人 | claude（I03-10 独立会话） |
| 日期 | 2026-11-14 |
| 审查基线 | `wayfinder/level-playability-v1.1-i03` @ `69a336e` |
| 审查对象 hash | `sha256:2f89d572008b538be5871fef11d9f539e16829d1f4ceafe6e25a8a250fb9a52e`（F2 修正后） |
| 复跑命令 | `pnpm test` / `pnpm build` / `pnpm check:deps` / `pnpm check:links` / LP-06 / LP-07 / `python3 …/build-fixtures.py`，全部退出码 0（fixture：14 rows / 11 negatives） |
| 结论 | **PASS**；F2 / F6 已修正，F1 / F3 / F4 / F5 非阻断 |
| 权限边界 | 不授权实施 / 单元 / probe / fixture；不开放 `PUBLIC_NB` / `PUBLIC_PU` |

**独立签署：**我确认本报告的逐项判断来自我自己的重读、重算与重跑，不依赖作者摘要或审查输入包的自述；我未参与 I-03 授权包的撰写或组装。
