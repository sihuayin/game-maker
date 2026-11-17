# U3 独立复核报告（rerun · U4 amendment-02 后）

> 复核对象：I-03 实施 U3（contracts `mechanic.ts` 移除 `moving-hazard-phase` gap；temporal 层接管），在 U4 amendment-02 合入 `main` 后重核。
> 前一轮：`reports/U3-review.md` · `sha256:57607f39a67356eb8ba997047bb4722654f4ff39d1715c730f0bab5c0e77163d` · **FAIL**（A2 降级 `publicVerdict`）；本轮保留该报告不改。
> 结论：**PASS** —— U3 检查项 30/30 PASS、0 FAIL；另有 2 项越界能力项 NOT_RUN。
> 边界：本报告 PASS **只**表示 U3 证据足以支持该单元；**不**开放 `PUBLIC_NB` / `PUBLIC_PU`；**不**授权 probe / fixture 实施；不改变发布闸行为。

## 0. 复核人 / 日期 / 环境

| 项 | 值 |
| --- | --- |
| 复核人 | fresh 独立复核代理（未参与 U3 / U4 amendment-02 实施；未采信作者结论） |
| 日期 | 2026-11-17 |
| 仓库 | `/Volumes/shy/some-projects/game-maker` |
| 分支 / HEAD | `wayfinder/level-playability-v1.1-i03-u3` · `2b869b32bed37dd59c12e9b0f7f18a8c72f02979`（产品树等于 code head `55f7117`） |
| 环境 | Darwin 24.6.0 arm64（macOS 15.7.9）；node `v22.23.2`；pnpm `10.7.1`；vitest `3.2.7` |
| 工作树状态 | 复核开始时 clean；复核结束时只新增本报告；产品 / 证据 / 授权文件零修改 |

## 1. 输入 / 输出 hash

### 1.1 输入

| 输入 | SHA-256 / 值 | 结论 |
| --- | --- | --- |
| 授权包 `docs/v7.8/移动-I03.md` | `46cf181237f1dd3bf3bc30f839c62abb37f1f90787020ffcb445df8790b8c308` | 与输入包声明一致；PASS |
| U3 授权记录 `reports/U3-incremental-authorization.md` | `3c7a3c5ae8aaebafd2d85321c5b2916b345511f6231864e49793fa83349eeb49` | 无声明值，复核人自算；PASS |
| U3 brief `issues/06-i03-impl-u3.md` | `5e9ef583616bc0f65a627da39cc212f7498bded211af64ed617faad59a5280ae` | 无声明值，复核人自算；PASS |
| 复核输入 `reports/U3-review-input.md` | `8e1a1a4b93c8d321410cf7ae32d8d97df35330dfcb42ea56650849e6825f3ab4` | 无声明值，复核人自算；PASS |
| 前一轮 FAIL 报告 `reports/U3-review.md` | `57607f39a67356eb8ba997047bb4722654f4ff39d1715c730f0bab5c0e77163d` | 与输入包声明一致；PASS |
| U4 amendment-02 brief `reports/U4-brief-amendment-02.md` | `bdc6cb8357556ef2e2b1d44f79dbf55900b909774fa546f395a6ed959609d0e0` | 与 U4 review 记录一致；PASS |
| U4 amendment-02 review `reports/U4-amendment-02-review.md` | `ab15775230b1b1fbc7c5e1928979059fc495d1621261e56e066727f90c3bd09e` | 与输入包 / Ledger 声明一致；PASS |
| 证据清单 `evidence/U3/SHA256SUMS` | `18f4952a1e18e2ce52a29609fd0a37dbafc8da511abd9ee15df163a1cfd917cd` | 10/10 `shasum -c` OK；PASS |
| Base | `0e3a4567dc36b6ecd9823f678d1963f9b5742e51`（main，含 U4 amendment-02） | PASS |
| Code/test head | `55f7117b9f830a9e7f489394bf1ceb665e0f350a`（merge `82ba352` + main `0e3a456`） | PASS |
| Evidence head | `2b869b32bed37dd59c12e9b0f7f18a8c72f02979`（仅 `.scratch`） | PASS |
| `0e3a456..55f7117` 产品 diff | `a3a975261ec20776aa7701a21fdb048f897253c5c4b5580b0551609f0cebf983` | 与上一轮已复核 U3 diff 相同；PASS |
| `0e3a456..55f7117` 完整 diff | `49b8065fca8d18002b4f546f3558b611fb8bbebc481e4c25d285297964478aa3` | PASS |

### 1.2 输出 / 复核运行日志

| 输出 | SHA-256 |
| --- | --- |
| 本报告 `reports/U3-review-rerun.md` | 写入后计算，见交付消息 |
| targeted `/tmp/u3r-targeted.log` | `e566d4a4a8cbb971547f02677d536d3daff04fd8b226a637381c676e427c091d` |
| full `/tmp/u3r-fulltest.log` | `9925a1b86d9e6ec2b6bb1d14e386e3db65bc27878fb87157fba7a44ba1a448af` |
| typecheck `/tmp/u3r-typecheck.log` | `7eb130c05c00809aef2d3bb703f761aa237b19dfbd3562aca4c927eb93e5b31a` |
| build `/tmp/u3r-build.log` | `b9b703bf67269b6020271523d4bba93a40146723c46f0d85a4dedc0ccc8f189c` |
| check:deps `/tmp/u3r-deps.log` | `3d0dc5890b6b781d40dfe60d42610d40eb57b01010e1b56db37af0a74c8079c9` |
| check:links `/tmp/u3r-links.log` | `0172d506d1a23a3ad471b86247e9f1583a5cf02aaf561bcc9f463646624999ab` |
| drill targeted `/tmp/u3r-drill-targeted.log` | `d5537bd345ef7ca144a7c821ce6bc6a8efac5b963bdb9bdaa1978997138c46a0` |
| drill full `/tmp/u3r-drill-full.log` | `4c209cfd69a754f2129fa46f27615462ac429fa953ace8d2b690e8b192d9c3a1` |
| A2 direct `/tmp/u3r-a2-check.mjs` | `6222212dfe3845455f26b67753912964b094033c32e6f128aff5e69e947908b9` |
| U5 degraded E2E `/tmp/u3r-u5-degraded.mjs` | `cc646083a91efe2f0f337059d526e6d18c876d3d5bea0153e5ce5015778cff96` |
| mapper states `/tmp/u3r-mapper-check.mjs` | `daffc4e1178af2bdfe50b26d62b9dd95c5dd989c63f97f58fa9461fac117e5e5` |

## 2. Diff scope（`0e3a456..55f7117`）

`git diff --name-status 0e3a456..55f7117 -- packages` **只有 3 个文件**（与输入包一致）：

1. `packages/contracts/src/playability/mechanic.ts`
2. `packages/contracts/tests/playability-mechanic.test.ts`
3. `packages/contracts/tests/fixtures/playability-mechanic-matrix.json`

零 diff / 未漂移核对：

- 逐路径 `git diff --quiet`（`api.ts` / `verdict.ts` / `public-verdict.ts` / `temporal.ts` / `temporal-evidence.ts` / `temporal-result.ts` / `assets/src/ops.ts` / `publish-gate.ts` / `create-game.ts` / `packages/cli` / `packages/mcp`）退出码 0；
- `package.json` / lockfile / tsconfig / `docs/**` 在 U3 diff 中零变化；
- 非 `packages` 的 diff 只有 `.scratch/.../evidence/U3/*` 与 `reports/U3-review-input.md`（证据 / 输入包），无产品内容；
- `55f7117` 是 merge commit：父提交 `82ba352`（U3 evidence head）与 `0e3a456`（main，含 U4 amendment-02）；`b02b2ce..55f7117 -- packages` 只有 U4 的 `ops.ts` + `ops.test.ts`（merge main），U3 三文件未被 merge 改写；
- `2b869b3` 是 evidence-only commit（父 `55f7117`），只改 `.scratch`，并把上一轮 FAIL 报告归档进 git。

Fixture 深比较（base `0e3a456` vs head `55f7117`）：

- 其余 5 行（`static-hazard-seals-path`、`danger-full-wall`、`danger-wide-idle`、`pickup-in-static-hazard`、`moving-platform`）与 `manifest` 逐字不变；
- `wide-patrol` 的 `config` / `evidence` / `legalPair` 不变；只有 `expectedVerdict="NO_PROVEN_BLOCKER"`、`expectedJudgmentId=null`、`expectedGap=null`、`failureLocation=null`、`note` 五处断言字段变化。

## 3. 逐项结论（不得以总通过率替代）

| ID | 检查项 | 结论 | 依据 |
| --- | --- | --- | --- |
| R1 | 授权包当前 hash `46cf1812…` | **PASS** | 实测一致 |
| R2 | U3 授权记录 / brief / 复核输入 hash | **PASS** | 实测记录；记录内嵌 `8a8349b1…` 为签署时历史值，见 §7 |
| R3 | `evidence/U3/SHA256SUMS` 完整性 | **PASS** | 10/10 OK，exit 0 |
| R4 | diff 只落白名单三文件 | **PASS** | `-- packages` name-status 仅 3 文件 |
| R5 | `api.ts` / `verdict.ts` / `public-verdict.ts` / U1 / U4 / U5 / CLI / MCP / `create-game.ts` 零 diff | **PASS** | 逐路径 `git diff --quiet` exit 0 |
| R6 | fixture 仅 `wide-patrol` 行变化，其余五行逐字不变 | **PASS** | JSON 深比较；manifest 不变 |
| R7 | `mechanic.ts` 精确删除 `movingHazards` 与 `moving-hazard-phase` | **PASS** | diff 精确删除两行；产品 src 仅注释残留字符串 |
| R8 | `allHazards` / `staticHazards` / `movingSolids` 保留 | **PASS** | 源码核对 |
| R9 | `moving-platform-unsupported` 仍在 | **PASS** | 源码 + `moving-platform` fixture 实测 gap / partial / IE |
| R10 | `wide-patrol` 层内 NB + `coverage.mechanic="checked"` + evidence 为空 | **PASS** | 独立 dist 直调：`{verdict:"NO_PROVEN_BLOCKER",coverage:"checked",gaps:[],evidence:[]}` |
| R11 | 公共路径经真实 `mapPublicVerdict` + `PHASE1_CAPABILITY_GATE/ADMISSION` ⇒ IE | **PASS** | 测试 + 独立 mapper 断言；gate 两项 BLOCKED / admission 两项 false |
| R12 | applicable + `checked` + `nb-candidate` ⇒ IE；`partial` / `unknown` ⇒ IE | **PASS** | 独立 mapper 状态矩阵：四种组合均 IE |
| R13 | applicable 但无 evidence ⇒ `temporal:"unknown"` ⇒ IE | **PASS** | 独立 mapper：IE / temporal unknown |
| R14 | 不适用 ⇒ existing，且无 temporal / geometry 字段 | **PASS** | `danger-wide-idle` + applicable:false：NB、两字段 undefined |
| R15 | gate `BLOCKED` 时 nb / pu candidate 均不产公共 NB / PU | **PASS** | 独立 mapper：nb / pu candidate 均 IE |
| R16 | synthetic temporal evidence 符合 U1 真实类型、无 `as any` | **PASS** | 字段与 `verdict.ts` 类型一致；grep 无 `as any` / ts-ignore；typecheck 0 |
| R17 | 公共 IE 上 `playabilityIssues` 为空；temporal 非阻断 | **PASS** | 测试 + 独立断言 `[]` |
| R18 | 其他 mechanic 语义不变（静止 hazard A、danger B、moving-platform、矩阵其余行） | **PASS** | 矩阵 6 例 + 全部既有 mechanic 测试通过；fixture 其余行未改 |
| R19 | 目标测试 32 | **PASS** | 独立重跑：1 file / 32 tests，exit 0 |
| R20 | 全量测试 2952 | **PASS** | 独立重跑：178 files / 2952 tests，exit 0；0 skipped |
| R21 | typecheck / build / check:deps / check:links | **PASS** | 四项 exit 0 |
| R22 | drill v2 隔离、产品树回 base | **PASS** | `wayfinder/i03-u3-rollback-drill-v2` @ `b369f67`；revert `b02b2ce` + `5ecb049`；产品树等于 `0e3a456` |
| R23 | drill v2 目标 25 | **PASS** | 独立临时 worktree 重跑：1 file / 25 tests，exit 0 |
| R24 | drill v2 全量 2945 | **PASS** | 独立临时 worktree 重跑：178 files / 2945 tests，exit 0 |
| R25 | delivery 分支未被污染 | **PASS** | drill 分支不包含于 delivery；HEAD `2b869b3`；工作树 clean |
| A1 | **前一轮 FAIL A2 闭合**：existing NB + trusted 失败 ⇒ publicVerdict IE / coverage unknown / evidence [] | **PASS** | wide-patrol 与 last-train 实跑均通过；见 §4.1 |
| A2 | existing NB + analyzer 抛错 ⇒ publicVerdict IE / coverage unknown / evidence [] | **PASS** | U4 回归测试「真实 analyzer 抛错」实跑通过；同一 `catch → temporalFailure` 路径 |
| A3 | U5 `PublishGateTemporalEvidence` 不再记录 NB | **PASS** | 端到端 degraded publish-gate 实跑：temporal `{applicable:true,coverage:"unknown",verdict:"IE",evidence:[]}`；见 §4.3 |
| A4 | U4 修复在 base / head 均保留，U3 diff 未触碰 | **PASS** | `ops.ts` hash 在 `0e3a456` 与 `55f7117` 均为 `587dca3e…`；diff 仅 3 个 U3 文件 |
| A5 | 适用性来源与 mapper 状态矩阵独立断言 | **PASS** | `temporalScope` wide/last-train true、danger-wide-idle false；mapper 四种 temporal 状态均符合 §4.2 |
| N1 | 能力开放 / `PUBLIC_NB` / `PUBLIC_PU` / gate 变更 | **NOT_RUN** | 越界；明确不授权，不作为 U3 证据 |
| N2 | probe / fixtures 实施 | **NOT_RUN** | 越界；明确不授权，不作为 U3 证据 |

## 4. 前一轮 FAIL A2 的闭合验证

### 4.1 trusted 输入不可用（existing NB）

用 head 构建产物直调真实生产函数，`packDir` 指向空目录：

| config | existing audit | publicVerdict | coverage.temporal | public evidence | 复用 existing 对象？ |
| --- | --- | --- | --- | --- | --- |
| `wide-patrol` | `NO_PROVEN_BLOCKER` | `INSUFFICIENT_EVIDENCE` | `unknown` | `[]` | 否 |
| `last-train`（真实 fixture） | `NO_PROVEN_BLOCKER` | `INSUFFICIENT_EVIDENCE` | `unknown` | `[]` | 否 |

`report.coverage="unknown"`、`report.evidence=[]`、legacy `report.verdict="INSUFFICIENT_EVIDENCE"`。**前一轮的 `publicVerdict=NO_PROVEN_BLOCKER` 已消失。**

### 4.2 analyzer 抛错（existing NB）

实跑 U4 回归测试 `packages/assets/tests/ops.test.ts -t "真实 analyzer 抛错"`（vitest `vi.doMock` 注入 `analyzeTemporalInternalTwoLag` 抛出）：断言 `publicVerdict.verdict=IE`、`coverage.temporal="unknown"`、`publicVerdict.evidence=[]`，测试通过。该异常与 trusted 失败都经外层 `catch → temporalFailure()`，修复代码在两条路径共同生效。

### 4.3 U5 发布闸端到端（degraded pack）

复核人独立构造端到端场景：复制 `fixtures/packs/last-train/v2`，删除 `delivery/atlas.*.json`（保留 `manifest.json`，manifest checksum 不变），写入合法 QA 报告，走真实 `assertPublishableQa`：

```text
temporal = {
  applicable: true,
  coverage: "unknown",
  verdict: "INSUFFICIENT_EVIDENCE",
  evidence: []
}
```

U5 源码第 179 行 `verdict: report.publicVerdict.verdict` 为直接复制；结合 §4.1/§4.2 的 IE 输出，`PublishGateTemporalEvidence.verdict` **不会再记录 NB**。

### 4.4 修复代码与规范

`packages/assets/src/ops.ts` 的 `temporalFailure` 已改为：

```ts
publicVerdict: mapPublicVerdict({
  existing: existingAudit,
  temporal: { applicable: true },
  gate: PHASE1_CAPABILITY_GATE,
  admission: PHASE1_CAPABILITY_ADMISSION,
}),
```

符合授权包 §4.2（temporal 缺失 ⇒ unknown ⇒ IE）、§4.4、§4.5、§7.1 与 AC-07。发布放行 / 拒稿路径仍不消费 temporal；gate 仍 `BLOCKED`；未开放任何能力。

## 5. 命令与退出码

复核人亲自重跑（工作树 HEAD `2b869b3`，产品树等于 `55f7117`）：

| # | 命令 | 退出码 | 结果 |
| --- | --- | --- | --- |
| 1 | `pnpm exec vitest run packages/contracts/tests/playability-mechanic.test.ts` | **0** | 1 file / 32 tests passed |
| 2 | `pnpm test` | **0** | 178 files / 2952 tests passed；3 条 `onTaskUpdate` runner 告警；0 skipped |
| 3 | `pnpm typecheck` | **0** | 全部 workspace `Done` |
| 4 | `pnpm build` | **0** | 全部包 / bundle 完成 |
| 5 | `pnpm check:deps` | **0** | 依赖图合法（10 个包） |
| 6 | `pnpm check:links` | **0** | 相对链接零断裂（1254 份文档 · 4159 条链接） |
| 7 | drill worktree（`b369f67`）targeted | **0** | 1 file / 25 tests passed |
| 8 | drill worktree（`b369f67`）`pnpm test` | **0** | 178 files / 2945 tests passed；3 条 runner 告警 |
| 9 | `pnpm exec vitest run packages/assets/tests/ops.test.ts` | **0** | 1 file / 21 tests passed（含两条降级回归） |
| 10 | `pnpm exec vitest run packages/pipeline/tests/publish-gate.test.ts -t "G1/G4\|G5\|G11"` | **0** | 3 passed / 26 skipped；真实 last-train temporal verdict IE |
| 11 | A2 direct trusted-failure 脚本（wide-patrol + last-train） | **0** | `A2_DIRECT=PASS` |
| 12 | U5 degraded publish-gate 端到端脚本 | **0** | `E2E_DEGRADED_U5=PASS` |
| 13 | mapper 状态矩阵 / temporalScope 独立脚本 | **0** | `MAPPER_STATES=PASS` |

说明：

- 全量 / drill 的 `Errors` 计数来自 `vitest-worker: Timeout calling "onTaskUpdate"`，为 runner 噪声，非测试失败；三次运行分别 3 / 3 条告警，均 exit 0。
- drill v2 独立全量在临时 worktree 中复用主工作树 `node_modules` 与 `packages/demo/dist`（未跟踪构建产物）；该环境方式已记录，drill 产品树与 base 逐字相等。

## 6. 自选关键断言（理由与结果）

| 断言 | 理由 | 结果 |
| --- | --- | --- |
| A1 trusted 失败 + existing NB（wide-patrol / last-train）⇒ IE / unknown / []，且 `publicVerdict !== existingAudit` | 直接闭合上一轮 FAIL；同时验证不是“对象原样复制” | **PASS** |
| A2 analyzer 抛错 + existing NB ⇒ IE / unknown / [] | 覆盖第二条降级入口，防止只修 trusted 路径 | **PASS**（U4 回归测试实跑） |
| A3 degraded pack 走真实 `assertPublishableQa` ⇒ U5 temporal verdict IE / unknown / [] | 证明 U5 消费链不再记录 NB，而不仅是 U4 单元行为 | **PASS** |
| A4 独立 mapper 状态矩阵 + `temporalScope` | 防止 synthetic evidence 只在特定组合成立；确认适用性由 config 决定 | **PASS** |

## 7. 未覆盖项与限制

1. **analyzer 抛错**通过 U4 回归测试的 `vi.doMock` 注入复现，未另写独立进程 harness；其与 trusted 失败共用 `catch → temporalFailure`，静态路径已核对。
2. **U4 amendment-02 review 文件**位于证据分支 `origin/wayfinder/i03-u4-amendment-02-evidence`（commit `d3eb69c`），不在 main 产品树；复核人按声明 hash `ab157752…` 校验了该文件内容。`.scratch` 不进产品 PR 符合既定策略。
3. U3 授权记录内嵌授权包 hash `8a8349b1…` 是签署时值；当前包 `46cf1812…` 已包含 U4 amendment-02 Ledger。记录未重写，属预期历史差异。
4. 输入包 §5 item 6 仍写 `reports/U3-review.md`；按协调指令写 `reports/U3-review-rerun.md` 并保留原 FAIL 报告，未覆盖归档文件。
5. 端到端 U5 降级场景只模拟“atlas 元数据缺失”触发 trusted 失败；未单独构造 digest 不符 / 损坏字节变体，但均走同一 `temporalFailure`。
6. Runtime / probe / fixtures 实施不在本单元授权范围，未复核。
7. 全量测试的 `onTaskUpdate` 告警未进一步追根因。
8. drill 独立全量依赖临时 worktree 中未跟踪的 `packages/demo/dist`；已在 §5 说明。
9. 本报告自身 hash 无法内嵌，见交付消息。

## 8. 边界与独立签署

- 本报告 PASS **只**表示 U3 证据足以支持该单元；不表示 U3 已签署 / 合并 / 更新 Ledger。
- **不**开放 `PUBLIC_NB` / `PUBLIC_PU`；**不**授权 probe / fixture 实施；**不**改变 gate / 发布闸 / 拒稿行为。
- 未修改任何产品代码、测试、fixture、授权包、证据、授权记录；唯一写入是本文件。
- 结论：**PASS** —— 前一轮 FAIL A2 已由 U4 amendment-02 修复并在真实 U4 / U5 路径上独立复验；U3 三文件实现、证据与回滚演练均支持该单元。

独立签署：**fresh 独立复核代理** · 2026-11-17
