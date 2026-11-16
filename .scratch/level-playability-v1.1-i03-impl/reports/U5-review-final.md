# I-03 U5 独立复核报告（最终确认）

> **复核对象**：U5（pipeline `publish-gate` 时序诊断字段，非阻断）· final product head `739076a`
> **复核人**：fresh 独立复核会话（Claude Agent；未参与 U5 实施，未采信变更说明或作者结论）
> **日期**：2026-11-16
> **环境**：Darwin 24.6.0 arm64 · Node v22.23.2 · pnpm 10.7.1 · vitest 3.2.7
> **结论**：**PASS**（R1–R29 逐项 PASS；无 FAIL、无 NOT_RUN；限制见 §8）

本报告是最终确认复核；初始 `reports/U5-review.md`（`7b6d8023…`）与
`reports/U5-review-rerun.md`（`6ce87eb3…`）均保留、未覆盖。本 PASS **只**表示 U5 证据足以
支持该单元；不授权 U3，不开放 `PUBLIC_NB` / `PUBLIC_PU`，不授权 probe / fixture 实施。

---

## 1. 输入、基线与 hash 核对

### 1.1 输入文件

| 输入 | 期望值 / 说明 | 现场 SHA-256 | 结果 |
| --- | --- | --- | --- |
| `docs/v7.8/移动-I03.md` | 当前 `5e3fa97f…`；签署前 `2f89d572…` / 签署后 `f45332be…` | `5e3fa97f4ae855ef37a18c3aabd708ed28f250af1184c466eaadc890935d6f24` | **PASS** |
| `reports/U5-incremental-authorization.md` | `45e72c93…` | `45e72c93537d9052ba69d1903563dc722aaee914eb743c125a212b8b6f17c1b0` | **PASS** |
| `issues/05-i03-impl-u5.md` | 输入包未给定期望 hash | `0bd67859448a42cf09d5d5a668cb5ea799a6195e564174dab7928278204b9d50` | **PASS（记录）** |
| `reports/U5-review-input.md`（最终版） | head `739076a`；`typecheck` 入证据 | `5e186d05034380bc65011afb075db6290b7e942fbaca31cb3d3b38a52452bc90` | **PASS（记录）** |
| 初始报告 `reports/U5-review.md` | 保留、不得覆盖 | `7b6d8023b8ed505fa3e08087062233af06fd4ce62abc34a5eec324dff893b382` | **PASS（未改）** |
| 修订报告 `reports/U5-review-rerun.md` | 保留、不得覆盖 | `6ce87eb38a4c8dc828b90de3273b47a1ce3391d49c77a9a8364dab0bafe4be3e` | **PASS（未改）** |
| `evidence/U5/SHA256SUMS` 自身 | 10 文件 | `11b3cb6d1fcdc02aa91bc6162abe8c2db39e4513f4b48138c858e0a206ef4d27` | **PASS** |

授权包历史版本仍可在仓库历史定位：签署前 `583c777`（`2f89d572…`）、签署后 `9a3d520`
（`f45332be…`）、当前 `808f7a5`（`5e3fa97f…`）。

### 1.2 证据 hash（10 文件）

```bash
cd .scratch/level-playability-v1.1-i03-impl/evidence/U5 && sha256sum -c SHA256SUMS
```

结果：**exit 0**；`commands.log`、`invariant-before.txt`、`invariant-after.txt`、
`targeted-test-output.txt`、`test-output.txt`、`typecheck.log`、`rollback-drill.log`、
`build.log`、`check-deps.log`、`check-links.log` 共 **10/10 OK**。

### 1.3 基线与最终 head

| 项 | 值 |
| --- | --- |
| Base | `41df0d3e65f4716d1b55d39d1ee1517287fc4e6e` · tree `08337f4034e80c93f776865e9ea9fc75e651989a` |
| `main` @ `f4e6ce7` tree | `08337f4034e80c93f776865e9ea9fc75e651989a`（与 base 相同） |
| Code head | `fcea791`（产品源码未变） |
| Test head | `57ff6de` → `e792e47`（G3）→ `df3564f`（CI typecheck 修正） |
| **Final product head** | **`739076a33b2726557183b7d030081b4a5490eeb2`**（parents: `df3564f` + `f4e6ce7`） |
| 证据归档分支 | `wayfinder/i03-u5-evidence` @ `b610c7d815f7f6e2a4bd712e9897966ac919a7ea` |
| 当前工作树 | `wayfinder/level-playability-v1.1-i03-u5` @ `b610c7d`；复核开始时 `git status` clean（复核报告为唯一新增未跟踪文件） |
| 当前产品树 vs `739076a` | `git diff --stat 739076a..HEAD -- packages` 为空 |

---

## 2. 修订链与差异

### 2.1 最终提交链

```text
41df0d3  base（授权 docs）
  └─ fcea791  source：publish-gate 诊断字段（48+/15-）
      └─ 57ff6de  test：G1–G11 + 变异守卫（179+/2-）
          └─ e792e47  test-only G3（19+/1-，cherry-pick 自 d8b5df1）
              └─ df3564f  test-only CI typecheck 修正（7+/5-）
                  └─ 739076a  merge main；无文件变化
```

### 2.2 `e792e47`：G3 独立化（test-only）

- 只改 `packages/pipeline/tests/publish-gate.test.ts`；`packages/pipeline/src` 零改动。
- G2 / G3 拆开；G3 构造 `pu-candidate` 的 `PlayabilityEvidence`，断言放行（返回结果）且
  `temporal.evidence[0].witness.result === "pu-candidate"`。
- **与 `d8b5df1` 的关系**：`e792e47:packages` tree 与 `d8b5df1:packages` tree 相同
  （`1fcf030c…`），测试文件 blob 相同；但**完整 tree 不同**——`d8b5df1` 的历史含
  `b624a95` 的 `.scratch` 证据，而干净分支 `739076a` 不含。协调者所说“tree 相同”仅在
  product/test tree 意义上成立；完整 tree 的差异是移除 `.scratch` 证据所致。

### 2.3 `df3564f`：CI typecheck 修正（test-only）

```text
git show --stat df3564f
 packages/pipeline/tests/publish-gate.test.ts | 12 +++++++-----
 1 file changed, 7 insertions(+), 5 deletions(-)
```

- 新增 `type TemporalWitness = Extract<PlayabilityEvidence["witness"], { kind: "temporal" }>`
  与 `temporalWitness(result)` 辅助函数；
- `TEMPORAL_EVIDENCE.witness` 与 G3 的 `puEvidence.witness` 都走该辅助函数，避免对象 spread
  把 witness 展宽成 union（原 CI 报 `result` 不在 `no-path` 分支）。
- test-only；无 `as any`；`pnpm typecheck` 现场 exit 0。

### 2.4 `739076a`：merge `main`

- parents：`df3564f` + `f4e6ce7`；
- `git diff --stat df3564f 739076a` 为空：merge 不引入文件变化。

---

## 3. Diff scope

### 3.1 产品 diff（最终 clean branch）

```bash
git diff --name-status 41df0d3..739076a
```

```
M	packages/pipeline/src/publish-gate.ts
M	packages/pipeline/tests/publish-gate.test.ts
```

完整 diff **只有两文件，且没有 `.scratch` 证据**。`git diff --stat 41df0d3..739076a -- packages`：
source `63` 行变更（48+/15-），test `201` 行变更（199+/2-）；两文件合计 247 insertions / 17 deletions。

### 3.2 白名单外零 diff

```bash
git diff --stat 41df0d3..739076a -- \
  packages/contracts packages/assets packages/cli packages/mcp \
  packages/pipeline/src/create-game.ts scripts docs package.json pnpm-lock.yaml \
  tsconfig.json fixtures
# 输出为空
```

`packages/pipeline/src` 在 `fcea791..739076a` 之间零 diff（`fcea791` 即最终产品源码）。

---

## 4. 逐项复核

### R1 — 输入 / 证据 hash

**PASS。** 见 §1。授权包当前与历史版本、U5 授权记录、brief、最终输入包均与仓库内容一致；
`evidence/U5/SHA256SUMS` **10/10** 通过。

### R2 — 最终产品 diff 只在白名单两文件

**PASS。** 见 §3。contracts / assets / CLI / MCP / `create-game.ts` / fixtures / scripts /
docs / 包清单零 diff。

### R3 — 干净产品分支不含 `.scratch` 证据

**PASS。** `41df0d3..739076a` 完整 diff 只有两文件；证据归档在独立分支
`wayfinder/i03-u5-evidence` @ `b610c7d`，未混入产品 diff。

### R4 — `df3564f` 确为 test-only

**PASS。** commit 只改 `packages/pipeline/tests/publish-gate.test.ts`（7+/5-）；
`packages/pipeline/src` 零 diff；无 `as any`。

### R5 — `e792e47` 与 `d8b5df1` 的等价范围

**PASS（带精确范围）。** `e792e47:packages` tree 与 `d8b5df1:packages` tree 相同，测试文件
blob 相同；完整 tree 因移除 `.scratch` 证据而不同。产品/test 语义等价。

### R6 — `739076a` merge 无文件变化

**PASS。** `git diff --stat df3564f 739076a` 为空；parents 正确。

### R7 — 既有测试断言未改

**PASS。** base `it()` 17 条；最终 29 条。G3 拆分的 1 行删除是原 `G2/G3` 用例标题改名；
G2 断言主体未动；其余为新增 G3 与 typecheck 辅助函数。G1/G4/G5/G6/G7/G8/G9/G10/G11 与
变异守卫断言未改。

### R8 — `configProblem` 结构化返回

**PASS。** `configPath` 缺省 / JSON 解析失败 / `parseGameConfig` 失败 ⇒ `{}`（字段缺席）；
硬失败 ⇒ `{ problem }`，不调用 temporal；硬检查通过 ⇒ `{ temporal }`。`problem` 与
`temporal` 独立，`temporal` 不进入异常消息。

### R9 — 三态语义

**PASS。**

| 状态 | 含义 | 现场证据 |
| --- | --- | --- |
| 缺席 | temporal 未运行 | G6 / G8 / G9；复核人自选 B / C |
| `{ applicable:false }` | 已运行、不适用 | G7；`applicable:false` 用例 |
| `{ applicable:true, coverage, verdict, evidence }` | 已运行且适用 | G1/G4、G2、G3、G5、G10、G11 |

`applicable:false` 不被读成 PU / NB；用例直接 `toEqual({applicable:false})`。

### R10 — 硬失败与 QA 拒稿不运行 temporal

**PASS。** G8 / G9 均断言 `mocks.calls === 0` 且仍抛 `CommandError("invalid")`；源码中
`verdictProblem` 早于 `configProblem`，硬失败早于 `runTemporalAudit`；TD config 仍提前跳过。

### R11 — `existingAudit` 复用本次 audit

**PASS。** `configProblem` 只调用一次 `auditPlayability`，把同一 `audit` 传给
`runTemporalAudit({ ..., existingAudit: audit })`。静态断言：`auditPlayability(` 1 次、
`runTemporalAudit(` 调用点 1 处；U4 真实路径不重复三维审计。

### R12 — 诊断来源只用 U4 公共字段

**PASS。** 源码只读取 `report.coverage`、`report.publicVerdict.verdict`、`report.evidence`；
未使用 legacy `report.verdict` / `report.degradation`；未暴露完整 `TemporalAuditReport`。
复核人运行时断言（真实 last-train）：`temporal` 键恰好为
`["applicable","coverage","evidence","verdict"]`，无 `publicVerdict` / `degradation` 泄漏。

### R13 — 条件 spread，无 `temporal: undefined`

**PASS。** 末尾使用
`...(configResult.temporal !== undefined ? { temporal: configResult.temporal } : {})`；
未传 `configPath` / 解析失败 / 硬失败时结果中不存在 `temporal` 键。

### R14 — 变异守卫：fake `PROVEN_UNPLAYABLE` + `checked`

**PASS。** G10 注入公共 `PROVEN_UNPLAYABLE`、`coverage:"checked"` 的 fake report，
`assertPublishableQa` **正常返回**（不因 temporal 拒稿、不抛），仅记录该值。

### R15 — 源级：`CommandError` / `playabilityIssues` 不消费 temporal

**PASS。** 测试内源级断言通过；复核人静态核验 `new CommandError(...)` 与
`playabilityIssues(...)` 均不含 `temporal`。硬失败消息只来自 `configResult.problem`。

### R16 — fake report 类型与无 `as any`

**PASS。** `fakeReport` 返回 `TemporalAuditReport`，over 参数为
`Partial<Extract<TemporalAuditReport, { applicable: true }>>`；G3 的 `puEvidence` 显式标注
`PlayabilityEvidence`，witness 走 `TemporalWitness` 精确类型。U5 source/test 均无 `as any`。

### R17 — mock 默认委托实际 `runTemporalAudit`

**PASS。** `vi.mock` 默认分支调用 `actual.runTemporalAudit(args)`，仅 `useFake` 时替换；
G1/G4 真实 fixture 用例走实际实现；`beforeEach` 重置 mock 状态。

### R18 — G1–G11 与 fake report 对应关系

**PASS。** G2 与 G3 各自独立：

| 门 | 现场用例 | 关键断言 | 结果 |
| --- | --- | --- | --- |
| G1 / G4 | 真实 last-train | `applicable:true`；coverage ∈ checked/partial/unknown；IE；temporal witness | PASS |
| G2 | nb-candidate + BLOCKED | fake 公共 IE；仍放行；记录 IE | PASS |
| G3 | pu-candidate + BLOCKED | fake 公共 IE；仍放行；`pu-candidate` 证据透传 | PASS |
| G5 | 降级报告 IE / unknown | coverage unknown、evidence []；不抛 | PASS |
| G6 | 无 `configPath` | `"temporal" in got === false`；`calls === 0` | PASS |
| G7 | 无移动 Hazard | 精确等于 `{applicable:false}` | PASS |
| G8 | 硬失败 | `invalid`；消息匹配；`calls === 0` | PASS |
| G9 | QA 先拒稿 | `invalid`；消息匹配；`calls === 0` | PASS |
| G10 | temporal PU + checked | 返回而非抛；记录 PU / checked | PASS |
| G11 | 证据缺省 | coverage unknown、evidence [] | PASS |
| 补充 | applicable:false 非 PU/NB | 精确等于 `{applicable:false}` | PASS |
| 补充 | 源级守卫 | 两条正则均不匹配 | PASS |

G3 标题称 “gate BLOCKED”，fake report 是 U4/U2 的公共输出、内部不携带 gate 字段；U5 只
消费公共 `verdict` / `coverage` / `evidence`，因此以公共 IE 输出表达该场景，可接受。

### R19 — 发布行为 / 退出码 / 报告落盘不变

**PASS。** 只新增可选诊断字段，不新增 `throw`；现有 `CommandError` 路径、消息、退出码
（`invalid` ⇒ 4）与 QA 报告落盘逻辑未改；TD 配置仍 `return undefined`。

### R20 — 不落盘 / 不进 CLI / MCP / 不升契约 / 公共能力仍 BLOCKED

**PASS。** U5 新增的 `PublishGateTemporalEvidence` / `PublishGateResult.temporal` 只出现在
`packages/pipeline/src/publish-gate.ts`；U5 diff 未新增其他产品引用；无 temporal 的
`fs.write*`、无 CLI / MCP 输出改动、无 sidecar / `qa-report` 变更。contracts / assets /
CLI / MCP diff 为零。不变量现场复核：

- `public-verdict.ts` `ec67f5a7…`、`api.ts` `52ccef05…`、`verdict.ts` `343f8e24…`、
  `ops.ts` `6105ca72…`、`create-game.ts` `d4f5edf7…`：base 与 `739076a` 相同；
- `packages/cli` tree `084c5c20…`、`packages/mcp` tree `5e3abfaf…`：base 与 `739076a` 相同；
- `publicCapability: "BLOCKED"`、`publicResult: null` 未改写。

### R21 — 目标测试 29

**PASS。** 现场重跑 `1 file / 29 tests passed`，exit 0。

### R22 — 全量测试 178 files / 2945 tests

**PASS。** 现场重跑 `178 passed / 2945 passed`，exit 0。出现 **3 条**
`[vitest-worker]: Timeout calling "onTaskUpdate"` runner 告警，按任务要求单独记录为
runner 噪声，未与测试失败混淆（`Tests 2945 passed`，无 failed test）。

### R23 — `pnpm typecheck`

**PASS。** 现场重跑 exit 0；`tsc -b` + 10 个 workspace package 的 `tsconfig.spec.json`
全部 Done。`df3564f` 的 witness 类型修正解决了 `d8b5df1` 上的 `result` union 展宽错误。

### R24 — build / check:deps / check:links

**PASS。** 三条命令现场重跑均 exit 0；`check:deps` 10 个包；`check:links` 1253 份文档 /
4159 条链接零断裂（与最终证据一致）。

### R25 — drill 分支与 product tree

**PASS。** drill 分支 `wayfinder/i03-u5-rollback-drill` @ `4e20e1c`，从 `739076a` 依次
revert `df3564f` / `e792e47` / `57ff6de` / `fcea791`：

- `git diff --stat 41df0d3 wayfinder/i03-u5-rollback-drill -- packages`：**空**；
- `git diff --stat 41df0d3 wayfinder/i03-u5-rollback-drill`：**空**（clean 分支无 `.scratch`
  证据，完整 tree 也等于 base）；
- `41df0d3:packages` tree 与 drill `:packages` tree 均为 `39aa005b…`：**相同**。

### R26 — 回滚后 17 / 2933

**PASS（targeted 独立重跑；全量按证据日志 + 树一致 + 算术交叉核对）。**

- 复核人在临时 worktree 独立重跑 drill 目标测试：`17 tests passed`，exit 0；
- drill 证据全量：`178 files / 2933 tests passed`，exit 0；
- `2945 − 新增 12 条 U5 测试 = 2933`，与日志一致。

### R27 — Delivery / evidence 分支未被污染

**PASS。** 产品分支 `739076a` 只含两文件产品 diff；证据归档分支 `b610c7d` 只含 `.scratch`
证据与历史报告；drill 分支本地存在、未合入产品分支 / `main`；复核时 `git status` clean。

### R28 — 自选关键断言

**PASS。** 5 条行为断言 + 20 条最终源级/修订静态断言全部通过，见 §6。

### R29 — 边界

**PASS（边界声明）。** 本 PASS 只覆盖 U5；U3 仍 `NOT_AUTHORIZED`；`PUBLIC_NB` /
`PUBLIC_PU` 未开放；未授权 probe / fixture 实施；gate 语义与 `publicResult` 未改变。

---

## 5. 命令与退出码（复核人现场重跑）

| # | 命令 | 退出码 | 关键输出 |
| --- | --- | --- | --- |
| 1 | `pnpm typecheck` | **0** | `tsc -b` + 10 packages 全部 Done |
| 2 | `pnpm exec vitest run packages/pipeline/tests/publish-gate.test.ts` | **0** | 1 file / **29 tests passed** |
| 3 | `pnpm test` | **0** | **178 files / 2945 tests passed**；3 条 runner `onTaskUpdate` 告警（噪声） |
| 4 | `pnpm build` | **0** | `tsc -b` + 3 个 bundle 完成 |
| 5 | `pnpm check:deps` | **0** | `✅ 依赖图合法（10 个包）` |
| 6 | `pnpm check:links` | **0** | `✅ 相对链接零断裂（1253 份文档 · 4159 条链接）` |
| 7 | `sha256sum -c SHA256SUMS`（evidence/U5） | **0** | **10/10 OK** |
| 8 | drill 分支临时 worktree：`pnpm exec vitest run packages/pipeline/tests/publish-gate.test.ts` | **0** | 1 file / **17 tests passed** |
| 9 | 复核人行为断言脚本（Node strip-types） | **0** | 5/5 PASS |
| 10 | 复核人最终静态断言脚本 | **0** | 20/20 PASS |

现场日志（临时路径，hash 供追溯）：

| 日志 | SHA-256 |
| --- | --- |
| `/tmp/u5-final-typecheck.log` | `7c090ad0b0e1bd2df87f0b7425bb8967d5b944aa2d3b41ba69ca3f369afdaa79` |
| `/tmp/u5-final-targeted.log` | `a133c63f5f0427d658e3edf6725b878dc109b33bb1db2ee9e275859a5c1d7b6e` |
| `/tmp/u5-final-test.log` | `c3734ed4d79909374163ba203ddd5c4c53e4ec4a3285ef6d1dac33c5151eb093` |
| `/tmp/u5-final-build.log` | `c5a4c6b6d527dceb9b243c661c5dcc226d5b3f044eafa0bc67283ce8a94692f6` |
| `/tmp/u5-final-deps.log` | `3d0dc5890b6b781d40dfe60d42610d40eb57b01010e1b56db37af0a74c8079c9`（与证据 `check-deps.log` 相同） |
| `/tmp/u5-final-links.log` | `cc3c2dc0e9eed94321cef3a19b9c31efd03f471f97a678b8b7525b1677b5b2ee`（与证据 `check-links.log` 相同） |
| `/tmp/u5-final-drill-targeted.log` | `dbf97ba68a0fed55e3fc9c2cc791cc3489198d474cacf356b54093cc7dd185df` |

> 全量测试的 3 条 `onTaskUpdate` 告警属 vitest worker / runner 级噪声，不是测试失败；
> 最终证据日志同样为 3 条，drill 日志为 3 条，数量随 runner 时序波动。

---

## 6. 自选关键断言（理由与结果）

### S1 — 诊断对象不泄漏完整 U4 report，且 evidence 只含 temporal witness

- **理由**：类型正确不等于运行时形状正确；必须验证只暴露 `coverage` / `verdict` /
  `evidence`。
- **做法**：真实 `last-train` fixture 走 `assertPublishableQa`，断言 temporal 键恰好为
  `["applicable","coverage","evidence","verdict"]`，且 evidence 的 witness.kind 全为
  `"temporal"`。
- **结果**：**PASS**。

### S2 — “未运行”与“不适用”严格分开

- **理由**：三态语义是 U5 的核心不可妥协项。
- **做法**：同一真实包分别 (a) 不传 `configPath`，(b) 去掉所有 `motion`；断言
  (a) `"temporal" in result === false`，(b) `toEqual({applicable:false})`。
- **结果**：**PASS**。

### S3 — config 解析失败不得伪装成“已运行但不适用”

- **理由**：解析失败属于未运行。
- **做法**：临时写非法 JSON config；断言结果无 `temporal` 键。
- **结果**：**PASS**。

### S4 — 硬失败仍抛 `invalid`，temporal 不能成为旁路

- **理由**：防止诊断字段改变既有拒稿路径。
- **做法**：last-train config 加满高墙；断言 `kind === "invalid"` 且消息仍为
  “这份 config 过不了可玩性判定”。
- **结果**：**PASS**。

### S5 — 最终源级 / 修订静态守卫

- **理由**：独立验证干净分支、G3 类型修正、test-only commit、无 `as any`、无 legacy 字段、
  条件 spread、`existingAudit`、单次 audit / temporal 调用、drill 完整回 base。
- **结果**：**PASS**（20/20）。
- 关键确认：`df3564f` 只改 test；`e792e47` 的 `:packages` tree 与测试文件与 `d8b5df1`
  相同；`739076a` merge 无文件变化；`41df0d3..739076a` 只有两文件；当前产品树等于
  `739076a`；drill 完整 diff 为空。

---

## 7. 证据与回滚细节

### 7.1 证据文件（10 个）

| 证据 | 复核结果 |
| --- | --- |
| `targeted-test-output.txt` | 1 file / 29 tests / exit 0；与复核人重跑一致 |
| `test-output.txt` | 178 files / 2945 tests / exit 0；3 条 runner 告警；与复核人重跑一致 |
| `typecheck.log` | exit 0；10 packages 全部 Done；与复核人重跑一致 |
| `build.log` / `check-deps.log` / `check-links.log` | exit 0；deps 10 包；links 1253 文档 / 4159 链接 |
| `invariant-before.txt` / `invariant-after.txt` | 关键文件 hash 逐项相同；`publicCapability` / `publicResult` 未变 |
| `rollback-drill.log` | drill targeted 17 / 全量 2933 / exit 0；完整 tree 回 base |
| `commands.log` | 环境、base/head、typecheck 与命令退出码记录完整 |

### 7.2 回滚演练

- drill 分支从 `739076a` 重建，`git revert --no-edit df3564f e792e47 57ff6de fcea791`
  生成 `6ad5673`、`d2de279`、`f4a3024`、`4e20e1c`。
- 完整 tree 回 `41df0d3`：`git diff --stat 41df0d3 wayfinder/i03-u5-rollback-drill` 为空；
  `:packages` tree 同为 `39aa005b…`。
- 复核人独立在临时 worktree 重跑 drill 目标测试：**17 passed, exit 0**。
- drill 全量日志 **2933 passed, exit 0**；复核人未独立重跑 drill 全量（见 §8.1）。
- 产品分支 / 证据分支 / drill 分支互不污染。

---

## 8. 未覆盖项、限制与观察

### 8.1 回滚全量 2933 未由复核人独立重跑

复核人独立重跑了 drill targeted 17 tests，并核对 drill 完整 tree = base、证据日志 exit 0、
`2945 − 12 = 2933` 的算术关系；**未**在临时 worktree 独立重跑 drill 的 178 files 全量。
该条按“日志 + 树一致 + 算术”判 PASS，独立重跑范围小于 head 全量。

### 8.2 G5 未注入“`runTemporalAudit` 自身抛出”

G5 注入 U4 降级后的 report（coverage unknown / evidence []），未让 mock
`runTemporalAudit` 抛错。U5 调用点没有 `try/catch`，依赖 U4 never-throw 契约；base 原本也
在同一位置直接调用，因此不是 U5 回归。当前 U4 已签署且覆盖 never-throw，故不判 FAIL，
只作为残余风险记录。

### 8.3 `e792e47` 完整 tree 与 `d8b5df1` 不同

`e792e47:packages` tree 与测试文件与 `d8b5df1` 相同；但完整 tree 不同，因为 `d8b5df1`
历史含 `b624a95` 的 `.scratch` 证据，而干净分支 `739076a` 已移除。协调者的“tree 相同”
应理解为 product/test tree 相同；该差异是预期的证据归档分离，不影响产品。

### 8.4 输入包 §5 的陈旧引用

最终版 `U5-review-input.md` 的 §5 第 2 点仍写 `41df0d3..57ff6de`，第 6 点仍写
`reports/U5-review.md`；与 head `739076a`、本最终报告不一致。复核按协调者指令与 §1 的
head 执行，并同时核对 `41df0d3..739076a`；此为输入包文字未完全刷新。

### 8.5 授权记录回滚目标差异

`U5-incremental-authorization.md` §4 写回滚目标 `123a1c0`，而输入包 / 现场基线为
`41df0d3`（tree = `main` `f4e6ce7`）。drill 回 `41df0d3` 符合输入包且保留授权 docs；
`123a1c0` 反而会移除授权包页面。该差异属授权记录文字，不影响 U5 产品/证据。

### 8.6 Runner 告警计数

head 全量现场 3 条 `onTaskUpdate`；最终证据 3 条；drill 3 条。均只出现在
“Unhandled Errors”段落，测试计数均 passed；按 runner 噪声处理。

### 8.7 PR #61 CI 状态

复核人未通过 GitHub API 独立查询 PR #61 的四项 CI；本报告的结论基于本地重跑：
`typecheck` / targeted / 全量 / build / deps / links 均 exit 0。

### 8.8 未覆盖

- 未独立重跑 U4 内部算法 / `analyzeTemporalInternalTwoLag`（U4 已签署，超出 U5 范围）。
- 未做跨进程确定性重跑（U5 未引入算法或墙钟语义）。
- 未对 CLI / MCP 实际终端 / structuredContent 做额外端到端检查（相关包 diff 为零，
  全量测试覆盖既有路径）。
- 未验证未来 gate `OPEN` / admission 场景（第一阶段 gate 恒 `BLOCKED`，U5 不做能力开放）。

---

## 9. 独立签署

本人为 fresh 独立复核会话，未参与 U5 实施，未采信变更说明或作者结论。上述结论基于：

1. 现场逐文件 diff、修订 commit 与源码阅读；
2. 输入 / 证据文件的 SHA-256 现场重算与 `SHA256SUMS` 校验；
3. `pnpm typecheck`、目标测试、全量测试、build、deps、links 现场重跑及退出码记录；
4. drill 分支、revert / tree 比对及目标测试独立重跑；
5. 复核人自选的 5 条行为断言与 20 条最终静态断言。

**复核结论：PASS（U5 final product head `739076a`；证据分支 `b610c7d`；无 FAIL、无 NOT_RUN）。**

> 边界：本 PASS **不**授权 U3；**不**开放 `PUBLIC_NB` / `PUBLIC_PU`；**不**授权 probe /
> fixture 实施；**不**改变 gate、`publicCapability`、`publicResult` 或发布拒稿行为。

| 项 | 值 |
| --- | --- |
| 复核人 | fresh 独立复核会话（Claude Agent） |
| 日期 | 2026-11-16 |
| 复核对象 | product head `739076a`；证据/工作树 `b610c7d`；base `41df0d3` |
| 报告路径 | `.scratch/level-playability-v1.1-i03-impl/reports/U5-review-final.md` |
| 输入 hash | docs `5e3fa97f…`；auth `45e72c93…`；brief `0bd67859…`；review input `5e186d05…`；初始报告 `7b6d8023…`；rerun 报告 `6ce87eb3…` |
| 证据 hash | `evidence/U5/SHA256SUMS` 10/10 OK（SUMS 自身 `11b3cb6d…`） |
| 输出 hash | 本报告 SHA-256 见复核交付消息（自引用 hash 无法写入自身） |
| 签署 | **PASS — U5 only（final head `739076a`）** |
