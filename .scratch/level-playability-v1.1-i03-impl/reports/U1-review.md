# I-03 U1 独立复核报告

| 项 | 值 |
| --- | --- |
| 复核对象 | I-03 实施单元 U1（contracts 公共 temporal 类型 + 纯适配器） |
| 复核人 | fresh 独立复核会话（未参与 U1 实现，未接触实现者对话；只依据输入包、git 历史与现场命令） |
| 日期 | 2026-11-16 |
| 分支 / HEAD | `wayfinder/level-playability-v1.1-i03-u1` / `b020fcf16e93ce7a21e669d44ae2ba960f56d0e7` |
| Base / code-test head | `c432409e08d735570e8702ecda25e45e187b4992` / `25e8d784259b0aeb456dd1ec008cc29397b6519a` |
| 环境 | Darwin 24.6.0 arm64 · Node v22.23.2 · pnpm 10.7.1 · vitest 3.2.7 |
| 工作树 | 复核开始时 `git status --porcelain` 为空；复核仅新增本报告 |

> 本报告不使用作者总结 / PASS 声明作为依据；下列结论均来自现场 hash 复算、git diff 阅读、独立运行时探针与我本人重跑的命令。

## 1. 输入 hash（现场 `shasum -a 256` 完整复算）

| 输入 | 现场复算 sha256 | 与声明比对 |
| --- | --- | --- |
| `docs/v7.8/移动-I03.md`（签署后） | `f45332bedd87209353a6f3e482408484151deed788c42996e36436437e1120cb` | 与授权包 / 授权记录全文一致 |
| 同上（签署前，`git show 583c777:…`） | `2f89d572008b538be5871fef11d9f539e16829d1f4ceafe6e25a8a250fb9a52e` | 与签署记录一致 |
| `.scratch/level-playability-v1.1-i03/reports/I03-review.md` | `40af4b4b243abf1fbaac5a794cf1a8ccaf32b65e3c7ed29278e1d21502feed09` | 一致 |
| `.scratch/level-playability-v1.1-i03-impl/reports/U1-incremental-authorization.md` | `7b6a177216b7dff6250e49d90cd2558dcf3ac5e76ce15c7e5c442eb571595d92` | 记录自身未声明 hash；文件在 `85943f4` 合入后工作树零 diff |
| `.scratch/level-playability-v1.1-i03-impl/issues/02-i03-impl-u1.md` | `4b7a97a3592ce175f49205d6d3a6e4172ce69616640eda1830fa0b1d31be5b75` | — |
| `.scratch/level-playability-v1.1-i03-impl/reports/U1-review-input.md` | `172a70e87da34357e245fd44d9e8e291e2f890fa25604c641730f803e70363c2` | — |
| `reports/U1-dependency-check.md`（brief 引用） | `825924af8b106418e112a84c386326663771e1cfc1aa55b8d1fc0e423f105936` | 一致 |
| `evidence/10-f2-correction.md`（授权记录引用） | `17ea5f9137b9dbf3dbf7ab715fc26e598c0ee419ff94794a9b974584086a8c2a` | 一致 |

### 1.1 证据目录 `evidence/U1/`

现场对全部文件重算，逐项与 `SHA256SUMS` 比对：

| 文件 | 现场 sha256 | SHA256SUMS |
| --- | --- | --- |
| `invariant-before.txt` | `0c0f340059d9627c8d6dffabdd02a0d6bb166f449d5d88e3c273dedbc06bfd21` | 一致 |
| `invariant-after.txt` | `d8a4240fc7b11799b20c9a83eeb19b9491b4d9a5e68e195f406f9416f4c8574b` | 一致 |
| `targeted-test-output.txt` | `3237d1bddf0bf9237e824486a4cabc0ba67daca4e8e6bd5e9b95774a480b2d34` | 一致 |
| `test-output.txt` | `5ce64cb7f5d19b49e4fee2a10d4d4ce37f59f0b659d6ec39a7bb76a319132acd` | 一致 |
| `commands.log` | `c93f93764a4de253f447ff128a3b0274d45a03357d2eb6519845bee21ee3bdd9` | 一致 |
| `SHA256SUMS` 自身 | `adc150dfd14e1e7439f2a44f9ca7005b2c81334aed72e568da54a6328339c54b` | — |

### 1.2 不变量（独立复算）

- `packages/contracts/src/playability/temporal.ts`：工作树与 `c432409` 的 sha256 均为 `6df8475822717d7e06a611e2e539785a3f8c9f67719e93d07e03d6373ef7ce53`。
- `packages/contracts/src/playability/temporal-result.ts`：工作树与 `c432409` 的 sha256 均为 `04e3c37ca140fa09b3ea1eabf0d0d3336c06cdda2cdeafde719c5b44c6d343fc`。
- 两文件的 `publicCapability: "BLOCKED"` / `publicResult: null` 行原位存在（`temporal.ts:380-381`、`temporal-result.ts:44-45`）。
- 与 `evidence/U1/invariant-before.txt` / `invariant-after.txt` 记录的 hash 与行号一致。
- `PUBLIC_NB` / `PUBLIC_PU` 仍只存在于文档叙述中，代码内无放行开关；adapter 不产出公共 Verdict。

## 2. diff scope

`git diff --name-status c432409..25e8d78` 全部变更（共 5 个文件，均在授权包 §11.2 U1 白名单内）：

| 文件 | 操作 | 增 / 删 | 限定目的核对 |
| --- | --- | --- | --- |
| `packages/contracts/src/playability/verdict.ts` | M | +94 / −0 | 纯加法类型；无任何删除行；未改既有 coverage 三维语义 |
| `packages/contracts/src/playability/temporal-evidence.ts` | A | +210 / −0 | 纯适配器；只读 import |
| `packages/contracts/src/playability/api.ts` | M | +11 / −3 | 仅 export 列表替换；未加逻辑、未加调用者 |
| `packages/contracts/tests/playability-api.test.ts` | M | +23 / −1 | 唯一删除为 import 行替换；既有断言零改动 |
| `packages/contracts/tests/playability-temporal-evidence.test.ts` | A | +400 / −0 | 新增适配器矩阵 |

受保护文件零 diff（现场 `git diff` 为空）：`temporal.ts`、`temporal-result.ts`、`ops.ts`、`publish-gate.ts`、`mechanic.ts`、`packages/**/fixtures/**`。`package.json` / `pnpm-lock.yaml` / `tsconfig*` / `scripts/**` / `docs/**` / `.github/**` 亦零 diff。code/test diff 内容 hash：`git diff c432409..25e8d78 -- packages | shasum -a 256` = `ac729fb1c5f7329663e3d8875f7ea7fc1442436017ea443b17717d7e6a2bd13e`。

`b020fcf` 仅新增 `.scratch/` 证据与复核输入包；未触碰产品文件。

## 3. 逐项检查（PASS / FAIL / NOT_RUN）

### 3.1 输入包 §5 清单

| # | 检查项 | 结论 | 依据 |
| --- | --- | --- | --- |
| 1 | 20 个 D9 码 → 13 个公共值完整覆盖 | **PASS** | 源码映射 20 键集与内部 `DegradationReason` 联合逐字相等；探针 A1 枚举全部 20 码，公共值去重恰好 13 |
| 2 | 未知码不原样透传 | **PASS** | `DEGRADATION[reason] ?? "invalid-input"`；探针 A2 注入 `totally-unknown-code`，输出 `invalid-input` 且 JSON 无原码 |
| 3 | `secondary` 去重 + 字典序 | **PASS** | `[...new Set(...)].sort()`；探针 B1 用乱序重复输入得到 `["model-out","no-witness","witness-volume"]` |
| 4 | `COMPLETE` ⇒ `reason=null` / `secondary=[]` | **PASS** | 探针 A10：即使内部 `secondaryReasons` 非空也清零 |
| 5 | `coverage.temporal` checked / partial / unknown | **PASS** | 探针 B2（单档 exhausted ⇒ partial）、B4（model-out ⇒ unknown）、A3（双档 complete ⇒ checked） |
| 6 | `lag-disagreement` + 两档 complete 的边界 | **PASS** | 探针 A3：combined 为 IE + `lag-disagreement`、两档 complete ⇒ `coverage.temporal="checked"`、`degradation.reason="lag-disagreement"` |
| 7 | `perLag` 恰好两项、顺序、`lagMs` | **PASS** | 探针 B3：长度 2、`[16.67, 200]` 顺序、逐档 `internalResult` 独立 |
| 8 | `perLag` 不含 Witness / proof / stats | **PASS** | 探针 B3/A7 逐键断言；源码 `conclusionOf` 只取 5 个字段 |
| 9 | `limits` 字段完整 | **PASS** | 探针 A4 断言 budgetStatus / budgetKind / witnessTransitions / witnessBytes / maxWitnessTransitions / maxWitnessBytes / geometryCoverage |
| 10 | `hopSamplesChecked=0` 且不冒充 `maxHopSamples` | **PASS** | 探针 A4 取 `hop=0`、`maxHopSamples=4242`，两字段独立保留；源码分别读 `stats.work.hopSamplesChecked` 与 `budgetProfile.maxHopSamples` |
| 11 | 公共输出不含完整 proof / Witness / Stats / 内部专用原因码 | **PASS** | 探针 A1b / A7 / B5；permanent-gate 输出仅 6 条 `puConditions`，无 `verifications` / `determinismSignature`，顶层键均在白名单内 |
| 12 | 非时序 evidence 不带 `model/lag/degradation/limits` | **PASS** | 定向测试 `§U1 公共 temporal evidence 导出 / 非时序回归` 通过；且全部非时序 evidence 生产代码零 diff（变更集仅 5 文件） |
| 13 | 输入不可变 | **PASS** | 探针 A5 对 `twoLag` / `existingCoverage` 深度冻结后调用，严格模式无 TypeError，调用后内容一致 |
| 14 | `assetId` 有 / 无 | **PASS** | 探针 A9：非空保留、缺失 / 纯空白省略（键不存在） |
| 15 | invalid lag ⇒ `RangeError` | **PASS** | 探针 A6：`-1`、`NaN`、`Infinity`、字符串均抛 `RangeError`，不产出 evidence |
| 16 | `PlayabilityWitness` temporal 变体 | **PASS** | 探针 A7c：`kind="temporal"` + result / certificateKind / certificateStatus / degradation 齐备；顶层不含 `verdict` |
| 17 | `certificate.kind="none"` ⇒ `INCOMPLETE` | **PASS** | 探针 A8：`certificateStatus="INCOMPLETE"` 且 `degradation.reason` 非 null（内部主因为 null 时保守落 `invalid-input`） |

### 3.2 边界 / 权限门

| 检查项 | 结论 | 依据 |
| --- | --- | --- |
| diff 逐文件落在 U1 白名单 | **PASS** | 5 文件，无白名单外改动 |
| 受保护文件零 diff | **PASS** | `temporal.ts` / `temporal-result.ts` / `ops.ts` / `publish-gate.ts` / `mechanic.ts` / fixtures |
| 无新依赖 / lockfile / tsconfig / 脚本 / docs 变更 | **PASS** | `git diff --name-only` 零命中；`pnpm check:deps` exit 0 |
| 无新增 `runTemporalAudit` / `auditPlayabilityTemporal` / `verifyTemporalInput` 生产调用者 | **PASS** | diff 中三者仅出现在既有 export 行 |
| `api.ts` 改动仅限 U1 职责 | **PASS** | 仅新增公共类型 / 适配器导出 + `@internal` 的 `analyzeTemporalInternalTwoLag` / `TemporalTwoLagInternalResult`（brief 明确为 U4 入口） |
| `publicCapability="BLOCKED"` / `publicResult=null` 不变 | **PASS** | 见 §1.2 |
| 未设置任何 NB / PU 能力 | **PASS** | 适配器只产出 evidence，不产出公共 Verdict / gate 状态 |
| 未引入墙钟语义 | **PASS** | 适配器不读 `stats.timing`、不分支于时间；无 Date / performance |

### 3.3 明确 NOT_RUN（超出 U1，不计入本单元缺陷）

| 项 | 状态 | 理由 |
| --- | --- | --- |
| 真实 analyzer smoke | **NOT_RUN** | brief 明确移交 U4；U1 不得引入跨包依赖 |
| 公共 Verdict 映射 / 能力门 | **NOT_RUN** | U2 |
| `ops.ts` 生产接线 | **NOT_RUN** | U4 |
| `publish-gate` 诊断消费 | **NOT_RUN** | U5 |
| 几何 probe / PU 条件 2、5 | **NOT_RUN** | phase-1 硬阻断，未授权 |
| U1 回滚演练 | **NOT_RUN** | 授权记录只要求文档化回滚，不演练 |
| 跨进程确定性 | **NOT_RUN** | 属最终验收 / U4 范围 |

## 4. 本人重跑的命令与退出码

| 命令 | 退出码 | 输出摘要 | 日志 sha256 |
| --- | --- | --- | --- |
| `pnpm exec vitest run packages/contracts/tests/playability-temporal-evidence.test.ts packages/contracts/tests/playability-api.test.ts` | **0** | 2 files / 35 tests passed（适配器 24 + API 11） | `efcd4aff3946be42875866ff7fbbc334b88a4d7bcd5bad05f0dfc4697a6e31fe` |
| `pnpm test` | **0** | 177 files / 2903 tests passed；2 个 vitest-worker `onTaskUpdate` 超时未处理错误 | `d9a0b36b5034db51cd5d2acf9e8b4cbba67a8d2ca221e0ee156f2a488a5eaa28` |
| `pnpm build` | **0** | `tsc -b` + demo/cli/mcp bundle 全部完成 | `7a00047b1e256208d06bfaca72d5a79ad627dfe732a34317b02d5c3c91133095` |
| `pnpm check:deps` | **0** | 依赖图合法（10 个包） | `3d0dc5890b6b781d40dfe60d42610d40eb57b01010e1b56db37af0a74c8079c9` |
| `pnpm check:links` | **0** | 相对链接零断裂（1248 份文档 · 4159 条链接） | `05297046934cd241185b23675d8b6cdb81068655509f4047f73c1d0367467c41` |

说明：`pnpm test` 的 2 个未处理错误为 vitest worker RPC 超时（runner 级，非断言失败，退出码仍 0）；与 `evidence/U1/test-output.txt` 末尾的 `Errors 2 errors` 一致。`commands.log` 摘要写作「3 …timeout warnings」，与实际证据文件及本次重跑的 2 个有出入，属摘要笔误，不影响测试结论。`check:links` 本次为 1248 份文档（证据为 1247），因 `b020fcf` 新增 `U1-review-input.md` 后重跑，属非实质差异。

## 5. 自选关键断言（独立于作者测试）

运行方式：`pnpm build` 后由 `/tmp/u1-independent/probe.mjs`（sha256 `80c6ab8d…`）与 `/tmp/u1-independent/probe2.mjs`（sha256 `b2e598ca…`）直接 import `packages/contracts/dist/playability/temporal-evidence.js`，自建符合内部契约形状的输入，不调用作者测试文件。

| # | 断言 | 理由 | 结果 |
| --- | --- | --- | --- |
| S1 | 枚举全部 20 个 `DegradationReason`，公共 `reason` 去重恰好 13 个，且 10 个仅内部码字符串不出现在输出 JSON | 「many-to-one 完整覆盖」无法由少量样例证明；必须覆盖整个内部闭集，且防泄漏要按原始码精确检查 | **PASS**（A1 / A1b） |
| S2 | 两档 `budgetStatus="complete"` + combined 为 `insufficient-evidence` + `lag-disagreement` ⇒ `coverage.temporal="checked"` 且 `degradation.reason="lag-disagreement"` | 这是最容易被误实现成 `partial` 的边界；若降级会改变公共 coverage 语义，且 brief 明确禁止 | **PASS**（A3） |
| S3 | 深度冻结 `twoLag` 与 `existingCoverage` 后调用适配器不抛错、内容不变 | 普通测试只能证明输出未变，无法排除对输入的临时写；冻结 + 严格模式可把任何写操作变成异常 | **PASS**（A5 / A5b） |
| S4 | `hopSamplesChecked=0` 与 `maxHopSamples=4242` 同时保留且不相等 | 授权包要求「不冒充 maxHopSamples」；若实现把两者混用，相同值测试无法发现 | **PASS**（A4） |

探针共 19 条，全部 PASS；无 FAIL。探针脚本位于 `/tmp`，未写入仓库，不构成产品 / 证据文件。

## 6. 未覆盖项与限制

1. 探针与单测均使用 synthetic、但符合 D9 完整契约形状的输入；**真实 analyzer 输出能否被适配器直接消费属于 U4**，本报告不预判。
2. `pnpm test` 存在 2 个 vitest worker RPC 超时未处理错误。它们不是断言失败，也不由 U1 测试触发（定向运行干净），但说明全量 runner 在高负载下有噪声；本报告不将其归因于 U1。
3. 未做浏览器 / demo 运行时验证；U1 只涉及纯类型与纯函数。
4. `PlayabilityCoverage.geometry?` 类型已存在且适配器恒返回 `"partial"`；本复核**不**构成 `coverage.geometry` 能力设置，也不证明任何几何 coverage。
5. `api.ts` 按 brief 导出了 `@internal` 的 `analyzeTemporalInternalTwoLag` / `TemporalTwoLagInternalResult`；未发现新增生产调用者，但该内部入口一旦被产品代码使用，需在 U4 授权范围内审查。
6. `evidence/U1/commands.log` 的 timeout 计数（3）与其引用的 `test-output.txt`（2 errors）不一致；已按实际输出判断，属摘要笔误。
7. 本报告自身 hash 无法内嵌（写入后才会稳定）；由调用方在落盘后复算。上文列出的全部输入、证据与运行日志 hash 均可复算。

## 7. 独立签署结论

**U1：PASS。**

依据：5 个文件逐文件落在授权包 §11.2 U1 白名单且限定目的一致；受保护文件与禁区零 diff；完整 hash 复算一致；不变量 `publicCapability="BLOCKED"` / `publicResult=null` 与 `temporal.ts` / `temporal-result.ts` 内容 hash 未变；定向测试、全量测试、build、`check:deps`、`check:links` 退出码均为 0；输入包 §5 的 17 项检查逐项 PASS，另有 4 条自选关键断言 PASS，无 FAIL / 未披露的 NOT_RUN。

**结论边界（不授权）**：

- 本 PASS 只表示 **U1 证据足以支持该单元**。
- **不授权** U2 / U4 / U5 / U3；后续单元各需独立增量授权与独立复核。
- **不开放** `PUBLIC_NB` / `PUBLIC_PU`；不产公共 Verdict；gate 保持 `BLOCKED`。
- **不设置** `coverage.geometry` 能力；不授权几何 probe / fixture 实施；不授权真实 analyzer smoke。
- 本报告不修改产品代码、授权包、证据、地图或票据；仅新增本文件。
