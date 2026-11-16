# I03-IMPL-04 U4 独立复核报告（decision A amended）

> 复核人：**fresh 独立复核会话**（未参与 U4 实现；不接受作者总结 / PASS 声明）
> 日期：**2026-11-16**
> 环境：Darwin 24.6.0 arm64 · Node **v22.23.2** · pnpm **10.7.1**
> 仓库：`/Volumes/shy/some-projects/game-maker`
> 当前工作分支 / HEAD：`wayfinder/level-playability-v1.1-i03-u4` / `d02cb6336dba5f5c0533309a88866f787b7d6fa7`（evidence 刷新）
> Product code/test head：**`ce6ce63374eb54e671eda18dc1de6d5bea0ed3bb`**（远端 `wayfinder/i03-u4-product`）
> Audit / evidence 远端：`wayfinder/i03-u4-evidence` @ `d02cb63`
> 说明：本地证据分支上的产品修订提交为 `bf658fb`；`git diff ce6ce63 bf658fb -- packages` 为空，产品内容与 `ce6ce63` 完全一致。

## 1. 结论

**总体结论：PASS（仅限 decision A amended U4）。无 FAIL；无阻断性 NOT_RUN。**

- 用户裁定 A 已落地：真实分析只在 `existingAudit` 存在时运行；无 `existingAudit` 走 legacy-only，**不调用真实 analyzer，也不调用 `auditPlayability` fallback**。
- 原 CI 失败路径已消除：`compile-runtime.test.ts` 43/43 通过；原慢用例在定向 / 全量中分别为 4.8s / 13.1s（限 20s）。
- 前次证据归档 FAIL 保持关闭：`evidence/U4/` 全部 7 个文件已入库；从 `git archive` 干净目录 `shasum -a 256 -c SHA256SUMS` 6/6 OK。
- T-57 未改；T-58 仅新增真实 analyzer 恰一次；T-61 三处调用者不变；`TemporalAuditReport` 旧字段兼容；`MINIMAL_PUBLIC_VERDICT` 已冻结；原 JSDoc 已归位。
- 本 PASS **只**表示 amended U4 证据足以支持该单元；**不授权** U5 / U3，**不开放** `PUBLIC_NB` / `PUBLIC_PU`，不授权 probe / fixture 实施。

## 2. 输入 / 输出 hash

### 2.1 现场复算的输入 hash（`shasum -a 256`）

| 输入 | 现场 SHA-256 |
| --- | --- |
| `docs/v7.8/移动-I03.md`（当前 / U1+U2 Ledger 后） | `32152c0182f4282f680b06dcd576b58d05255b0b16a8f78a7e70a272feeb5a70` |
| `.scratch/level-playability-v1.1-i03/reports/I03-review.md` | `40af4b4b243abf1fbaac5a794cf1a8ccaf32b65e3c7ed29278e1d21502feed09` |
| `.scratch/level-playability-v1.1-i03-impl/reports/U4-incremental-authorization.md` | `e101a6506ae2a7715dfda70131ba068e470588dd76b6fb7409b0fc2b1c797937` |
| `.scratch/level-playability-v1.1-i03-impl/reports/U4-brief-amendment-01.md` | `c13b3b51b7a1879ea493385ea6a30f9ff9d4b7eac368e7d8548aac8a0e51ac46` |
| `.scratch/level-playability-v1.1-i03-impl/reports/U4-review-input.md`（amended） | `8f4355a20ac787626cbf4cab4a70d9e949602ce0841398d4a96a0bf251c10451` |

### 2.2 `evidence/U4` 现场 hash 与 git 干净恢复

| 证据文件 | 现场 / 提交内 SHA-256 |
| --- | --- |
| `commands.log` | `6f3e0ec8975a562dd0cc028601d73217dcf5b2bfec366d11ab7a6c2fefc35406` |
| `invariant-before.txt` | `6507fd79207368b22c7872af129620f99ca42aac621a77cbe971321d4fa64541` |
| `invariant-after.txt` | `65bfad9995e68f910f36c57326ffa62c84b5287c13fac1837ec45798329c9dc0` |
| `targeted-test-output.txt` | `9cc744b5d0d75e7b746b91eb88b9a07fb2b57ab8118321b203463b2ddbd4fc0d` |
| `test-output.txt` | `b48ba9c6f07a686f4533b0b41d8428eb2203df27d15900d73b30eba9258d394a` |
| `rollback-drill.log` | `ea91c42129d010cfe2b25c1d3fec67fbf12d825bcc90424562f3467589e2b98e` |
| `SHA256SUMS` | `2ca3a3bab76bfa90c477a2da13b8be9e07930aecf0575a6deeb7332b0b5a8933` |

不依赖作者工作区的验证：

```bash
rm -rf /tmp/u4-am-clean && mkdir -p /tmp/u4-am-clean
git archive HEAD .scratch/level-playability-v1.1-i03-impl/evidence/U4 | tar -x -C /tmp/u4-am-clean
cd /tmp/u4-am-clean/.scratch/level-playability-v1.1-i03-impl/evidence/U4
shasum -a 256 -c SHA256SUMS
```

输出 6/6 OK，退出码 0。`git ls-tree -r --name-only HEAD -- .../evidence/U4` 含全部 7 个文件（含两个日志）。

### 2.3 输出

| 输出 | 路径 | SHA-256 |
| --- | --- | --- |
| 本复核报告 | `.scratch/level-playability-v1.1-i03-impl/reports/U4-review-amendment.md` | 写盘后复算，随交付回报给出 |

## 3. 修订上下文与 diff scope

- 用户裁定 A 记录：`reports/U4-brief-amendment-01.md`（`c13b3b51…`）。
- 产品修订提交：`ce6ce63`（`9b21f2d..ce6ce63` 只改 `ops.ts` / `ops.test.ts`）；本地证据分支等价提交 `bf658fb`（产品内容零 diff）。
- `git diff a0688be..ce6ce63`：**3 个文件**，+233 / -12：
  - `packages/assets/src/ops.ts`：+125 / -?（decision A 分支、冻结常量、JSDoc 归位）
  - `packages/assets/tests/ops.test.ts`：+118 / -?（legacy-only / existingAudit / 失败 / 确定性）
  - `packages/contracts/tests/playability-temporal-input.test.ts`：**仅 T-58 +2 行**
- 零 diff 边界（逐文件核对）：`temporal.ts`、`temporal-result.ts`、`publish-gate.ts`、`create-game.ts`、`mechanic.ts`、U1 `temporal-evidence.ts`、U2 `public-verdict.ts`、`fixtures/`、`package.json` / `pnpm-lock.yaml` / `tsconfig*`。
- 远端 refs：产品 `ce6ce63`；evidence `d02cb63`。证据 commit 只在 `.scratch`，不推进产品分支。
- `git diff --check a0688be..ce6ce63 -- packages`：无空白错误。

## 4. 逐项结论

| # | 检查项 | 结论 | 依据 |
| --- | --- | --- | --- |
| 1 | 输入 hash / amendment / 复核输入完整 hash | **PASS** | 现场 `shasum -a 256`；见 §2 |
| 2 | `evidence/U4/SHA256SUMS` 从 git 可复核 | **PASS** | `git archive HEAD` 干净目录 `shasum -c` 6/6 OK |
| 3 | Diff 逐文件落在 U4 白名单；零 diff 边界 | **PASS** | 仅 3 文件；边界逐文件核对 |
| 4 | decision A：无 `existingAudit` ⇒ legacy-only，不跑真实 analyzer / `auditPlayability` | **PASS** | `ops.ts` 无 `auditPlayability` 引用；`existingAudit === undefined` 在真实路径前返回；自选断言 B1 / B2 |
| 5 | 有 `existingAudit` ⇒ 真实 `analyzeTemporalInternalTwoLag → toPublicTemporalEvidence → mapPublicVerdict` | **PASS** | 代码逐行核对；集成 smoke + 自选断言 B3 |
| 6 | legacy `auditPlayabilityTemporal` + `stubTemporalAnalyzer` 保留 | **PASS** | legacy 双档调用仍在；T-57 通过 |
| 7 | T-57 未改 | **PASS** | contract 测试仅 T-58 +2 行；T-57 文本零 diff |
| 8 | T-58 仅新增“真实 analyzer 恰一次” | **PASS** | `realAnalyzer).toHaveLength(1)`；原 `analyze:` 禁止路径断言保留 |
| 9 | T-61 三处调用者不变 | **PASS** | `ops.ts` / `create-game.ts` / `publish-gate.ts`；T-61 通过；无新调用者 |
| 10 | `TemporalAuditReport` 旧字段兼容 | **PASS** | 旧结果结构子集；`expectTypeOf` + `pnpm build` + 运行时 legacy verdict |
| 11 | `MINIMAL_PUBLIC_VERDICT` 冻结 | **PASS** | `Object.freeze` 顶层 + evidence 数组 + coverage；自选断言 B1 |
| 12 | 原 JSDoc 归位 | **PASS** | 函数文档紧邻 `export function runTemporalAudit`；类型另有短文档 |
| 13 | gate `BLOCKED` / admission `false` 显式传入；公共 verdict 不产 NB/PU | **PASS** | 显式第一阶段常量；自选断言 B6 |
| 14 | phase-1 冲突不可达 | **PASS** | `gateOpen` 恒 false；自选断言 B6 直接构造 existing PU + candidate 不抛 |
| 15 | `assetId` 单一 / 多移动 Hazard | **PASS** | 代码 `movers.length === 1`；自选断言 B3 / B4 |
| 16 | 分层 catch：legacy 失败不阻断真实路径 | **PASS** | legacy 独立 try/catch 后仍执行真实路径 |
| 17 | trusted 失败 / analyzer 抛错 ⇒ IE / unknown / evidence[] / 不抛 | **PASS** | 作者失败路径测试；自选断言 B8；真实路径失败复用 existingAudit |
| 18 | `applicable:false` 短路 | **PASS** | scope 检查在任何读盘 / 分析前返回；自选断言 B9 |
| 19 | 真实路径确定性 | **PASS** | 作者确定性测试；自选断言 B7 |
| 20 | `compile-runtime.test.ts` 既有用例不再超时 | **PASS** | 43/43 通过；定向关键用例 3.4s / 4.8s / 2.4s；全量 4.2s / 13.1s / 6.1s（限 20s） |
| 21 | 全量 `pnpm test` | **PASS** | 178 files / **2933 tests** passed，exit 0，0 timeout |
| 22 | `pnpm build` / `check:deps` / `check:links` | **PASS** | 均 exit 0 |
| 23 | Amended rollback drill 真实、隔离、回 base `a0688be` | **PASS** | drill-2 三个 revert 后 tree == `a0688be`；drill commits 不在 HEAD；日志 2925 tests pass、exit 0 |
| 24 | 证据日志已纳管 / 记录完整 | **PASS** | 7 文件均入库；`commands.log` / `rollback-drill.log` 可读；SHA256SUMS 干净恢复 6/6 |
| 25 | 只写复核报告；不改产品 / 授权包 / 证据 | **PASS** | 工作树仅新增本报告；未改其他文件 |
| 26 | 不授权 U5 / U3，不开放 PUBLIC_NB / PUBLIC_PU | **PASS** | 本报告无后续授权或能力开放 |

## 5. 关键行为细节

### 5.1 decision A 分支

```text
scope = temporalScope(config)
if (!scope.applicable) => { applicable:false }（零 I/O）

existingAudit = args.existingAudit            // 不调用 auditPlayability
trusted = readTrustedAtlasInput(...)
if (!trusted.ok) => temporalFailure(existingAudit ?? MINIMAL)

legacy = 双档 stub 路径（独立 try/catch）

if (existingAudit === undefined)              // create-game / 旧调用方
  => { applicable:true, legacy verdict, coverage:"unknown", evidence:[], publicVerdict:MINIMAL }

// 仅 existingAudit 存在时
twoLag = analyzeTemporalInternalTwoLag(input, BASELINE)
evidence = toPublicTemporalEvidence(...)
publicVerdict = mapPublicVerdict({ existing:existingAudit, temporal:{applicable:true,evidence},
                                   gate:PHASE1_CAPABILITY_GATE, admission:PHASE1_CAPABILITY_ADMISSION })
```

- `ops.ts` 中**不存在** `auditPlayability` 引用；`grep` 结果为空。
- 无 `existingAudit` 时仍执行 legacy stub 路径与可信输入读取（这是 U4 前的既有接线），但不执行真实 analyzer；自选断言 B2 时间对照：legacy-only 0.4ms vs real 3.4ms（7.7x）。
- `create-game.ts` 调用点零 diff；它不传 `existingAudit`，因此保持 legacy-only。`publish-gate.ts` 同理，U5 需要显式传入其已有 audit 才能得到真实公共 evidence / verdict（amendment 已写明）。

### 5.2 架构守卫与类型

- T-57 / T-58 / T-61 文本与调用者零改动；T-58 仅 +2 行，真实 analyzer 文本恰一次。
- `TemporalAuditReport` 为旧 `TemporalAuditResult` 的结构超集；`expectTypeOf` + build 通过。
- `MINIMAL_PUBLIC_VERDICT` 顶层、`evidence` 数组、`coverage` 均 `Object.freeze`；自选断言 B1 验证。
- 原 `runTemporalAudit` 的 JSDoc（同步 / 绝不抛 / 适用才读盘）已归位到函数；类型别名有自己的短文档。

### 5.3 真实路径、gate 与 assetId

- 有 `existingAudit` 时，真实结果经 U1 adapter / U2 mapper；public verdict 在 gate BLOCKED 下不会成为 NB / PU。
- `last-train` 真实 analyzer 结果仍为 `goal-not-representable` ⇒ `coverage.temporal="unknown"`、witness `insufficient-evidence`；这是真实结果，smoke 证明字段可被 adapter 直接消费。
- `assetId` 仅单一移动 Hazard 传播；多移动 Hazard 省略（B3 / B4）。

### 5.4 失败与边界

- trusted 失败：有 `existingAudit` ⇒ 复用其 publicVerdict；无 ⇒ 冻结的 MINIMAL；均 `coverage:"unknown"`、`evidence:[]`、不抛（B8）。
- 真实 analyzer 抛错：独立 catch ⇒ `temporalFailure(existingAudit, legacy)`；不抛。
- `applicable:false`：在读取 packDir 前返回；B9 用不存在目录验证。
- phase-1：显式 BLOCKED / false 使冲突条件不可达；B6 直接构造 existing PU + `nb-candidate` 不抛。
- 确定性：B7 两次真实路径运行 `evidence` / `publicVerdict` / `coverage` 深度相等。

### 5.5 CI 超时修复

原失败原因是 `create-game` 的 `runTemporalAudit` 也跑真实分析；decision A 后 `create-game` 走 legacy-only。复核结果：

- 定向 129 tests：`compile-runtime.test.ts` 43/43；原慢用例 3364ms / **4802ms** / 2360ms。
- 全量 2933 tests：0 个 `Test timed out`；`compile-runtime.test.ts` 43/43；三个关键用例 4183ms / **13076ms** / 6090ms，均低于 20s。
- 全量仍有 3 个 vitest-worker `onTaskUpdate` 警告（runner-level，非断言失败，exit 0）。

### 5.6 Amended rollback drill

- 分支 `wayfinder/i03-u4-rollback-drill-2`：`1caf170` revert `ce6ce63`、`24c4021` revert `9b21f2d`、`870d325` revert `0b2ac97`。
- `git diff a0688be wayfinder/i03-u4-rollback-drill-2` 为空（tree 回到 base）。
- 三个 drill commit 均不在 HEAD；delivery 未被污染。
- `rollback-drill.log`：`pnpm test` 178 files / **2925 tests** passed、exit 0；已入库并由 SHA256SUMS 覆盖。
- drill 分支为本地分支（未推送）；日志已入库，树等价与提交隔离可复核。

## 6. 命令与退出码（复核人现场执行）

| 命令 | 退出码 | 输出摘要 |
| --- | --- | --- |
| `pnpm exec vitest run packages/assets/tests/ops.test.ts packages/assets/tests/compile-runtime.test.ts packages/contracts/tests/playability-temporal-input.test.ts` | **0** | 3 files / **129 tests** passed；ops 21、compile-runtime 43、contracts 65；1 个 runner 警告 |
| `pnpm test`（单独、无并发探针） | **0** | 178 files / **2933 tests** passed；**0 timeout**；3 个 runner 警告；136.74s |
| `pnpm build` | **0** | `tsc -b` + 10/11 workspace bundle 完成 |
| `pnpm check:deps` | **0** | 依赖图合法（10 个包） |
| `pnpm check:links` | **0** | 相对链接零断裂（1253 份文档 · 4159 条链接；证据日志为 1252，差 1 为报告/输入新增，二者均 exit 0） |
| 干净目录 `shasum -a 256 -c SHA256SUMS` | **0** | 6/6 OK |
| `git ls-remote` 远端 refs | **0** | evidence `d02cb63`；product `ce6ce63` |

## 7. 自选关键断言（复核人独立编写，脚本在仓库外）

| # | 断言 | 理由 | 结果 |
| --- | --- | --- | --- |
| B1 | 无 existingAudit ⇒ legacy verdict / coverage unknown / evidence [] / publicVerdict 为冻结的 MINIMAL | decision A 的核心；作者测试检查形状，未检查冻结 | **PASS** |
| B2 | 无 existingAudit 与有 existingAudit 的耗时对比：legacy-only 0.4ms vs real 3.4ms（7.7x） | 运行时佐证 create-game 不跑真实 analyzer；静态代码为决定性证据 | **PASS** |
| B3 | 有 existingAudit ⇒ evidence `witness.kind="temporal"`、`perLag.length=2`、单一 Hazard `assetId` 正确 | 验证真实路径与 assetId 规则 | **PASS** |
| B4 | 追加第二个移动 Hazard ⇒ `assetId` 省略 | 防止伪造 assetId | **PASS** |
| B5 | 传带独特 coverage + sentinel evidence 的 existingAudit ⇒ coverage / sentinel 保留，追加 temporal evidence | 区分真正复用与 fallback | **PASS** |
| B6 | 正常集成 public verdict 非 NB/PU；existing PU + `nb-candidate` + phase-1 常量不抛 | 验证 gate BLOCKED / 冲突不可达 | **PASS** |
| B7 | 两次真实路径运行 evidence / publicVerdict / coverage 深度相等 | 独立确定性验证 | **PASS** |
| B8 | trusted 失败：有 existingAudit 复用其 verdict；无则冻结 MINIMAL；均不抛 | 验证失败路径安全边界 | **PASS** |
| B9 | 无移动 Hazard + 不存在 packDir ⇒ `{applicable:false}` | 验证短路先于 I/O | **PASS** |

脚本：`/tmp/u4-am-probe.mjs`（仓库外，未修改产品文件）；9/9 PASS，退出码 0。

## 8. FAIL / NOT_RUN / 未覆盖项与限制

### 8.1 FAIL

- **无 FAIL。**

### 8.2 NOT_RUN（非阻断）

1. **复核人未重新执行 drill-2 的全量测试**：以 drill-2 ref、`tree == a0688be`、提交不在 HEAD、已入库 drill 日志与干净目录 SHA256SUMS 核对代替；不改变证据结论。
2. **未取得 CI 原始失败日志的逐字副本**：以 evidence `commands.log` 的 CI note、本地定向 / 全量 0 timeout 结果核对；原失败路径已被 decision A 消除。

### 8.3 未覆盖项 / 限制

- `last-train` 真实结果 `goal-not-representable` ⇒ `coverage.temporal="unknown"`；集成 smoke 证明真实结果可被 adapter 消费，但未覆盖 `checked` 正向路径（夹具现实，非 U4 违规）。
- legacy 路径失败注入未单独测试（`stubTemporalAnalyzer` 不会抛）；分层 catch 由代码结构核对。
- 运行时 legacy `degradation` 是否存在未断言（stub 路径通常无 degradation）。
- 失败路径的 `publicVerdict` 复用 `existingAudit`（brief §7 / amendment 授权）；U5 消费时应读 `coverage` / `evidence`，不得把失败路径的 publicVerdict 当作“temporal 已检查”。
- B2 的耗时对照基于已构建 dist，是粗粒度佐证；`ops.ts` 无 `auditPlayability` 引用 + `existingAudit === undefined` 在真实路径前返回是决定性静态证据。
- `check:links` 现场 1253 份文档 vs 证据日志 1252；两者均 exit 0，差异来自报告 / 复核输入计入时点。
- amended drill 分支为本地分支；日志与 SHA256SUMS 已入库，远端 evidence 分支为 `d02cb63`。

## 9. 独立签署

- 复核人：**fresh 独立复核会话（未参与 U4 实现）**
- 日期：**2026-11-16**
- 结论：**PASS（仅限 decision A amended U4）；无 FAIL，无阻断性 NOT_RUN。**
- 本签署不授权 U5 / U3，不开放 `PUBLIC_NB` / `PUBLIC_PU`，不授权 probe / fixture 实施。
- 复核人未修改产品代码、授权包、证据、地图或票；仅写本报告。
