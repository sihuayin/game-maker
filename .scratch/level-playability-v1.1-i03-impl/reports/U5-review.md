# I-03 U5 独立复核报告

> **复核对象**：U5（pipeline `publish-gate` 时序诊断字段，非阻断）
> **复核人**：fresh 独立复核会话（Claude Agent；未参与 U5 实施，不采信作者结论）
> **日期**：2026-11-16
> **环境**：Darwin 24.6.0 arm64 · Node v22.23.2 · pnpm 10.7.1 · vitest 3.2.7
> **结论**：**PASS**（逐项见 §3；无 FAIL；带限制项见 §7）

本报告只针对 U5。复核 PASS **只**表示 U5 证据足以支持该单元；不授权 U3，不开放
`PUBLIC_NB` / `PUBLIC_PU`，不授权 probe / fixture 实施，不改变 gate 或 `publicResult`。

---

## 1. 输入、基线与 hash 核对

### 1.1 输入文件

| 输入 | 期望值（输入包 / 授权记录） | 现场 SHA-256 | 结果 |
| --- | --- | --- | --- |
| `docs/v7.8/移动-I03.md`（当前） | `5e3fa97f4ae855ef37a18c3aabd708ed28f250af1184c466eaadc890935d6f24` | `5e3fa97f4ae855ef37a18c3aabd708ed28f250af1184c466eaadc890935d6f24` | **PASS** |
| 同上 · 签署前版本 | `2f89d572…` | `2f89d572008b538be5871fef11d9f539e16829d1f4ceafe6e25a8a250fb9a52e`（`583c777`） | **PASS** |
| 同上 · 签署后版本 | `f45332be…` | `f45332bedd87209353a6f3e482408484151deed788c42996e36436437e1120cb`（`9a3d520`） | **PASS** |
| `reports/U5-incremental-authorization.md` | `45e72c93537d9052ba69d1903563dc722aaee914eb743c125a212b8b6f17c1b0` | 同左（base `41df0d3` 内即此内容） | **PASS** |
| `issues/05-i03-impl-u5.md` | 输入包未给定期望 hash | `0bd67859448a42cf09d5d5a668cb5ea799a6195e564174dab7928278204b9d50`（base 内一致） | **PASS（记录值）** |
| `reports/U5-review-input.md` | —（本报告输入） | `31a50d3ac5f8bee562cf4a5b9826c18701429eb3e4acf1671dcf7f12913986f1` | 记录 |

核对方式：`git show <commit>:docs/v7.8/移动-I03.md | shasum -a 256`。三个历史版本均能在仓库历史中定位，未见“仅口头引用”的 hash。

### 1.2 证据 hash

```bash
cd .scratch/level-playability-v1.1-i03-impl/evidence/U5 && sha256sum -c SHA256SUMS
```

结果：**exit 0**；`commands.log`、`invariant-before.txt`、`invariant-after.txt`、
`targeted-test-output.txt`、`test-output.txt`、`rollback-drill.log`、`build.log`、
`check-deps.log`、`check-links.log` 共 **9/9 OK**。

`SHA256SUMS` 自身：`75771e4a57f9ac1e24d125b2ee01ee20ab1228bb085b66a7ba5ef3443b158b8c`。

### 1.3 基线

| 项 | 值 |
| --- | --- |
| Base | `41df0d3e65f4716d1b55d39d1ee1517287fc4e6e` · tree `08337f4034e80c93f776865e9ea9fc75e651989a` |
| `main` @ `f4e6ce7` tree | `08337f4034e80c93f776865e9ea9fc75e651989a`（与 base tree **相同**） |
| Code head | `fcea791` |
| Code/test head | `57ff6de` |
| Evidence head | `b624a95`（当前分支 `wayfinder/level-playability-v1.1-i03-u5`） |
| Submission slicing | `fcea791` 仅 source；`57ff6de` 仅 test；`b624a95` 仅 `.scratch` evidence + 复核输入包 + 本报告之外的文件 |

---

## 2. Diff scope

```bash
git diff --name-status 41df0d3..57ff6de
```

```
M	packages/pipeline/src/publish-gate.ts
M	packages/pipeline/tests/publish-gate.test.ts
```

`git diff --numstat`：source `48+ / 15-`，test `179+ / 2-`。白名单外**零 diff**：

```bash
git diff --stat 41df0d3..57ff6de -- \
  packages/contracts packages/assets packages/cli packages/mcp \
  packages/pipeline/src/create-game.ts scripts docs package.json pnpm-lock.yaml \
  tsconfig.json fixtures
# 输出为空
```

- `packages/contracts/**`、`packages/assets/**`、`packages/cli/**`、`packages/mcp/**`、
  `create-game.ts`、`fixtures/**`、`scripts/**`、`docs/**`、`package.json` / lockfile / tsconfig：**零 diff**。
- test 文件的 **2 行删除仅为 import 行替换**；其余 179 行均为新增（`vi` / `beforeEach` /
  mock / G1–G11 用例 / 变异守卫）。既有断言的**一条未改、未放宽**。
- test 用例数：base `17` → head `28`（新增 11）。

---

## 3. 逐项复核

### R1 — 输入 / 证据 hash

**PASS。** 见 §1。授权包三个历史版本、U5 授权记录、brief 均与仓库提交内容一致；
`evidence/U5/SHA256SUMS` 9/9 通过。

### R2 — Diff 只落在 U5 白名单两文件

**PASS。** 见 §2。`41df0d3..57ff6de` 只有 `publish-gate.ts` 与 `publish-gate.test.ts`；
contracts / assets / CLI / MCP / `create-game.ts` / fixtures / scripts / docs / 包清单零 diff。

### R3 — 既有测试断言未改

**PASS。** `git diff` 的删除行只有两条 import；base `it()` 17 条、head `it()` 28 条，
新增 11 条全部位于 `§U5 发布闸时序诊断（非阻断）` describe 内。

### R4 — `configProblem` 结构化返回

**PASS。** 现场代码（`packages/pipeline/src/publish-gate.ts:145-184`）：

- `configPath === undefined` ⇒ `return {}`（`problem` / `temporal` 均缺席）；
- JSON 解析失败 / `parseGameConfig` 失败 ⇒ `return {}`；
- `playabilityIssues(...).filter(severity === "error").length > 0` ⇒ `return { problem }`，
  **未调用** `runTemporalAudit`；
- 硬检查通过 ⇒ 返回 `{ temporal }`。

`problem` 与 `temporal` 是两个独立维度；有 `problem` 时按原路径抛 `CommandError("invalid")`，
`temporal` 不进入异常消息。

### R5 — 三态语义（缺席 / `applicable:false` / `applicable:true`）

**PASS。**

| 状态 | 含义 | 现场证据 |
| --- | --- | --- |
| 字段缺席 | temporal **未运行** | G6（无 `configPath`）、G8（硬失败）、G9（QA 先拒稿）；复核人自选断言 B/C |
| `{ applicable:false }` | temporal **已运行、确认不适用** | G7（无移动 Hazard）；`applicable:false` 用例 |
| `{ applicable:true, coverage, verdict, evidence }` | 已运行且适用 | G1/G4（真实 last-train）、G2/G3、G5、G10、G11 |

`applicable:false` 不被读成 `PROVEN_UNPLAYABLE` / `NO_PROVEN_BLOCKER`：现场源码没有按
`applicable` 以外的候选状态分支；用例直接 `toEqual({ applicable:false })`。

### R6 — 硬失败与 QA 拒稿不运行 temporal

**PASS。** G8 / G9 均断言 `mocks.calls === 0`，且仍照原样抛 `CommandError("invalid")`；
源码中 `verdictProblem` 早于 `configProblem`，`configProblem` 内硬失败早于
`runTemporalAudit`。TD config 的 `return undefined` 仍在最前，未改变 P2 例外。

### R7 — `existingAudit` 复用本次 audit

**PASS。** `configProblem` 只调用一次 `auditPlayability`（`publish-gate.ts:164`），并把同一
`audit` 传给 `runTemporalAudit({ ..., existingAudit: audit })`（`:174`）。现场静态断言：
`auditPlayability(` 1 次、`runTemporalAudit(` 调用点 1 处。U4 `runTemporalAudit` 在
`existingAudit !== undefined` 时走真实公共路径，不重复三维 `auditPlayability`。

### R8 — 诊断来源只用 U4 公共字段

**PASS。** 源码只读取：

- `report.coverage`（U4 `TemporalAuditReport`）
- `report.publicVerdict.verdict`
- `report.evidence`

**未使用** legacy `report.verdict` / `report.degradation`；未把整个 `TemporalAuditReport`
放进结果。现场 grep + 静态断言：`report.verdict`、`report.degradation`、`as any` 均无命中。
复核人运行时断言（真实 last-train）：`temporal` 的键恰好为
`["applicable","coverage","evidence","verdict"]`，无 `publicVerdict` / `degradation` 泄漏。

### R9 — 条件 spread，无 `temporal: undefined`

**PASS。** 末尾返回：

```ts
return {
  report, reportPath, manifest,
  ...(configResult.temporal !== undefined ? { temporal: configResult.temporal } : {}),
};
```

运行时断言：未传 `configPath` / 解析失败 / 硬失败时，结果对象中 **不存在** `temporal` 键
（`"temporal" in result === false`），不是 `temporal: undefined`。

### R10 — 变异守卫：fake `PROVEN_UNPLAYABLE` + `checked`

**PASS。** G10 注入
`publicVerdict.verdict = "PROVEN_UNPLAYABLE"`、`coverage = "checked"` 的 fake report：
`assertPublishableQa` **正常返回**（不因 temporal 拒稿、不抛），仅把该值记录进
`result.temporal`。这符合授权包 §6“temporal 纯诊断、不改变放行”的语义。
（任务文字“不放行不抛”按 brief §7 理解为“**不得因 temporal 不放行、不得抛**”。）

### R11 — 源级：`CommandError` / `playabilityIssues` 不消费 temporal

**PASS。** 测试内源级断言通过；复核人另行静态核验：
`new CommandError(...)` 不含 `temporal`，`playabilityIssues(...)` 不含 `temporal`。
硬失败消息只来自 `configResult.problem`。

### R12 — fake report 满足真实 `TemporalAuditReport` 类型、无 `as any`

**PASS。** `fakeReport` 返回类型标注为 `TemporalAuditReport`，`over` 参数为
`Partial<Extract<TemporalAuditReport, { applicable: true }>>`；构造对象含 U4 要求的
`applicable` / legacy `verdict` / `coverage` / `evidence` / `publicVerdict`。全文件无 `as any`。

### R13 — mock 默认委托实际 `runTemporalAudit`

**PASS。** `vi.mock("@game-maker/assets", async (importOriginal) => ...)` 默认分支调用
`actual.runTemporalAudit(args)`，只有 `useFake && report !== null` 时替换；G1/G4 真实
fixture 用例走实际实现。`beforeEach` 重置 `useFake` / `report` / `calls`，用例间无泄漏。

### R14 — G1–G11 与 fake report 对应关系

**PASS（带限制，见 §7.1）。**

| 门 | 现场用例 | 关键断言 | 结果 |
| --- | --- | --- | --- |
| G1 / G4 | “真实 last-train ⇒ temporal 诊断存在且公共 verdict IE” | `applicable:true`；coverage ∈ checked/partial/unknown；verdict IE；temporal witness | PASS |
| G2 / G3 | “公共 IE 诊断不改变放行” | fake 公共 IE；仍放行；记录 IE | PASS |
| G5 | “降级报告（IE / unknown）⇒ 不抛，按记录值输出” | coverage unknown、evidence []；不抛 | PASS |
| G6 | “未传 configPath ⇒ temporal 字段缺席” | `"temporal" in got === false`；`calls === 0` | PASS |
| G7 | “无移动 Hazard ⇒ `{applicable:false}`” | 精确等于 `{applicable:false}` | PASS |
| G8 | “硬失败早退 ⇒ 照旧拒稿，且 temporal 未运行” | `invalid`；消息匹配；`calls === 0` | PASS |
| G9 | “QA 报告先拒稿 ⇒ 照旧拒稿，且 temporal 未运行” | `invalid`；消息匹配；`calls === 0` | PASS |
| G10 | “temporal PU + checked 仍不放行、不抛” | 返回而非抛；记录 PU / checked | PASS |
| G11 | “证据缺省按 unknown 记录，绝不当作 checked” | coverage unknown、evidence [] | PASS |
| 补充 | “`applicable:false` 不被读成 PU / NB” | 精确等于 `{applicable:false}` | PASS |
| 补充 | “源级：CommandError / playabilityIssues 不消费 temporal” | 两条正则均不匹配 | PASS |

### R15 — 发布行为 / 退出码 / 报告落盘不变

**PASS。** U5 只新增可选诊断字段，不新增 `throw`；现有 `CommandError` 路径、消息、退出码
（`invalid` ⇒ 4）与 QA 报告落盘逻辑未改。TD 配置仍 `return undefined`。全量测试与 U5
目标测试均通过，既有 `create-game` / CLI / MCP 测试无回归。

### R16 — 不落盘 / 不进 CLI / MCP / 不升契约；公共能力仍 BLOCKED

**PASS。** U5 新增的 `PublishGateTemporalEvidence` / `PublishGateResult.temporal` 只出现在
`packages/pipeline/src/publish-gate.ts`，U5 diff 未新增其他产品引用；无 temporal 的
`fs.write*`、无 CLI / MCP 输出改动、无 sidecar / `qa-report` 变更。contracts / assets /
CLI / MCP diff 为零，包版本与契约格式未动。不变量快照现场复核：

- `public-verdict.ts` `ec67f5a7…`、`api.ts` `52ccef05…`、`verdict.ts` `343f8e24…`、
  `ops.ts` `6105ca72…`、`create-game.ts` `d4f5edf7…`：base 与 head **逐字节相同**；
- `packages/cli` tree `084c5c20…`、`packages/mcp` tree `5e3abfaf…`：base 与 head 相同；
- `publicCapability: "BLOCKED"`、`publicResult: null` 仍在 contracts 源码中，未改写。

### R17 — 目标测试 28

**PASS。** 复核人现场重跑：`1 file / 28 tests passed`，exit 0（见 §5）。

### R18 — 全量测试 178 files / 2944 tests

**PASS。** 复核人现场重跑：`178 passed / 2944 passed`，exit 0。出现 **2 条**
`[vitest-worker]: Timeout calling "onTaskUpdate"` runner 告警；按任务要求单独记录为
vitest runner 噪声，**未与测试失败混淆**（`Tests 2944 passed`、无 failed test）。

### R19 — build / check:deps / check:links

**PASS。** 三条命令现场重跑均 exit 0；`check:deps` 10 个包合法；`check:links` 1251 份文档 /
4159 条链接零断裂（与证据 1250 份的差异见 §7.5）。

### R20 — 回滚演练：分支、revert、回 base

**PASS。** 分支 `wayfinder/i03-u5-rollback-drill`：

- `57ff6de` → revert `7b7f8b1`（test commit）；
- `fcea791` → revert `8f31d51`（source commit）；
- `git diff --stat 41df0d3 wayfinder/i03-u5-rollback-drill`：**空**；
- drill tree = `41df0d3` tree = `08337f4…`。

### R21 — 回滚后 17 / 2933

**PASS（targeted 独立重跑；全量按日志 + 树一致 + 算术交叉核对，未独立重跑全量）。**

- 复核人在临时 worktree 独立重跑 drill 分支目标测试：`17 tests passed`，exit 0；
- drill 证据日志全量：`178 files / 2933 tests passed`，exit 0；
- head 全量 2944 − 新增 11 条 U5 测试 = 2933，与日志一致。

### R22 — Delivery 分支未被污染

**PASS。** 复核时 delivery 分支 tip 仍为 `b624a951…`，与 `HEAD` 相同；drill 分支只在本地
存在，未合入 delivery / `main`，未追加证据或产品提交。drill 演练通过同一工作树的
branch switch 完成（不是独立 worktree），切换后已回到 delivery 分支，工作树 clean。

### R23 — 自选关键断言

**PASS。** 5 条行为断言 + 一组源级静态断言全部通过，见 §6。

### R24 — 边界

**PASS（边界声明）。** 本 PASS 只覆盖 U5；U3 仍 `NOT_AUTHORIZED`；`PUBLIC_NB` /
`PUBLIC_PU` 未开放；未授权 probe / fixture 实施；gate 语义与 `publicResult` 未改变。

---

## 4. 命令与退出码（复核人现场重跑）

| # | 命令 | 退出码 | 关键输出 |
| --- | --- | --- | --- |
| 1 | `pnpm exec vitest run packages/pipeline/tests/publish-gate.test.ts` | **0** | 1 file / **28 tests passed** |
| 2 | `pnpm test` | **0** | **178 files / 2944 tests passed**；2 条 runner `onTaskUpdate` 告警（噪声） |
| 3 | `pnpm build` | **0** | `tsc -b` + 3 个 bundle 完成 |
| 4 | `pnpm check:deps` | **0** | `✅ 依赖图合法（10 个包）` |
| 5 | `pnpm check:links` | **0** | `✅ 相对链接零断裂（1251 份文档 · 4159 条链接）` |
| 6 | `git diff --stat 41df0d3 wayfinder/i03-u5-rollback-drill` | **0** | 输出为空（tree 等于 base） |
| 7 | drill 分支：`pnpm exec vitest run packages/pipeline/tests/publish-gate.test.ts` | **0** | 1 file / **17 tests passed** |
| 8 | `sha256sum -c SHA256SUMS`（evidence/U5） | **0** | 9/9 OK |
| 9 | 复核人行为断言脚本（Node strip-types） | **0** | 5/5 PASS |
| 10 | 复核人源级静态断言脚本 | **0** | 10/10 PASS |

现场日志（临时路径，hash 供追溯）：

| 日志 | SHA-256 |
| --- | --- |
| `/tmp/u5-review-targeted.log` | `4acd3695c92ec84f44ea04f7786622d532c91a26a5247cbd1884a331260e770f` |
| `/tmp/u5-review-test.log` | `efc7ac70d804aaad8f1d8023519e8d67c02ef821e40bc59970523bbf59bc0017` |
| `/tmp/u5-review-build.log` | `f6d42ef32f3872db60a8137c1c5b243d3e9407b623fdb466b416ea475a742cb9` |
| `/tmp/u5-review-deps.log` | `3d0dc5890b6b781d40dfe60d42610d40eb57b01010e1b56db37af0a74c8079c9`（与证据 `check-deps.log` 相同） |
| `/tmp/u5-review-links.log` | `43bbbbc451e6af366842748746239da1ce7e884083987861a0a4b2f4b83e700e` |
| `/tmp/u5-review-drill-targeted.log` | `3201ced77e27bbe82d81810a32c0aae208e4a0faa2a4418735851c08ea704935` |

> 全量测试的 2 条 `onTaskUpdate` 告警单独列此：属 vitest worker / runner 级噪声，
> 不是测试失败；证据日志中同项为 3 条、drill 日志中为 4 条，数量随 runner 时序波动。

---

## 5. 自选关键断言（理由与结果）

### S1 — 诊断对象不泄漏完整 U4 report，且 evidence 只含 temporal witness

- **理由**：仅靠类型可能仍把 `publicVerdict` / legacy 字段带进发布闸；必须看运行时形状。
- **做法**：真实 `last-train` fixture 走 `assertPublishableQa`，断言
  `Object.keys(temporal).sort()` 恰好为 `["applicable","coverage","evidence","verdict"]`，
  且 `evidence.every(e => e.witness.kind === "temporal")`。
- **结果**：**PASS**。

### S2 — “未运行”与“不适用”在运行时严格分开

- **理由**：这是 U5 最容易被实现成 `temporal: undefined` 或 `{applicable:false}` 伪装的地方。
- **做法**：同一真实包分别 (a) 不传 `configPath`，(b) 写一份去掉所有 `motion` 的 config；
  断言 (a) `"temporal" in result === false`，(b) `toEqual({applicable:false})`。
- **结果**：**PASS**。

### S3 — config 解析失败不得被记成“已运行但不适用”

- **理由**：解析失败属于“没跑到 temporal”，不是 `applicable:false`。
- **做法**：临时写一份非法 JSON config，传入 `configPath`；断言结果无 `temporal` 键。
- **结果**：**PASS**。

### S4 — 硬失败仍抛 `invalid`，temporal 不能成为拒稿/放行的旁路

- **理由**：防止诊断字段改变既有拒稿路径。
- **做法**：在 last-train config 中加一道满高墙，断言抛出的 `kind === "invalid"` 且消息仍为
  “这份 config 过不了可玩性判定”。
- **结果**：**PASS**。

### S5 — 源级静态守卫（补充人工 diff）

- **理由**：变异守卫里的正则只是最低限度；复核人另做一组静态断言，覆盖 legacy 字段、
  `as any`、`temporal: undefined`、条件 spread、`existingAudit`、单次 audit / temporal 调用。
- **结果**：**PASS**（10/10）。其中确认 `runTemporalAudit(` 调用点 **1 处**、
  `auditPlayability(` **1 处**，未重复三维审计。

---

## 6. 证据与回滚细节

### 6.1 证据文件

| 证据 | 复核结果 |
| --- | --- |
| `targeted-test-output.txt` | 1 file / 28 tests / exit 0；与复核人重跑一致 |
| `test-output.txt` | 178 files / 2944 tests / exit 0；3 条 runner 告警；与复核人重跑一致 |
| `build.log` / `check-deps.log` / `check-links.log` | exit 0；deps 10 包；links 1250 文档 / 4159 链接 |
| `invariant-before.txt` / `invariant-after.txt` | 关键文件 hash 逐项相同；`publicCapability` / `publicResult` 未变 |
| `rollback-drill.log` | 17 / 2933 / exit 0；revert 两个 commit；回 base tree |
| `commands.log` | 环境、base/head、命令与退出码记录完整；与现场一致（links 文档数差异见 §7.5） |

### 6.2 回滚演练

- drill 分支从 `57ff6de` 切出，`git revert --no-edit 57ff6de fcea791` 生成 `7b7f8b1`、`8f31d51`。
- drill tree 与 `41df0d3` 完全一致，diff 为空；说明 revert 真实回到 **U5 代码基线**。
- 复核人独立在临时 worktree 重跑 drill 目标测试：**17 passed, exit 0**。
- drill 全量日志 **2933 passed, exit 0**；复核人未独立重跑 drill 全量（见 §7.3）。
- delivery 分支 tip `b624a95` 未变；drill 未合入 delivery / `main`。

---

## 7. 未覆盖项、限制与观察

### 7.1 G3 未独立构造 `pu-candidate`

G2/G3 共用一个 fake report，`evidence[0].witness.result` 为 `"nb-candidate"`；没有另造
`"pu-candidate"` 的 fake。发布闸源码**完全不读取** `witness.result`，只透传公共
`verdict` / `coverage` / `evidence`，因此两种 candidate 在 U5 行为上等价。结论仍为 PASS，
但“G3”在测试里只是被同一组等价输入覆盖，不是独立夹具；若要求逐条门独立证据，应补一条
`pu-candidate` fake report 用例。

### 7.2 G5 未注入“`runTemporalAudit` 自身抛出”

G5 注入的是 U4 降级后的 report（`coverage:"unknown"`、`evidence:[]`），并未让 mock
`runTemporalAudit` 抛错。U5 没有在调用点加 `try/catch`，依赖 U4 “never throw” 契约；
base 原本也在同一位置直接调用 `runTemporalAudit`，因此这不是 U5 引入的回归，但“诊断永不
阻断”的防线完全押在 U4 契约上。当前 U4 已签署且测试覆盖 never-throw，故不判 FAIL，
只作为残余风险记录。

### 7.3 回滚全量 2933 未由复核人独立重跑

复核人独立重跑了 drill 目标 17 tests，并核对了 drill 树 = base 树、证据日志 exit 0、
`2944 − 11 = 2933` 的算术关系；**未**在临时 worktree 独立重跑 drill 的 178 files 全量。
该条按“日志 + 树一致 + 算术”判 PASS，但独立重跑范围小于 head 全量。

### 7.4 Runner 告警计数波动

head 全量现场 2 条 `onTaskUpdate`，证据 3 条，drill 4 条。三者均只出现在
“Unhandled Errors”段落，测试计数均为 passed；按 runner 噪声处理，不计失败。

### 7.5 `check:links` 文档数 1251 vs 证据 1250

证据日志生成于 evidence-only commit `b624a95` 之前；该 commit 新增了
`reports/U5-review-input.md`，因此现场多 1 份文档。链接总数均为 4159，且命令 exit 0。
这不是不一致或失败。

### 7.6 授权记录回滚目标与输入包的 SHA 表述差异

`U5-incremental-authorization.md` §4 写“回滚目标：U5 分支切出时的 `main` SHA（`123a1c0`）”，
而输入包与现场基线为 `41df0d3`（tree = `main` `f4e6ce7`，`123a1c0` 之后合入的授权 docs
提交）。drill 回 `41df0d3` 符合输入包要求，也保留了授权 docs；若回 `123a1c0` 反而会移除
授权包页面。此差异属授权记录文字表述，不影响产品代码或证据；记录为观察，不判 FAIL。

### 7.7 未覆盖

- 未独立重跑 U4 内部算法 / `analyzeTemporalInternalTwoLag`（U4 已签署，超出 U5 范围）。
- 未做跨进程确定性重跑（U5 未引入算法或墙钟语义）。
- 未对 CLI / MCP 的实际终端 / structuredContent 做额外端到端检查（相关包 diff 为零，全量
  测试覆盖既有路径）。
- 未验证未来 gate `OPEN` / admission 场景（第一阶段 gate 恒 `BLOCKED`，U5 不做能力开放）。

---

## 8. 独立签署

本人为 fresh 独立复核会话，未参与 U5 实现，未采信作者结论。上述结论基于：

1. 现场逐文件 diff 与源码阅读；
2. 输入 / 证据文件的 SHA-256 现场重算与 `SHA256SUMS` 校验；
3. 目标测试、全量测试、build、deps、links 现场重跑及退出码记录；
4. drill 分支、revert/tree 比对及目标测试独立重跑；
5. 复核人自选的 5 条行为断言与 10 条源级静态断言。

**复核结论：PASS（U5 范围内；无 FAIL）。**

> 边界：本 PASS **不**授权 U3；**不**开放 `PUBLIC_NB` / `PUBLIC_PU`；**不**授权 probe /
> fixture 实施；**不**改变 gate、`publicCapability`、`publicResult` 或发布拒稿行为。

| 项 | 值 |
| --- | --- |
| 复核人 | fresh 独立复核会话（Claude Agent） |
| 日期 | 2026-11-16 |
| 复核对象 head | code/test `57ff6de`；evidence `b624a95` |
| 报告路径 | `.scratch/level-playability-v1.1-i03-impl/reports/U5-review.md` |
| 输入 hash | 见 §1（docs `5e3fa97f…`；auth `45e72c93…`；brief `0bd67859…`；review input `31a50d3a…`） |
| 证据 hash | `evidence/U5/SHA256SUMS` 9/9 OK |
| 输出 hash | 本报告 SHA-256 见复核交付消息（自引用 hash 无法写入自身） |
| 签署 | **PASS — U5 only** |
