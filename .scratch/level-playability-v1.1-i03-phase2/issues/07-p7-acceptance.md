# P7 · Phase-2 全量验收计划

Type: grilling
Status: resolved
Owner: claude (P7 session 2026-11-17)
Blocked by: 03, 04, 05, 06
Map: ../map.md
Class: I-03-Phase2 / P7

## Question

为 P7 产出一份可交接的验收计划：如何在 P2–P6 全部签署 / 合并 / Ledger 后，由 fresh 独立验收会话重跑 AC-01–AC-21，映射 AC-10→P4、AC-12→P5、AC-14→P6、AC-15→P2+P3，保留 phase-1 报告不可变，并判定 PASS / FAIL / INCOMPLETE 与退出码？

必须覆盖：独立验收前置（P7 用户单独授权）；固定报告 `.scratch/level-playability-v1.1-i03-phase2/reports/phase2-acceptance.md`；phase-1 报告不可变；AC-01–AC-21 逐项 required / E1–E3 / 证据 / 状态；AC-15 在 P3 完整时 PASS，否则 NOT_RUN，始终非 required；AC-11 NOT_RUN；G1–G11 / N1–N18 / T-55–T-65 / LP-06/07 / 跨进程确定性 / L1–L8；`PUBLIC_NB` / `PUBLIC_PU` 仍 BLOCKED；整体状态与退出码语义。

约束：见 `reports/00-execution-protocol.md` §9 与 annex §9；P7 不自行修补证据、不替用户签署。

## Answer

**Q1–Q8 = 用户全部采纳（2026-11-17）。** 本 brief 冻结 P7 的验收计划；**不构成 P7 验收执行授权**。

### 1. 目标与前置

P7 由 **fresh 独立验收会话**在 P2–P6 全部完成后，重跑 AC-01–AC-21，判定 `PASS` / `FAIL` / `INCOMPLETE` 与退出码，并把事实写入固定报告。P7：

- 不修补证据、不改基线、不回滚、不重写历史、不替用户签署；
- 不开放任何能力；
- 不参与任何 Phase-2 单元的实现或复核（独立验收会话）。

启动前置（任一缺失 ⇒ 不启动）：

1. P2–P6 每个单元的增量授权记录已签、实施已合并 `main`、fresh review `PASS` + 用户签署、Ledger 行完整（实施 SHA / 证据路径 + hash / 批准人 / 日期 / 回滚目标 / 演练证据）；
2. P1/P2 的 audit 分支证据 commit 可解析（`wayfinder/i03-phase2-probe-evidence`）；
3. P3 报告 `reports/P3-probe-review.md` 存在且含用户签署；
4. phase-1 报告与 I-03 授权包 hash 未变（`docs/v7.8/移动-I03.md` `sha256:2bbe7c55…`；annex `sha256:100d0221…`）；
5. 用户已签署 `reports/P7-acceptance-authorization.md`。

### 2. 输入可解析性核验

P7 开始先产出一张**输入可解析性表**，逐项写实际 SHA / hash / 结论：

| 输入 | 核验 |
| --- | --- |
| P1 | Ledger 行；audit 分支 commit；contract / manifest hash `dd880628…`；夹具 14 正例 + 11 负例 |
| P2 | Ledger 行；evidence commit；P3 报告 hash；P2 证据 `SHA256SUMS` |
| P3 | `reports/P3-probe-review.md` 用户签署；14 + 11 逐项 `PASS/FAIL/NOT_RUN`；环境记录 |
| P4 | Ledger 行；实施 SHA；`reports/P4-review.md` hash；矩阵 hash；回滚演练日志 |
| P5 | Ledger 行；实施 SHA；`reports/P5-review.md` hash；矩阵 hash；回滚演练日志 |
| P6 | Ledger 行；实施 SHA；`reports/P6-review.md` hash；矩阵 hash；回滚演练日志 |
| phase-1 | `I03-acceptance.md` / `I03-acceptance-run1-FAIL.md` 未变；授权包 hash 未变 |
| P7 | 用户签署的 `reports/P7-acceptance-authorization.md` |

任一缺失或 hash 不符 ⇒ **停止**，退出码 `2`，报告记 `INVALID_INPUT`；不得先跑测试再补核验。

### 3. AC 判定与 phase-2 映射

required 总数保持 **19**；非 required：AC-11、AC-15。

| AC | required | phase-2 判定 |
| --- | --- | --- |
| AC-01–AC-09 | 是 | 在 phase-2 基线**重跑**；不继承 phase-1 PASS |
| AC-10 | 是 | → P4；十项准入、17 行矩阵、gate `BLOCKED` 负向、probe manifest hash |
| AC-11 | 否 | 恒 `NOT_RUN`；PU 条件 2 / 5 `BLOCKED`；不得被其他 PU 条件 PASS 抵消 |
| AC-12 | 是 | → P5；假 NB / 假 PU 关闭、基线失效、关闭优先、两轴独立 |
| AC-13 | 是 | 重跑；NB ≠ PU |
| AC-14 | 是 | → P6；只认 P3 分项 PASS、`all-checked` / 退出码不能替代、partial 不得变 untrusted |
| AC-15 | 否 | → P2+P3；完整签署 ⇒ `PASS`；有实际失败证据 ⇒ `FAIL`；否则 `NOT_RUN` |
| AC-16–AC-19 | 是 | 重跑；G1–G11、T-58、白名单 |
| AC-20 | 是 | P1–P6 各单元五道门 + Ledger + 回滚演练 |
| AC-21 | 是 | 全量回归 + LP-06/07 + 19 关 IE 不回归 + 跨进程确定性 |

- phase-1 的 PASS 只作历史输入，不作 phase-2 证据；每个 AC 在 phase-2 基线重新取证。
- 整体：required 全 `PASS` ⇒ `PASS`；任一 required `FAIL` ⇒ `FAIL`；无 FAIL 但有 required `NOT_RUN` ⇒ `INCOMPLETE`。
- 禁止通过率 / 加权 / 多数决 / 分组替代逐项。

### 4. 证据级别与取证来源

沿用 I-03 §10.5：

- **E1**：源码 / 契约 `file:line`；
- **E2**：测试名 + 断言 + 退出码；
- **E3**：scratch 复跑（命令、路径、计数、原始输出摘要）。

P7 独立重跑全部 E2 / E3；只从 Ledger 记录的实施 SHA、evidence branch commit、audit branch commit 取证并**复算 hash**。不采信作者总结、不读实施者本地未跟踪目录。无法从记录 commit 复算的证据 ⇒ `NOT_RUN`，不得用工作树副本替代。

### 5. 回归、负向矩阵与确定性

固定执行，不改命令语义、不迁移进 Vitest、不包装 CI：

| 项 | 命令 / 来源 |
| --- | --- |
| 全量测试 | `pnpm test` |
| 构建 / 类型 | `pnpm build` |
| 依赖 / 链接 | `pnpm check:deps`、`pnpm check:links` |
| T-55–T-65 | `packages/contracts/tests/playability-temporal-input.test.ts`（随 `pnpm test`，单独记录） |
| LP-06 | `pnpm build && node .scratch/level-playability-v1-p1/acceptance-corpus.mjs` |
| LP-07 | `pnpm build && node .scratch/level-playability-v1-p1/acceptance-matrix.mjs` |
| 跨进程确定性 | `pnpm build && node .scratch/level-playability-v1.1-u5/scripts/cross-process-determinism.mjs` |
| G1–G11 | `packages/pipeline/tests/publish-gate.test.ts` 对应用例 |
| N1–N18 | 逐项映射到测试 / 源码，记录 file:line 或测试名 |
| 19 关 IE | LP-06 语料 20 configs / 96 pairs / 19 x 轴 Hazard |

LP-06/07 必须与 phase-1 冻结基线逐项一致：语义 hash **LP-06 `071ae5d5…`**、**LP-07 `5c7d9391…`**；全 hash 从 phase-1 验收报告与基线文件复算，不以摘要替代。任何命令失败保留原始输出与退出码，**不重试到绿、不改脚本**。

### 6. 报告结构、状态与退出码

固定路径：`.scratch/level-playability-v1.1-i03-phase2/reports/phase2-acceptance.md`。

固定章节：

1. 基线 SHA / 验收代码 SHA / 环境；
2. 输入 hash 链（phase-1 报告、I-03 授权包、P1–P6 Ledger 与证据）；
3. 单元门核验表（授权 / 实施 / 复核 / 签署 / 合并 / Ledger / 回滚）；
4. AC-01–AC-21 逐项：required / 级别 / 证据来源 + hash / 状态；
5. G1–G11；
6. N1–N18；
7. 回归命令与 hash；
8. L1–L8；
9. 整体状态与关闭相关不变量；
10. 用户签署记录。

退出码：

| 退出码 | 含义 |
| --- | --- |
| `0` | 无 required `FAIL`；**不代表整体 PASS**，仍需检查 `NOT_RUN` |
| `1` | 至少一个 required `FAIL` |
| `2` | 验收输入、基线或报告结构无效 |

### 7. 失败处理与 STOP

- 验收会话**不修补证据、不改基线、不回滚、不重写历史**。
- required `FAIL` ⇒ 保留原始输出与 hash，整体 `FAIL`，exit `1`。
- 输入缺失 / 结构无效 ⇒ 停止，exit `2`。
- 发现白名单外修改、未解决 STOP、能力被打开 ⇒ 记 `FAIL` 并 HITL。
- 不得自行“修好再验收”；修复属于新授权 / 新单元，不属于 P7。

### 8. 交付、分支与授权记录

- 用户先签署 `.scratch/level-playability-v1.1-i03-phase2/reports/P7-acceptance-authorization.md`（范围、输入、STOP、退出码语义）。
- 验收会话从合并后的 `main` 切 `wayfinder/i03-phase2-p7-acceptance`。
- 报告提交到固定路径；raw 证据提交 `wayfinder/i03-phase2-p7-evidence`，`git add -f` 仅限 `.scratch/level-playability-v1.1-i03-phase2/evidence/phase2/P7/**`。
- docs-only PR 合入 `main`；不改产品代码、不改 phase-1 报告。
- P7 **无 Ledger 行**（annex §12.2 只有 P1 / P2 / P4 / P5 / P6）；报告引用六个单元 Ledger 行。
- 报告由验收会话撰写；用户审阅并签署；验收会话不得代签。

### 9. 关闭语义与能力边界

P7 整体 `PASS` / `INCOMPLETE` / `FAIL` **都不开放任何能力**：

- `PUBLIC_NB` / `PUBLIC_PU` 仍 `BLOCKED`；
- `publicCapability="BLOCKED"` / `publicResult=null`；
- 发布拒稿行为与冻结基线一致；
- 无未解决 STOP；
- **关闭 ≠ 开放**；P7 授权不隐含任何能力授权。

报告“关闭相关不变量”一节逐项写明以上五项。

### 10. 授权顺序

1. P2–P6 全部完成独立复核 / 用户签署 / 合并 / Ledger；
2. 用户签署 `reports/P7-acceptance-authorization.md`；
3. docs-only PR 合入 `main`；
4. fresh 独立验收会话从更新后的 `main` 切 `wayfinder/i03-phase2-p7-acceptance`；
5. 输入核验 → 全量重跑 → 逐项取证 → 写报告；
6. 用户审阅并签署报告；
7. docs-only PR 合入 `main`；报告成为 phase-2 关闭事实记录；
8. 不开放能力。

本会话未创建 `P7-acceptance-authorization.md`、未运行验收、未创建验收 / 证据分支。

## Comments

- 2026-11-17：grilling 两轮 Q1–Q8 全部裁定 A；P7 验收计划冻结。P7 执行仍待 P2–P6 完成 + 用户单独授权。
