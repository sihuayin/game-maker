# I03-IMPL-04 U4 独立复核报告

> 复核人：**fresh 独立复核会话**（未参与 U4 实现；未接受作者总结 / PASS 声明作为依据）
> 日期：**2026-11-16**
> 环境：Darwin 24.6.0 arm64 · Node **v22.23.2** · pnpm **10.7.1**
> 仓库：`/Volumes/shy/some-projects/game-maker`
> 分支 / HEAD：`wayfinder/level-playability-v1.1-i03-u4` / `ec98d73803f669a349067e934e4a8abd9f98e2a5`
> 复核对象 code/test head：`9b21f2ddd6a663d1c5bba78e33f830a4d97f8c1c`

## 1. 结论

**总体结论：FAIL（唯一阻断项：证据归档不完整）。**

- U4 的**代码 / 测试行为项全部 PASS**；定向测试、build、deps、links、全量测试（静默重跑）均通过。
- **阻断项**：`evidence/U4/commands.log` 与 `evidence/U4/rollback-drill.log` 被 `.gitignore` 的 `*.log` 规则排除，**未进入任何 git ref**；但 `evidence/U4/SHA256SUMS` 引用了这两个文件。fresh clone / `git clean` 后无法复核回滚演练与命令记录，违反 U4 brief §9 与授权记录 §4 对证据归档的要求。
- 修复建议（不需要改产品代码）：在 evidence-only commit 中对两日志 `git add -f`（或调整 ignore 规则），重新复算并提交 `SHA256SUMS`，然后重跑本复核的证据归档项。
- 本复核**不授权** U5 / U3，**不开放** `PUBLIC_NB` / `PUBLIC_PU`，不授权 probe / fixture 实施。

> 说明：第一遍全量测试出现 1 个超时失败；已定位为**复核探针与全量测试并发**导致的 `compile-runtime` 超时 flake，非 U4 断言失败。隔离重跑与第二遍静默全量均通过。详见 §6。

## 2. 输入 / 输出 hash

### 2.1 现场复算的输入 hash（`shasum -a 256`）

| 输入 | 现场 SHA-256 | 核对 |
| --- | --- | --- |
| `docs/v7.8/移动-I03.md`（当前 / U1+U2 Ledger 后） | `32152c0182f4282f680b06dcd576b58d05255b0b16a8f78a7e70a272feeb5a70` | 与声明 `32152c01…` 一致 |
| `docs/v7.8/移动-I03.md`（签署前，`583c777`） | `2f89d572008b538be5871fef11d9f539e16829d1f4ceafe6e25a8a250fb9a52e` | 与声明 `2f89d572…` 一致 |
| `docs/v7.8/移动-I03.md`（签署后，`9a3d520`） | `f45332bedd87209353a6f3e482408484151deed788c42996e36436437e1120cb` | 与声明 `f45332be…` 一致 |
| `.scratch/level-playability-v1.1-i03/reports/I03-review.md` | `40af4b4b243abf1fbaac5a794cf1a8ccaf32b65e3c7ed29278e1d21502feed09` | 与声明 `40af4b4b…` 一致 |
| `.scratch/level-playability-v1.1-i03-impl/reports/U4-incremental-authorization.md` | `e101a6506ae2a7715dfda70131ba068e470588dd76b6fb7409b0fc2b1c797937` | 现场计算（输入包未声明完整值） |
| `.scratch/level-playability-v1.1-i03-impl/reports/U4-review-input.md` | `641e4fbbddcd56577a306a7e5c85dc1b3ce8a9ee680b2e9acf49882eb314ce3a` | 现场计算 |

### 2.2 `evidence/U4` 现场 hash 与 `SHA256SUMS`

| 证据文件 | 现场 SHA-256 | `SHA256SUMS` 核对 |
| --- | --- | --- |
| `commands.log` | `5c7266a95e3e8264a54342eaacaea0075293a8927ccf398c01ab3cddb02892e4` | OK（**但未入库**） |
| `invariant-before.txt` | `6507fd79207368b22c7872af129620f99ca42aac621a77cbe971321d4fa64541` | OK |
| `invariant-after.txt` | `248eddd877c0c9585b6b9183615c741841e9054320bd56003ba0c986990a5aca` | OK |
| `targeted-test-output.txt` | `553c00dd5837daba0adde8d2cf8116682ce158ca66b8b1c7177dd872debf93a8` | OK |
| `test-output.txt` | `1fc42120f5d441c9a62503fbf9f8168d3a2d1decf6ac4a945e6501788487d5bd` | OK |
| `rollback-drill.log` | `8b945a5aefac27275bcb7746509db1753ea6b867ca62255cdf3581e95cd867e4` | OK（**但未入库**） |
| `SHA256SUMS` 自身 | `89bc177cf60e15ab18254a4594bc92d99e18ed24e1453c1bf4b0e52ba5fe77aa` | 不适用 |

`cd evidence/U4 && shasum -a 256 -c SHA256SUMS`：6/6 OK，退出码 0（**仅在本工作区成立**；见 §8 FAIL）。

### 2.3 输出

| 输出 | 路径 | SHA-256 |
| --- | --- | --- |
| 本复核报告 | `.scratch/level-playability-v1.1-i03-impl/reports/U4-review.md` | 写盘后复算，随交付回报给出（自引用不写入正文） |

## 3. Diff scope

`git diff a0688be..9b21f2d -- packages` 仅 3 个文件：

| 文件 | 增 / 删 |
| --- | --- |
| `packages/assets/src/ops.ts` | +100 / -10 |
| `packages/assets/tests/ops.test.ts` | +105 / -2 |
| `packages/contracts/tests/playability-temporal-input.test.ts` | +2 / -0 |

逐文件核对：

- 三文件均落在授权包 §11.2 U4 白名单（ops.ts、ops.test.ts、仅 T-58）。
- `temporal.ts` / `temporal-result.ts` / `publish-gate.ts` / `mechanic.ts` / `create-game.ts`：**零 diff**。
- U1 / U2 源与测试（`temporal-evidence.ts` / `public-verdict.ts` / `playability-public-verdict.test.ts` / `playability-temporal-evidence.test.ts`）：**零 diff**。
- `fixtures/`、`package.json`、`pnpm-lock.yaml`、`tsconfig*`：**零 diff**；无新依赖。
- 证据 commit `ec98d73` 只含 `.scratch/level-playability-v1.1-i03-impl/` 下证据与复核输入；远端产品分支 `origin/wayfinder/level-playability-v1.1-i03-u4` 停在 `9b21f2d`，远端证据分支 `origin/wayfinder/i03-u4-evidence` 为 `ec98d73`。
- `git diff --check`：无空白错误。

提交序列：`a0688be`（U4 授权 docs 合入 main）→ `0b2ac97`（ops）→ `9b21f2d`（测试）→ `ec98d73`（evidence-only）。

## 4. 逐项结论

| # | 检查项 | 结论 | 依据 |
| --- | --- | --- | --- |
| 1 | 授权包 / 审查报告 / U4 授权记录 / 复核输入完整 hash | **PASS** | 现场 `shasum -a 256`；历史签署前后版本从 `git show` 复算 |
| 2 | `evidence/U4/SHA256SUMS` 内容一致 | **PASS（仅本工作区）** | `shasum -a 256 -c` 6/6 OK；但 2 个文件未入库（见 #16 FAIL） |
| 3 | Diff 逐文件落在 U4 白名单 | **PASS** | 仅 3 文件；零 diff 清单见 §3 |
| 4 | legacy `auditPlayabilityTemporal` + `stubTemporalAnalyzer` 仍在 | **PASS** | `ops.ts` 保留 legacy 双档调用与 stub；T-57 通过 |
| 5 | T-57 未改 | **PASS** | `playability-temporal-input.test.ts` 仅 +2 行，均在 T-58 内 |
| 6 | T-58 仅新增“真实 analyzer 恰一次” | **PASS** | 新断言 `realAnalyzer).toHaveLength(1)`；原有 `hits` 禁止路径断言原样保留 |
| 7 | T-61 三处调用者不变 | **PASS** | `create-game.ts` / `publish-gate.ts` 零 diff；T-61 通过；无新增生产调用者 |
| 8 | `TemporalAuditReport` 对旧 `TemporalAuditResult` 兼容 | **PASS** | 类型为旧结果的结构超集；`expectTypeOf` 断言 + `pnpm build` 通过；运行时 `report.verdict` 存在 |
| 9 | optional `existingAudit` 复用 / fallback | **PASS** | `args.existingAudit ?? auditPlayability(...)`；自选断言 A3 证明传入时保留其 coverage/evidence；不传时集成 smoke 走 fallback |
| 10 | 真实路径 `analyzeTemporalInternalTwoLag → toPublicTemporalEvidence → mapPublicVerdict` | **PASS** | `ops.ts` 代码逐行核对；无测试专用转换层 |
| 11 | 第一阶段 gate `BLOCKED` / admission `false` 显式传入 | **PASS** | 显式 `PHASE1_CAPABILITY_GATE` / `PHASE1_CAPABILITY_ADMISSION`，无默认值 |
| 12 | 公共 verdict 不因 gate `BLOCKED` 成为 NB / PU | **PASS** | mapper 语义 + 自选断言 A4；U2 矩阵测试 gate BLOCKED ⇒ IE |
| 13 | `assetId` 仅单一移动 Hazard；多 Hazard 省略 | **PASS** | 代码 `movers.length === 1`；自选断言 A1 / A2 |
| 14 | 分层 catch：legacy 失败不阻断真实路径 | **PASS** | legacy 独立 try/catch 后仍执行真实路径；代码结构核对 |
| 15 | 真实 analyzer 抛错 / trusted 失败 ⇒ IE / unknown / evidence[] / 不抛 | **PASS** | 作者测试两条失败路径 + 自选断言 A7；`report.verdict=IE`、`coverage=unknown`、`evidence=[]`；`publicVerdict` 按 brief §7 复用 existingAudit |
| 16 | phase-1 冲突不可达 | **PASS** | 显式 BLOCKED / false 使 `gateOpen` 恒 false；U2 测试 `gate BLOCKED ⇒ 不冲突`；自选断言 A4 直接构造 existing PU + candidate 不抛 |
| 17 | `applicable:false` 零分析 | **PASS** | `temporalScope` 不适用时在 `auditPlayability` / 读盘之前返回；自选断言 A6 用不存在 packDir 仍返回 `{applicable:false}` |
| 18 | 两次运行 public evidence / verdict 深度相等 | **PASS** | 作者确定性测试；自选断言 A5 `JSON.stringify` 深度相等 |
| 19 | 真实 analyzer 集成 smoke 无测试专用转换层 | **PASS** | 直接调用 `runTemporalAudit` + 真夹具；mock 只出现在“注入抛错”测试 |
| 20 | `ops.test.ts` mock 仅用于注入抛错 | **PASS** | 全文仅一处 `vi.doMock`，位于“真实 analyzer 抛错”用例 |
| 21 | 回滚演练真实执行 | **PASS** | 本地 drill 分支 `d5e4070`（两个 revert）；`git diff a0688be..drill` 为空；日志 2925 tests pass |
| 22 | 回滚演练与 delivery 隔离 | **PASS** | drill commit `f4e9d5d` / `d5e4070` 均不在 delivery；工作树干净；delivery 未被污染 |
| 23 | 回滚演练记录完整 / 可复核 | **FAIL** | 日志与 `commands.log` 被 `*.log` ignore，`git rev-list --all --objects` 中无对应 blob；SHA256SUMS 引用未入库文件 |
| 24 | 定向 / 全量 / build / deps / links 命令 | **PASS（全量首跑 flake 已定位）** | 退出码见 §6；首跑 1 个超时失败，隔离重跑与第二遍静默全量通过 |
| 25 | 只写复核报告；不改产品 / 授权包 / 证据 / 地图 / 票 | **PASS** | 工作树 `git status` 干净；仅新增本报告 |
| 26 | 不授权 U5 / U3，不开放 PUBLIC_NB / PUBLIC_PU | **PASS** | 本报告不含任何后续授权或能力开放 |

## 5. 关键行为核对细节

### 5.1 legacy 路径与架构守卫

- `runTemporalAudit` 仍保留 `auditPlayabilityTemporal(..., { analyze: stubTemporalAnalyzer })` 的 legacy 双档计算，结果经 `resolveTwoLagResults` 生成 legacy `verdict` / `degradation`。
- T-57 断言未改；T-61 三处生产调用者（`ops.ts` / `create-game.ts` / `publish-gate.ts`）未改；T-60 同步性断言未改。
- T-58 只新增两行：`ops.ts` 中 `analyzeTemporalInternalTwoLag(` 恰好一次；原有“生产 `analyze:` 实参只能有 `stubTemporalAnalyzer`”与“`stubTemporalAnalyzer` export”断言原样保留。

### 5.2 返回类型兼容

`TemporalAuditReport` 的 `applicable:true` 分支包含旧 `TemporalAuditResult` 的 `verdict` + 可选 `degradation`，旧类型是其结构子集；`expectTypeOf<TemporalAuditReport>().toMatchTypeOf<TemporalAuditResult>()` 通过，`pnpm build` 证明 `create-game` / `publish-gate` 现有调用点编译通过。运行时 legacy 字段在集成 smoke 中可读。

### 5.3 路径组合与 existingAudit

- 无 `existingAudit`：内部 `auditPlayability(config, manifest)` fallback；集成 smoke 未传，public verdict 为 `INSUFFICIENT_EVIDENCE`。
- 传 `existingAudit`：不重复调用 `auditPlayability`；自选断言 A3 用带独特 coverage + sentinel evidence 的 audit 证明其被复用，且 mapper 正确移除旧 temporal evidence、追加新 temporal evidence。
- 真实夹具 `last-train` 的 `temporalScope.applicable=true`；`readTrustedAtlasInput` 用 `atlasDigest`（`sha256:` 前缀）通过校验；真实 analyzer 返回 `goal-not-representable`（映射 `invalid-input`），因此公共 `coverage.temporal="unknown"`、witness `insufficient-evidence`、public verdict IE。该结果是真实分析结果，不是测试桩。

### 5.4 gate / admission / 公共 verdict

`mapPublicVerdict` 显式收到第一阶段常量；`gateOpen` 在 `BLOCKED` / `false` 下恒 false。因此 temporal `nb-candidate` / `pu-candidate` 只会落为 IE，不会产生公共 NB / PU；existing PU 也不会触发 `PublicVerdictConflictError`。自选断言 A4 直接以 existing PU + `nb-candidate` + 第一阶段常量调用 mapper，确认不抛且保持 PU。

### 5.5 assetId

`movers = entities.filter(kind === "hazard" && motion !== undefined)`；仅当恰好 1 个时取 `movers[0].asset`，否则省略。自选断言 A1（last-train 单一移动 Hazard `carriage` ⇒ `hazard-sweeping-carriage`）与 A2（追加第二个移动 Hazard ⇒ `assetId===undefined`）均通过。

### 5.6 异常分层

- legacy 失败：独立 catch 将 legacy 置为 IE，不阻断真实路径。
- 真实 analyzer 抛错 / adapter / mapper 失败：独立 catch 返回 `coverage:"unknown"`、`evidence:[]`、legacy `verdict:"INSUFFICIENT_EVIDENCE"`，`publicVerdict` 复用 `existingAudit`；若无 `existingAudit`，最外层 catch 返回最小安全 verdict（IE、空 evidence、三维 `not-checked`）。绝不抛。
- trusted 不可用：在 legacy / 真实路径之前返回 `unknown` / `evidence:[]` / IE legacy；不抛。
- phase-1 冲突不可达：代码 + mapper 测试 + 自选断言 A4 三重确认。

> 语义提示（供 U5）：失败路径的 `publicVerdict` 是**已有 audit**（可能是 NB），temporal 失败由 `coverage:"unknown"` / `evidence:[]` / legacy `verdict` 表达。U5 消费时必须读 `publicVerdict` 的 `coverage` / `evidence`，不得把失败路径的 `publicVerdict` 当作“temporal 已检查”。

### 5.7 applicable:false 与确定性

- `temporalScope` 不适用时在 `auditPlayability` 与任何 `fs` 读取之前返回 `{applicable:false}`；自选断言 A6 用不存在目录验证不触发 I/O 异常路径。
- 作者确定性测试与自选断言 A5 均确认两次运行 `publicVerdict` / `coverage` / `evidence` 深度相等；公共 evidence 不含 `wallClockMs`。

### 5.8 集成 smoke 与 mock

集成 smoke 直接使用 `fixtures/game-configs/last-train.json` + `fixtures/packs/last-train/v2` 调用公共 `runTemporalAudit`，断言 public verdict、coverage、evidence（`witness.kind==="temporal"`、`lag.perLag.length===2`、`model.conditional===true`）；没有测试专用转换层。`vi.doMock` 仅用于注入 `analyzeTemporalInternalTwoLag` 抛错。

### 5.9 回滚演练

- drill 分支 `wayfinder/i03-u4-rollback-drill`：`f4e9d5d` revert `9b21f2d`、`d5e4070` revert `0b2ac97`；`git diff a0688be..wayfinder/i03-u4-rollback-drill` 为空（tree 回到 base）。
- drill 日志记录 `pnpm test`：178 files / 2925 tests passed、exit 0；与 delivery 2932 tests 相差 7 个，正好是 U4 新增的 7 个测试，支持 revert 完整。
- drill commit 不在 delivery 分支；delivery 工作树干净；delivery 远端产品分支停在 `9b21f2d`。
- **但日志本身未入库**（见 §8 FAIL）。

## 6. 命令与退出码（复核人现场执行）

| 命令 | 退出码 | 输出摘要 |
| --- | --- | --- |
| `pnpm exec vitest run packages/assets/tests/ops.test.ts packages/contracts/tests/playability-temporal-input.test.ts` | **0** | 2 files / **85 tests** passed；ops 20 tests，contracts 65 tests |
| `pnpm test`（第一遍，后台；与复核探针并发） | **1** | 178 files / 2932 tests：**1 failed**；`packages/assets/tests/compile-runtime.test.ts > 编译：一次调用 → 一份落盘的配置 > **绝不覆盖**：编两次就是 v1 与 v2` **Test timed out in 20000ms（实际 21818ms）**；另有 3 个 runner `onTaskUpdate` timeout 警告 |
| `pnpm exec vitest run packages/assets/tests/compile-runtime.test.ts`（隔离重跑） | **0** | 1 file / **43 tests** passed；失败用例耗时 **7542ms** |
| `pnpm test`（第二遍，静默、无并发探针） | **0** | 178 files / **2932 tests** passed；2 个 runner `onTaskUpdate` 警告（非断言失败） |
| `pnpm build` | **0** | `tsc -b` + 10/11 workspace bundle；demo / cli / mcp bundle 完成 |
| `pnpm check:deps` | **0** | 依赖图合法（10 个包） |
| `pnpm check:links` | **0** | 相对链接零断裂（1250 份文档 · 4159 条链接；证据日志为 1249，差 1 为新增复核输入文档） |

**对第一遍失败的逐项判断**：失败用例不在 U4 diff 中，也不包含 U4 新增断言；它是无显式 timeout 的慢用例（隔离 7542ms），第一遍与复核人自己的 analyzer 探针并发导致 CPU 争用，跨过默认 20s。隔离重跑与第二遍静默全量均通过。**未用总通过率掩盖**：唯一失败用例已具名、已隔离重跑。U4 确实给该用例路径（`compileRuntime → runTemporalAudit`）增加了真实分析耗时，建议后续为这类慢用例显式设置 timeout 或降低并行争用（非 U4 阻断项）。

## 7. 自选关键断言（复核人独立编写，脚本在仓库外）

| # | 断言 | 理由 | 结果 |
| --- | --- | --- | --- |
| A1 | last-train 单一移动 Hazard ⇒ `evidence[0].assetId === "hazard-sweeping-carriage"` | 作者测试未断言 `assetId`；这是 brief 的显式规则，必须独立验证 | **PASS** |
| A2 | 追加第二个移动 Hazard ⇒ `assetId === undefined` | 验证“多 Hazard 省略、不得伪造”，防止把首个 Hazard 硬塞给证据 | **PASS** |
| A3 | 传带独特 coverage + sentinel evidence 的 existingAudit ⇒ 其 coverage 保留、sentinel 保留、仅追加一条 temporal evidence | 作者“existingAudit 可复用”用例未证明没有重复 `auditPlayability`；该断言能区分复用与 fallback | **PASS** |
| A4 | 正常集成 public verdict 非 NB/PU；直接以 existing PU + `nb-candidate` + 第一阶段 gate/admission 调 mapper 不抛且保持 PU | 验证 phase-1 冲突不可达与“gate BLOCKED 不产公共 NB/PU” | **PASS** |
| A5 | 同一真实输入两次运行，`evidence` / `publicVerdict` / `coverage` 深度相等 | 独立验证确定性，不依赖作者测试 | **PASS** |
| A6 | 无移动 Hazard + 不存在 packDir ⇒ 返回 `{applicable:false}` | 近似验证“applicable:false 零分析 / 零 I/O” | **PASS** |
| A7 | 有移动 Hazard + 不存在 packDir ⇒ `unknown` / `evidence:[]` / 不抛 | 独立验证 trusted 失败的收敛行为 | **PASS** |

脚本：`/tmp/u4-probe.mjs`（仓库外，未修改任何产品文件）；7/7 PASS，退出码 0。

## 8. FAIL / NOT_RUN / 未覆盖项与限制

### 8.1 FAIL（阻断）

1. **证据归档不完整（回滚演练 / 命令记录）**
   - `evidence/U4/commands.log`、`evidence/U4/rollback-drill.log` 命中 `.gitignore:17:*.log`。
   - `git ls-files evidence/U4` 仅列为 5 个文件（不含两日志）；`git rev-list --all --objects | grep evidence/U4/.*\.log` 无结果；远端 `origin/wayfinder/i03-u4-evidence` 同样不含。
   - `SHA256SUMS` 却引用两者。fresh clone / `git clean -fdx` 后 `shasum -c` 将因缺文件失败，回滚演练无法复核。
   - 修复：evidence-only commit 中 `git add -f` 两日志（或调整 ignore 规则），重新提交并复算 `SHA256SUMS`；无需改产品代码。

### 8.2 非阻断风险 / flake

2. **全量测试首跑超时 flake**：见 §6；隔离重跑 + 第二遍静默全量通过。U4 在该用例路径上增加了真实分析耗时，建议后续给慢用例显式 timeout 或做性能基线；不改变本次 U4 行为结论，但应在 U5 前关注。

### 8.3 NOT_RUN

3. **未由复核人重新执行回滚演练**：本次以 drill 分支 ref、tree 对比、日志内容与 test 计数核对；未再次 checkout drill 分支重跑（避免改变交付工作树）。
4. **未做 base 侧 compile-runtime 独立性能基线**：未在 base tree 上单独计时；flake 归因基于“并发探针 + 隔离重跑”证据，而非严格基准。

### 8.4 未覆盖 / 限制

5. 真实夹具 `last-train` 的内部结果是 `goal-not-representable` ⇒ `invalid-input`，因此集成 smoke 证明“真实结果可被 adapter 直接消费”，但**未覆盖 `coverage.temporal="checked"` 的正向路径**；这是夹具现实，不是 U4 违规。
6. legacy 路径失败注入未单独测试（`stubTemporalAnalyzer` 不会抛）；分层 catch 由代码结构核对。
7. 运行时 legacy `degradation` 是否存在未断言（stub 路径通常无 degradation；实现按条件保留）。
8. 失败路径的 `publicVerdict` 复用 `existingAudit`（brief §7 授权）；若 existingAudit 带旧 temporal evidence，`temporalFailure` 未像 mapper 那样剥离旧 temporal evidence。当前生产调用者传入的 audit 不含 temporal evidence，暂不可达；建议 U5 消费前明确。
9. `TemporalAuditReport` 的 JSDoc 位置：原 `runTemporalAudit` 文档注释现在紧邻类型别名，函数本身失去 JSDoc（代码质量小问题，不影响行为）。
10. 外层 catch 的 `MINIMAL_PUBLIC_VERDICT` 是模块级共享对象（类型只读、运行时未冻结）；若被 JS 消费方原地修改，会影响后续 fallback。当前无此调用者。

## 9. 独立签署

- 复核人：**fresh 独立复核会话（未参与 U4 实现）**
- 日期：**2026-11-16**
- 结论：**FAIL（仅证据归档完整性；代码 / 测试行为项 PASS）**
- 本签署只覆盖 U4 的独立复核，不授权 U5 / U3，不开放 `PUBLIC_NB` / `PUBLIC_PU`，不授权 probe / fixture 实施。
- 复核人未修改产品代码、授权包、证据、地图或票；仅写本报告。
