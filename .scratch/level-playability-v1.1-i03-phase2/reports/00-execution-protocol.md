# I-03 Phase-2 执行协议（P0 交付）

| 项 | 值 |
| --- | --- |
| 票 | P0 · Phase-2 执行协议、UNSIGNED annex 与 Ledger 模型 |
| 日期 | 2026-11-17 |
| 状态 | 规划资产已交付；annex **UNSIGNED**；不构成任何实施授权 |
| Authority | `docs/v7.8/移动-I03.md`（SIGNED）@ `sha256:2bbe7c55…`；`docs/v7.8/移动-I03-phase2.md`（UNSIGNED 草案） |
| Baseline | `main` @ `dd10dff`（phase-1 INCOMPLETE 关闭后） |
| Map | [`../map.md`](../map.md) |

> 本协议只规定 Phase-2 的治理与执行边界。它不写产品代码、不运行 probe、不物化夹具、不执行验收，也不开放 `PUBLIC_NB` / `PUBLIC_PU`。

## 1. 三重状态

| 状态 | 含义 |
| --- | --- |
| P0 CLOSED | 本协议、UNSIGNED annex、地图、7 张票已交付 |
| Annex UNSIGNED | 尚未形成用户签署的 Phase-2 授权基线 |
| P1–P6 NOT_AUTHORIZED | 每个单元仍需独立增量授权；annex 签署只建立申请依据 |
| P7 NOT_AUTHORIZED | P2–P6 完成后由用户另行授权 fresh 验收会话 |

## 2. 单元与依赖

| 单元 | 内容 | 启动条件 | Ledger 行 |
| --- | --- | --- | --- |
| P1 | probe 契约冻结 + 夹具物化 | annex 签署 + P1 授权 | 是 |
| P2 | probe 实施 + P3 独立复核门 | P1 合并 / 签署 / Ledger | 是（P3 记录嵌套） |
| P3 | I03-03C 独立复核 + 用户签署 | P2 实施完成 | 否（P2 行内） |
| P4 | NB admission machinery | P1 合并 / 签署 / Ledger | 是 |
| P5 | global gate close | P4 合并 / 签署 / Ledger | 是 |
| P6 | AC-14 几何证据消费 | P3 PASS + 用户签署 | 是 |
| P7 | 全量验收 | P2–P6 全部合并 / 签署 / Ledger + 用户 P7 授权 | 否 |

- P2 与 P4 可在 P1 后并行；P5 与 P6 可在各自前置满足后并行。
- 并行只共享前置事实；授权、分支、复核、签署、Ledger 均不得合并。

## 3. 单元执行流程

每个实施单元（P1/P2/P4/P5/P6）固定九步：

1. 写增量授权记录（范围、白名单、STOP、证据要求）。
2. 用户签署该记录。
3. docs-only PR 合入 `main`。
4. 从更新后的 `main` 切实施分支（P1/P2 为 audit 分支）。
5. 实施 / 测试 / 证据归档。
6. fresh 独立复核，逐项 `PASS / FAIL / NOT_RUN`。
7. 用户签署完成。
8. 合并实施 PR（P1/P2 为 audit 分支归档 + 治理报告 PR）。
9. 独立 Ledger 更新（annex §12.2 对应行）。

- Phase-1 的授权记录已耗尽，Phase-2 必须新建，不得引用 Phase-1 授权。
- 白名单以每单元授权记录为准；发现需要扩大 ⇒ STOP + HITL。

## 4. P1 / P2 scratch 与 audit 分支

- 目录：`.scratch/level-playability-v1.1-i03-phase2/geometry-probe/{contract,fixtures,scripts,evidence/p1,evidence/p2}`。
- 产物用 `git add -f` 提交到 **独立 audit 分支** `wayfinder/i03-phase2-probe-evidence`；`main` 只收授权 / 复核 / 治理报告。
- `git add -f` 只允许上述白名单目录；不得夹带环境配置、凭据、临时日志或其他被忽略文件。
- P1 记录 contract / manifest / 每个文件的 SHA-256；P2 记录每个输出的 SHA-256 与运行命令。
- P3 / P7 只从 audit 分支的 commit SHA 取证，不从实施者本地目录取证。

## 5. P3 独立复核门

- P3 是 P2 内的独立复核与用户签署门，不单独占 Ledger 行，但阻断 P6。
- fresh reviewer 未参与 P1/P2；只接收冻结契约、manifest、probe 输出、hash、命令。
- 报告固定路径：`.scratch/level-playability-v1.1-i03-phase2/reports/P3-probe-review.md`。
- 报告必须含：reviewer 独立性、日期 / 环境、输入 hash、独立复算命令、14 正例行 + 11 负例逐项结果、限制、用户签署行。
- P3 PASS 只表示 probe 证据可作为 P6 的几何输入；不代表 `coverage.geometry` 自动 checked、AC-14 自动 PASS 或任何能力开放。

## 6. P4 / P5 / P6 白名单原则

- P4：`admission.ts` + 测试 + 夹具 + `api.ts` 仅导出；不碰 `public-verdict.ts` / `verdict.ts` / `capability-gate.ts`。
- P5：`capability-gate.ts` + 测试 + 夹具 + `public-verdict.ts` 仅最小接线 + `api.ts` 仅导出；`PublicVerdictResult` 形状不变；需要改形状 ⇒ STOP。
- P6：`geometry-evidence.ts` + `temporal-evidence.ts` + `verdict.ts` 仅 geometry 类型加法式放宽 + `api.ts` 仅导出 + `ops.ts` 显式可选参数接线 + 对应测试；不碰 `publish-gate.ts` / CLI / MCP / `public-verdict.ts`。
- P6 只消费显式 `GeometryEvidenceInput`；不读 scratch、不运行 probe、不推断签署真实性。

## 7. 证据 / 复核 / 回滚

- 证据目录：P4/P5/P6 用 `evidence/phase2/P4|P5|P6/`（audit 或独立 evidence 分支）；P1/P2 用 audit 分支 `evidence/p1|p2/`。
- 每单元证据含 `commands.log`、目标 / 全量测试输出、typecheck / build / deps / links、invariant before/after、SHA256SUMS。
- P4/P5/P6 **必须实际回滚演练**：隔离 drill 分支 revert 单元 commit，跑目标测试 + 全量 `pnpm test`，记录日志 / 退出码 / hash。
- 回滚目标为单元分支切出时的 `main` SHA。

## 8. STOP

Phase-1 授权包 §11.3 的 12 条 STOP 全部继承。Phase-2 追加四条：

1. **P1 → P2**：契约或夹具 hash 不一致 ⇒ 停止 P2；不得自行修订基线。
2. **P2 → P3**：probe 结果 / 实现 / 证据不完整 ⇒ P3 不得 PASS。
3. **P3 → P6**：没有独立复核 PASS + 用户签署 ⇒ P6 不得读取 probe 输出。
4. **P2–P6 → P7**：任一单元未签署 / 未合并 / Ledger 未完成 ⇒ P7 不得启动。

任一 STOP ⇒ HITL；不得自行缩范围或改写历史记录。

## 9. P7 验收授权与报告

- P2–P6 全部完成后，用户**另行签署** P7 验收授权记录；annex 不自动授权验收。
- fresh 独立验收会话重跑 AC-01–AC-21，映射：AC-10→P4、AC-12→P5、AC-14→P6、AC-15→P2+P3；AC-11 保持非 required `NOT_RUN`。
- 报告固定路径：`.scratch/level-playability-v1.1-i03-phase2/reports/phase2-acceptance.md`；phase-1 报告不可变。
- 整体状态：required 全 PASS ⇒ `PASS`；任一 required `FAIL` ⇒ `FAIL`；无 required FAIL 但有 required `NOT_RUN` ⇒ `INCOMPLETE`。
- 退出码严格按 I-03 §10.5：`0` = 无 required FAIL（不等于整体 PASS）、`1` = 至少一个 required FAIL、`2` = 输入 / 基线 / 报告结构无效。
- 报告由验收会话撰写；用户审阅并签署；验收会话不得替用户签署。

## 10. 不变量

- `PUBLIC_NB` / `PUBLIC_PU` 恒 `BLOCKED`；`publicCapability="BLOCKED"` / `publicResult=null`。
- 公共 `PlayabilityVerdict` 顶层形状不变；发布拒稿行为与退出码不变。
- Phase-1 报告 / I-02 / I-03 正文 / §12.2 不可变。
- 产品 package 不包含 probe 脚本或夹具副本。
- 未经 P3 签署的 probe 输出不得进入 `coverage.geometry`。
- Phase-2 完成与 required 全 PASS 都不自动开放任何能力。
