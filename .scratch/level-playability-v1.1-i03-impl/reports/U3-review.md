# U3 独立复核报告

> 复核对象：I-03 实施 U3（contracts `mechanic.ts` 移除 `moving-hazard-phase` gap；temporal 层接管）
> 结论：**FAIL**（1 项阻断发现；其余逐项 PASS）
> 边界：本报告的 PASS **只**表示 U3 证据足以支持该项；**不**开放 `PUBLIC_NB` / `PUBLIC_PU`；**不**授权 probe / fixture 实施；不改变发布闸行为。

## 0. 复核人 / 日期 / 环境

| 项 | 值 |
| --- | --- |
| 复核人 | fresh 独立复核代理（未参与 U3 实施；未采信作者结论） |
| 日期 | 2026-11-16（UTC 2026-11-16T15:31Z 左右） |
| 仓库 | `/Volumes/shy/some-projects/game-maker` |
| 分支 | `wayfinder/level-playability-v1.1-i03-u3` |
| 环境 | Darwin 24.6.0 arm64（macOS 15.7.9）；node `v22.23.2`；pnpm `10.7.1`；vitest `3.2.7` |
| 工作树状态 | 复核开始时 clean；复核只新增本报告文件，未改产品 / 证据 / 授权文件 |

## 1. 复核对象与输入 hash

| 项 | 值 / SHA-256 |
| --- | --- |
| Base | `7b973a78f96a6dece66d0efeb8de85bcae203d2f` |
| Code/test head | `b02b2ce1a8ed1f58fc1740109636857f1669d199` |
| Evidence-only head | `82ba352150daa19441c7c85f939592802dd668cf`（父提交 `b02b2ce`） |
| U3 代码提交 | `5ecb0492134d0357a9d99026a3684c076a0cfba0`、`b02b2ce1a8ed1f58fc1740109636857f1669d199` |
| 授权包 `docs/v7.8/移动-I03.md` | `8a8349b1f26f20d08a6c7573875ed5d0a070d240158c183f1b75721b6ecaf917`（与输入包声明一致） |
| 授权记录 `reports/U3-incremental-authorization.md` | `3c7a3c5ae8aaebafd2d85321c5b2916b345511f6231864e49793fa83349eeb49` |
| 单元 brief `issues/06-i03-impl-u3.md` | `5e9ef583616bc0f65a627da39cc212f7498bded211af64ed617faad59a5280ae` |
| 复核输入 `reports/U3-review-input.md` | `8dc46efdae58f7fd64b73df345bc3fbb69704a4303834983b2c15fd6c7b6e0cc` |
| 证据清单 `evidence/U3/SHA256SUMS` | `3a2a3049027fa0528814946e1a767795234e02f53fa8804ec7bf3f43d50b4ab8` |
| `7b973a7..b02b2ce` 完整 diff | `a3a975261ec20776aa7701a21fdb048f897253c5c4b5580b0551609f0cebf983` |

核对说明：

- `shasum -a 256 -c evidence/U3/SHA256SUMS` 逐文件 10/10 `OK`，退出码 0。
- 授权记录引用的当前授权包 hash 与实测一致；brief 只有路径引用、没有声明 hash，复核人自行计算并记录（无声明值可对照，属限制项）。
- 授权记录称分支从 `main @ 819bf1e` 切出；本地 `main` ref 当前停在较旧的 `f4e6ce7`（未更新），但 `819bf1e` 是 base `7b973a7` 的祖先，且 `git diff 819bf1e 7b973a7 -- packages` 为空，因此产品基线一致。

## 2. Diff scope（`7b973a7..b02b2ce`）

`git diff --name-status` **只有 3 个文件**：

1. `packages/contracts/src/playability/mechanic.ts`
2. `packages/contracts/tests/playability-mechanic.test.ts`
3. `packages/contracts/tests/fixtures/playability-mechanic-matrix.json`

只读 / 零 diff 核对（逐路径 `git diff --quiet`，退出码 0）：

- `api.ts`、`verdict.ts`、`public-verdict.ts`、`temporal.ts`、`temporal-evidence.ts`、`temporal-result.ts`；
- `packages/assets/src/ops.ts`（U4）、`packages/pipeline/src/publish-gate.ts`（U5）、`packages/pipeline/src/create-game.ts`；
- `packages/cli`、`packages/mcp` 整树；
- U1 / U2 / U4 / U5 测试文件、`package.json` / lockfile / tsconfig（都因 name-status 只有三文件而零 diff）。

Fixture 深比较（base 与 head JSON 解析后逐行 `deepStrictEqual`）：

- 其余 5 行（`static-hazard-seals-path`、`danger-full-wall`、`danger-wide-idle`、`pickup-in-static-hazard`、`moving-platform`）逐字不变；
- `manifest` 不变；
- `wide-patrol` 的 `config` / `evidence` / `legalPair` 不变，只改 `expectedVerdict`、`expectedJudgmentId`、`expectedGap`、`failureLocation`、`note` 五个断言字段。
- 证据提交 `82ba352` 只新增 `.scratch/.../evidence/U3/*` 与 `reports/U3-review-input.md` 共 12 个文件，未混入产品代码。

## 3. 逐项结论（不得以总通过率替代）

| ID | 检查项 | 结论 | 依据 |
| --- | --- | --- | --- |
| R1 | 授权包 / 授权记录 / brief / 复核输入 hash 核对 | **PASS** | 见 §1；授权包与声明一致 |
| R2 | `evidence/U3/SHA256SUMS` 完整性 | **PASS** | 10/10 OK，exit 0 |
| R3 | diff 只落白名单三文件 | **PASS** | name-status 仅 3 文件 |
| R4 | `api.ts` / `verdict.ts` / `public-verdict.ts` / U1 / U4 / U5 / CLI / MCP / `create-game.ts` 零 diff | **PASS** | 逐路径 `git diff --quiet` exit 0 |
| R5 | fixture 仅 `wide-patrol` 行变化，其余五行逐字不变 | **PASS** | JSON 深比较；仅 5 个断言字段变化 |
| R6 | `mechanic.ts` 精确删除 `movingHazards` 与 `moving-hazard-phase` | **PASS** | diff 精确删除两行代码；产品树仅注释残留该字符串 |
| R7 | `allHazards` / `staticHazards` / `movingSolids` 保留 | **PASS** | 源码核对；`movingSolids` 仍用于 gap |
| R8 | `moving-platform-unsupported` 仍在 | **PASS** | 源码第 120 行；`moving-platform` fixture 实测 gap 保留、`partial`、IE |
| R9 | `wide-patrol` 层内 NB + `coverage.mechanic="checked"` + evidence 为空 | **PASS** | 独立 node 直调 dist：`{verdict:"NO_PROVEN_BLOCKER",coverage:"checked",gaps:[],evidence:[]}` |
| R10 | 公共路径经真实 `mapPublicVerdict` + `PHASE1_CAPABILITY_GATE/ADMISSION` ⇒ IE | **PASS** | 测试走真实 mapper；gate `BLOCKED` / admission `false`；实测公共 IE |
| R11 | applicable + `checked` + `nb-candidate` ⇒ IE | **PASS** | U3 测试通过 |
| R12 | applicable + `partial` / `unknown` ⇒ IE | **PASS** | U3 测试通过 |
| R13 | applicable 但无 evidence ⇒ `temporal:"unknown"` ⇒ IE（**mapper 层**） | **PASS** | U3 测试通过；mapper 实现核对 |
| R14 | 不适用 ⇒ existing，且无 temporal / geometry 字段 | **PASS** | 测试用 `danger-wide-idle`；mapper 实现核对 |
| R15 | gate `BLOCKED` 时 nb / pu candidate 均不产公共 NB / PU | **PASS** | U3 测试通过 |
| R16 | synthetic temporal evidence 符合 U1 真实类型、无 `as any` | **PASS** | 字段与 `verdict.ts` 的 temporal witness/coverage 类型一致；grep 无 `as any` / ts-ignore；typecheck 0 |
| R17 | 公共 IE 上 `playabilityIssues` 为空；temporal 非阻断 | **PASS** | U3 测试通过；`isBlocking` 排除 temporal |
| R18 | 其他 mechanic 语义不变（静止 hazard A、danger B、moving-platform、矩阵其余行） | **PASS** | 矩阵 6 例 + 全部既有 mechanic 测试通过；fixture 其余行未改 |
| R19 | 目标测试 32 | **PASS** | 复核人重跑：1 file / 32 tests，exit 0 |
| R20 | 全量测试 2952 | **PASS** | 复核人重跑：178 files / 2952 tests，exit 0；0 skipped |
| R21 | typecheck / build / check:deps / check:links | **PASS** | 四项均 exit 0 |
| R22 | 回滚演练隔离、产品树回 base | **PASS** | drill branch `wayfinder/i03-u3-rollback-drill`；revert `b02b2ce` + `5ecb049`；`git diff 7b973a7 -- packages` 为空；整树也等于 base |
| R23 | 回滚后目标 25 | **PASS** | 复核人独立临时 worktree 重跑：1 file / 25 tests，exit 0 |
| R24 | 回滚后全量 2945 | **PASS** | 复核人独立临时 worktree 重跑：178 files / 2945 tests，exit 0 |
| R25 | delivery 分支未被污染 | **PASS** | drill 分支不包含于 delivery；delivery HEAD 仍 `82ba352`；工作树 clean |
| A1 | 自选断言 1：真实成功路径（existing NB + temporal evidence + gate BLOCKED）⇒ 公共 IE | **PASS** | last-train 真实 pack：`runTemporalAudit` 返回 `publicVerdict.verdict=INSUFFICIENT_EVIDENCE`、`coverage.temporal=unknown`、evidence 1 |
| A2 | 自选断言 2：真实降级路径（applicable + 无 evidence）⇒ 公共 IE | **FAIL** | 见 §4：`runTemporalAudit` 降级返回 `publicVerdict.verdict=NO_PROVEN_BLOCKER`，与 §4.2 / AC-07 / §4.5 冲突 |
| A3 | 自选断言 3：适用性由 config 决定（`temporalScope`） | **PASS** | `wide-patrol`/`last-train` ⇒ `applicable:true`；`danger-wide-idle` ⇒ `applicable:false` |

## 4. 阻断发现 A2：真实降级路径把层内 NB 作为权威公共字段

### 4.1 复现

用 head `b02b2ce` 的构建产物，直调生产函数：

```js
const audit = auditPlayability(widePatrolConfig, manifest);          // NO_PROVEN_BLOCKER
const report = runTemporalAudit({
  config: widePatrolConfig, manifest, packDir: emptyDir, existingAudit: audit,
});
// report.applicable = true
// report.coverage = "unknown"
// report.evidence = []
// report.verdict = "INSUFFICIENT_EVIDENCE"        （legacy 字段）
// report.publicVerdict.verdict = "NO_PROVEN_BLOCKER"
// report.publicVerdict.coverage.temporal = undefined
```

同一断言在真实 `last-train` config 上同样成立：

| 路径 | base `7b973a7` | head `b02b2ce` |
| --- | --- | --- |
| `auditPlayability(wide-patrol)` | IE（`mechanic:"partial"`） | NB（`mechanic:"checked"`） |
| `runTemporalAudit` 成功路径（真实 pack） | IE（existing IE 优先；未单独重跑） | IE（`publicVerdict` IE；`coverage.temporal=unknown`；evidence 1） |
| `runTemporalAudit` 降级路径（trusted 输入不可用 / analyzer 抛错） | `publicVerdict` IE | **`publicVerdict` NB** |

根因链：U3 移除 gap ⇒ `auditPlayability` 对移动 hazard 关卡从 IE 变 NB ⇒ U4 `temporalFailure()` 把 `existingAudit` 原样塞进 `TemporalAuditReport.publicVerdict`（`packages/assets/src/ops.ts`）⇒ U5 `publish-gate.ts` 把 `report.publicVerdict.verdict` 复制到 `PublishGateTemporalEvidence.verdict`。该字段在降级时没有经过 U2 `mapPublicVerdict`，因此没有按 `unknown ⇒ IE` 拉回。

### 4.2 违反的规范

- 授权包 §4.2：「有移动 Hazard，`coverage.temporal` 缺失 ⇒ 按 `unknown` ⇒ IE」；
- 授权包 §4.4：「缺失按 `unknown` ⇒ 在 `existing = NO_PROVEN_BLOCKER` 时拉成 IE」；
- 授权包 §4.5：「第一阶段 gate `BLOCKED` ⇒ 含移动 Hazard 的关卡仍是 IE」；
- 授权包 §7.1：「`runTemporalAudit` … 捕获失败降级为 `unknown` / IE 记录」；
- AC-07：「有移动 Hazard 而缺字段 ⇒ `unknown` ⇒ IE」；
- U3 brief §8 表：「公共聚合层 | `INSUFFICIENT_EVIDENCE` | temporal 证据经过 U2 mapper，且第一阶段 gate BLOCKED」。

当前降级路径绕过 U2 mapper，给出 `(verdict=NB, coverage=unknown, evidence=[])` 的不一致组合。U3 自身测试只覆盖了「applicable 但无 evidence」在 **mapper 入口**的行为，没有覆盖真实生产降级路径，因此作者证据不足以支撑「缺失时序结果不得错误放行」的端到端结论。

### 4.3 影响边界

- **不改变发布放行 / 拒稿**：U5 明确把 temporal 当诊断快照，`playabilityIssues` / `CommandError` 不消费 temporal；gate 仍 `BLOCKED`；`PUBLIC_NB` / `PUBLIC_PU` 未开放。
- **不影响** I-02 的 `publicCapability="BLOCKED"` / `publicResult=null`。
- **影响**发布闸暴露的时序诊断 `verdict`：在 trusted 输入不可用 / 分析器抛错的 degraded pack 上，可能显示 NB 而 coverage 为 unknown。
- 该路径由 U3 的行为变化暴露（base 时 `existingAudit` 为 IE，降级输出 IE）；修复点在 `packages/assets/src/ops.ts`，**不在 U3 白名单**。

### 4.4 建议

STOP + HITL，由用户在以下两种处置中选择：

1. **另开授权修 U4**：`temporalFailure` 在 `applicable:true`、无 evidence 时改走 `mapPublicVerdict({ existing, temporal:{applicable:true}, gate:PHASE1…, admission:PHASE1… })`，得到 IE + `coverage.temporal="unknown"`，并补真实 `runTemporalAudit` 降级回归测试；
2. **显式接受**该降级路径为「诊断字段可 NB、以 coverage=unknown 为准、不参与放行」，并在授权包 / U4 记录中写明；此时 A2 可降级为已知限制，但仍应在 U3 复核中留痕。

在用户裁定前，本复核不能签署 U3 PASS。

## 5. 命令与退出码

复核人亲自重跑（完整输出在 `/tmp`，hash 见 §6）：

| # | 命令 | 退出码 | 结果 |
| --- | --- | --- | --- |
| 1 | `pnpm exec vitest run packages/contracts/tests/playability-mechanic.test.ts` | **0** | 1 file / 32 tests passed |
| 2 | `pnpm test` | **0** | 178 files / 2952 tests passed；`Errors 3 errors`（3 条 `vitest-worker: Timeout calling "onTaskUpdate"`，runner 噪声）；0 skipped |
| 3 | `pnpm typecheck` | **0** | tsc -b + per-package spec tsconfig |
| 4 | `pnpm build` | **0** | 全部包 / bundle 完成 |
| 5 | `pnpm check:deps` | **0** | 依赖图合法（10 个包） |
| 6 | `pnpm check:links` | **0** | 相对链接零断裂（1252 份文档 · 4159 条链接） |
| 7 | 临时 worktree（drill `54a43be`）`pnpm exec vitest run ...playability-mechanic.test.ts` | **0** | 1 file / 25 tests passed |
| 8 | 临时 worktree（drill `54a43be`）`pnpm test` | **0** | 178 files / 2945 tests passed；2 条 `onTaskUpdate` runner 告警 |
| 9 | 临时 worktree（drill `54a43be`）`pnpm build` | **0** | 用于基线的真实路径对照 |

说明：

- 证据日志声明全量 2952 / 2 条 runner 告警；复核重跑为 2952 / 3 条同类告警，**不是测试失败**，按 runner 噪声单独记录（vitest 仍 exit 0）。
- `check:links` 证据为 1251 份文档，复核时为 1252；差异来自证据提交后新增的 `reports/U3-review-input.md`（本次复核报告尚未计入时），不是断链。
- drill 全量第一次在临时 worktree 重跑时，因 fresh worktree 缺少未跟踪的 `packages/demo/dist/shell.js` 出现 12 个 CLI/MCP 失败（exit 1）；补上工作树的 demo bundle 后重跑 2945 全绿（exit 0）。该失败是 worktree 环境缺构建产物，与 U3 / 回滚无关。

## 6. 复核输出与重跑日志 hash

| 输出 | SHA-256 |
| --- | --- |
| 本报告 `reports/U3-review.md` | 写入后计算，见交付消息 |
| targeted 重跑 `/tmp/u3-targeted-review.log` | `664b5064ff240599f8b34fa1b12daf2f0bc13705e6ec929e6b816a8ddae7d62d` |
| 全量重跑 `/tmp/u3-full-test-review.log` | `098b4dff07b20f4af0efaa86443517f08ad9abb86a551356dbfe4eb4de5fd4eb` |
| typecheck `/tmp/u3-typecheck-review.log` | `7c090ad0b0e1bd2df87f0b7425bb8967d5b944aa2d3b41ba69ca3f369afdaa79` |
| build `/tmp/u3-build-review.log` | `93b9cd54dfe6fbcb1b17823ec0f40de164c9f7f120ad544d59de70411ff32e34` |
| check:deps `/tmp/u3-check-deps-review.log` | `3d0dc5890b6b781d40dfe60d42610d40eb57b01010e1b56db37af0a74c8079c9` |
| check:links `/tmp/u3-check-links-review.log` | `31a026feb01c4bf5b577a40b4feb8c4dbdbfb199e03fc11c794f0254259d59c7` |
| drill targeted `/tmp/u3-drill-targeted-review.log` | `1076460e0be18f034d0c9a0bd136dfbc079a4bedb76ec894d0a389920cdf9b02` |
| drill full（成功）`/tmp/u3-drill-full-review2.log` | `e34d4d11139aac7dcd3de64217d09f6b57abb9910bec776b19784114a986a8e1` |
| drill build `/tmp/u3-drill-build-review.log` | `330644b3c4936b81726fad1fc4584e103eba36ff6bbbbe89ad3c62062a5e03ba` |

证据文件 hash（`evidence/U3/SHA256SUMS` 抽样，全部已 `shasum -c` 验证）：`targeted-test-output.txt 9de9e1e9…`、`test-output.txt e855690d…`、`rollback-drill.log fc8a6917…`、`commands.log 21da96f6…`。

## 7. 未覆盖项与限制

1. **真实 degraded pack 的发布闸端到端**未跑：A2 通过直调 `runTemporalAudit`（U4 集成点）与源码核对 U5 复制字段证明；未构造完整 pack + QA 报告走 `assertPublishableQa`。
2. `wide-patrol` 的**真实成功路径**没有专属 pack；U3 用 synthetic evidence + 真实 mapper，A1 用 `last-train` 真实 pack 补证。
3. Runtime / probe / fixtures 实施不在本单元授权范围，未复核。
4. 本地 `main` ref 停较旧提交；以 base `7b973a7` 与其祖先 `819bf1e` 的产品树比较代替。
5. 全量测试的 `onTaskUpdate` 告警为 runner 噪声，未进一步追根因。
6. 回滚全量的独立重跑依赖工作树中未跟踪的 `packages/demo/dist/shell.js`；已记录环境差异。
7. brief 无声明 hash，只有路径；复核人记录的是实测 hash。

## 8. 边界与独立签署

- 本报告 **FAIL** 的阻断项是 A2；它不否定 R1–R25 的具体结论，也不把「总通过率」当作结论。
- 本报告 **不**开放 `PUBLIC_NB` / `PUBLIC_PU`；**不**授权 probe / fixture 实施；**不**改变 gate / 发布闸 / 拒稿行为。
- 未修改任何产品代码、测试、fixture、授权包、证据、授权记录；唯一写入是本文件。
- 结论：**U3 暂不能签署为完成**；需用户对 A2 作出「另开 U4 修复授权」或「显式接受诊断降级」的裁定。若用户仅按原 U3 白名单范围裁定，则 R1–R25 支持三文件实现本身，但端到端「缺失时序结果 ⇒ IE」的证据不足。

独立签署：**fresh 独立复核代理** · 2026-11-16
