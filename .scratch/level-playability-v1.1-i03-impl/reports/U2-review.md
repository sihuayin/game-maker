# I-03 U2 独立复核报告

> **复核人未参与 U2 实现，也未查看实现者对话。** 本报告只依据现场 diff、现场 hash、现场命令重跑与独立断言；不把作者总结 / PASS 声明作为依据。
>
> **结论：U2 PASS（仅表示 U2 证据足以支持本单元）。** 本结论**不**授权 U4 / U5 / U3，**不**开放 `PUBLIC_NB` / `PUBLIC_PU`，**不**授权 probe / fixture 实施，也不代表 I-03 整体通过。

## 1. 元信息

| 项 | 值 |
| --- | --- |
| 复核人 | fresh 独立复核人（I-03 U2 复核会话；未参与 U2 实现） |
| 日期 | 2026-11-16 18:50–18:57 CST |
| 环境 | Darwin 24.6.0 arm64；Node `v22.23.2`；pnpm `10.7.1`；Vitest `3.2.7` |
| 仓库 / 分支 | `/Volumes/shy/some-projects/game-maker` · `wayfinder/level-playability-v1.1-i03-u2` |
| HEAD | `257a6f7c160f028c5b7ff5f3174d5dde3876519a`（evidence-only commit） |
| Base | `848dedb1a4cdc36b7d71d636baabeb3a7a162439`（`main`，U2 授权 PR #54 merge） |
| Code/test head | `8a81f62` |
| 复核范围 | **仅 U2**：contracts 能力门 + 公共 Verdict 映射 + 指定测试 |

## 2. 输入完整 hash（现场 `shasum -a 256` 复算）

### 2.1 授权链

| 输入 | 完整 SHA-256 | 核对结果 |
| --- | --- | --- |
| `docs/v7.8/移动-I03.md`（当前 HEAD 文件） | `97c8f336ebd7a908cc3360d692e4b70825fa7ec0182b13e36459f769cbef992b` | PASS（见下方说明） |
| ├ 签署前（commit `583c777`） | `2f89d572008b538be5871fef11d9f539e16829d1f4ceafe6e25a8a250fb9a52e` | PASS，与签署记录一致 |
| └ 签署后（commit `9a3d520`） | `f45332bedd87209353a6f3e482408484151deed788c42996e36436437e1120cb` | PASS，与 U2 授权记录一致 |
| `.scratch/level-playability-v1.1-i03/reports/I03-review.md` | `40af4b4b243abf1fbaac5a794cf1a8ccaf32b65e3c7ed29278e1d21502feed09` | PASS，与输入包一致 |
| `.scratch/level-playability-v1.1-i03-impl/reports/U2-incremental-authorization.md` | `b6d04b03c0096ac2355fd1867b3ff96753c1b447b43a1867ed59cb1b077f6c78` | PASS |
| `.scratch/level-playability-v1.1-i03-impl/reports/U2-review-input.md` | `253d041c022bee15e742baae0b3e33f77f40400e873d29e7c7921798b954873e` | PASS |
| `.scratch/level-playability-v1.1-i03-impl/issues/03-i03-impl-u2.md` | `1236538b77b0a56ac9a5075fc60950c8f24b53b91e6936b022c5726b5441bf9e` | PASS |
| `.scratch/level-playability-v1.1-i03/evidence/11-signature.md` | `b8a87de793b2da08d3fc7630a8d6eca185ea1d793cdae444ca80dd4e1c0373a1` | PASS |

**授权包当前 hash 与 `f45332be…` 不同的说明（不是掩盖项）**：当前 HEAD 的 `docs/v7.8/移动-I03.md` 在签署后经 commit `aae20b3`（U1 Ledger 签署记录）更新；`git diff 9a3d520 aae20b3 -- docs/v7.8/移动-I03.md` 只改 §16 Ledger 的 U1 行。`f45332be…` 可由 `git show 9a3d520:docs/v7.8/移动-I03.md | shasum -a 256` 现场复算；`map.md` / `01-execution-protocol.md` 明确记载“Ledger 更新是签署后的行政记录”。故签署 hash 链可验证，判定 **PASS（附说明）**。

### 2.2 代码 / 测试 / 证据

| 输入 | 完整 SHA-256 | 核对结果 |
| --- | --- | --- |
| `packages/contracts/src/playability/public-verdict.ts` | `ec67f5a7737e711ef4d25fb52fadc7c210eb50c23de9fe8eac3c3175d493a18c` | 工作树 = `8a81f62` |
| `packages/contracts/src/playability/api.ts` | `52ccef05a19ba9f7b6e8840ecae61c42174539e5d62c6b872c3478abce1c4811` | 工作树 = `8a81f62` |
| `packages/contracts/tests/playability-public-verdict.test.ts` | `4d68e624f93dc965988b3b65b64c01f6156a32c8daad58ef8700b9d4ceaa7fde` | 工作树 = `8a81f62` |
| `git diff 848dedb..8a81f62` | `cf45344ade50d3c1e4d614a0b262830d50611829625adda5d5de9400435db16f` | 现场计算 |
| `evidence/U2/SHA256SUMS` | `674519ccfe58273342fb7d155d1e6bb4703e88de8be806c0402ac036bafe9047` | 现场计算 |
| `evidence/U2/commands.log` | `2c0ad105fc25161cc869b73eff06434ba02394d2f2a86ce49dde1c3cb197c37a` | `shasum -c` OK |
| `evidence/U2/invariant-before.txt` | `bc4ac0423f2011633d221e84189b2a259c03f13ef211ecd23bdd1a8621143996` | `shasum -c` OK |
| `evidence/U2/invariant-after.txt` | `7313f92b3281b0158200885796f4dd83c10bd1b15dab55c25a89316a14b658aa` | `shasum -c` OK |
| `evidence/U2/targeted-test-output.txt` | `c773bf6b105c8412c911819e3b6dda93ade61f3756659e88483ccebb9c375893` | `shasum -c` OK |
| `evidence/U2/test-output.txt` | `2a487829e29e04a176798c230a3af1a81700557dec8bea74ddda8569e826003a` | `shasum -c` OK |

现场执行 `cd evidence/U2 && shasum -a 256 -c SHA256SUMS`：**5/5 OK，exit 0**。

## 3. Diff scope

`git diff --name-status 848dedb..8a81f62`：

| 文件 | 操作 | U2 白名单 | 判定 |
| --- | --- | --- | --- |
| `packages/contracts/src/playability/public-verdict.ts` | A | 新增：能力门 + 公共 Verdict 映射 | PASS |
| `packages/contracts/src/playability/api.ts` | M（+11/−1） | 修改：U2 `@internal` 导出 + §4.6 非阻断 | PASS |
| `packages/contracts/tests/playability-public-verdict.test.ts` | A | 新增：映射 / 优先级 / 冲突 / 合并 | PASS |

- 总计 `3 files changed, 440 insertions(+), 1 deletion(-)`；无白名单外文件。
- 零 diff 现场校验（exit 0）：`temporal.ts`、`temporal-result.ts`、`ops.ts`、`publish-gate.ts`、`mechanic.ts`、`packages/contracts/tests/fixtures`、`verdict.ts`、`temporal-evidence.ts`、U1 测试、U4/U5/U3 测试。
- `git diff --name-status 8a81f62..257a6f7` 只有 `.scratch/.../evidence/U2/*` 与 `reports/U2-review-input.md`；code/test head 之后无产品改动。
- 无 `package.json` / lockfile / tsconfig / 新依赖变化；源码中 `mapPublicVerdict` / `PHASE1_*` / `PublicVerdictConflictError` 只出现在 `public-verdict.ts`、`api.ts` 与 U2 测试，无新增生产调用者。
- 提交切片：`0b38796`（实现 + api 导出）、`8a81f62`（测试）两个逻辑切片；`5ef3ff8` 为增量授权记录。

## 4. 逐项结论

| # | 检查项 | 结论 | 依据 |
| --- | --- | --- | --- |
| 1 | gate / admission 双重检查 | **PASS** | `public-verdict.ts:75-82` 仅 `gate.X === "OPEN" && admission.X` 才开放；测试 “NB candidate… / PU candidate…” 三态矩阵 |
| 2 | NB / PU 独立 | **PASS** | `gateOpen` 按 candidate 分派；测试 “NB / PU admission 独立” 四条交叉断言 |
| 3 | `gate=OPEN` ≠ admission 通过 | **PASS** | 仓库测试 `OPEN+未准入 ⇒ IE`（NB / PU 各一条）；独立断言 C/D 验证“对应 gate”边界 |
| 4 | existing PU / IE 优先级 | **PASS** | `public-verdict.ts:145-148`；测试 “existing PU / IE 优先” 与 V8 保持 IE |
| 5 | not applicable | **PASS** | `:149-150` 返回 existing；测试断言 `coverage.temporal` / `geometry` 均 undefined |
| 6 | missing / partial / unknown | **PASS** | `:103-105` 缺字段按 `"unknown"`；`partial` / `unknown` ⇒ IE；独立断言 A 覆盖“证据存在但 temporal 字段缺失” |
| 7 | checked + candidate | **PASS** | `:151-156`；NB ⇒ `NO_PROVEN_BLOCKER`、PU ⇒ `PROVEN_UNPLAYABLE`；checked + 内部 IE ⇒ IE |
| 8 | NB / PU candidate 的 BLOCKED / OPEN+admitted / OPEN+未准入 | **PASS** | 测试 “NB candidate… / PU candidate…” 各三条；与授权包 §4.2 表一致 |
| 9 | 冲突：existing PU + NB 或 PU candidate + 对应 gate OPEN + admitted ⇒ `PublicVerdictConflictError` | **PASS** | `:130-142`；测试 V7（NB）与 PU 分支；独立断言 C/D/E |
| 10 | gate OPEN + admission false 不冲突 | **PASS** | 测试 “gate OPEN 但 admission false ⇒ 不冲突，保留 existing PU” |
| 11 | 冲突摘要不含原始 D9 / 完整 evidence | **PASS** | `:43-49` 摘要字段仅 existing / candidate / coverage.temporal / gate / admission；测试逐个排除 10 个原始 D9 码 + `verifications` / `permanentGateProof`；独立断言 E 再排除 evidence detail / target |
| 12 | evidence 替换旧 temporal、只追加一次 | **PASS** | `:122-128` 先 filter 再仅追加一次；测试 toEqual 与长度 1 |
| 13 | `applicable:false` 也移除旧 temporal | **PASS** | `:122-128`；测试 “applicable:false 也移除” |
| 14 | 输入无 mutation | **PASS** | 全部为 filter / spread / 新对象；测试 structuredClone 前后深比较；独立断言 B 复验 |
| 15 | coverage 三维取 existing | **PASS** | `:107-120` 只复制 spatial / mechanic / completion；测试以不同三维值验证 evidence 不得覆盖 |
| 16 | temporal / geometry 语义 | **PASS** | temporal 只取 evidence 值（缺失 `unknown`）；geometry 仅在 evidence 显式有值时复制 |
| 17 | 缺 evidence 不伪造 geometry | **PASS** | `:116-118` 条件展开；测试 `"geometry" in coverage === false`；独立断言 A/B |
| 18 | 不沿用旧 temporal / geometry | **PASS** | `baseCoverage` 不含 temporal / geometry，且从不读取 `existing.coverage.geometry`；独立断言 B/G |
| 19 | `api.ts` 私有 `isBlocking`：仅新增 temporal 非阻断 | **PASS** | `api.ts:56-57` 仅新增 `judgmentId !== "PLAYABILITY_TEMPORAL_EVIDENCE"`；符合授权包 §4.6 / AC-08 |
| 20 | 既有 evidence id 映射不变 | **PASS** | 对其余所有 id，表达式与 base 的 `!SPATIAL_NON_BLOCKING.has(id)` 逐字等价；`SPATIAL_NON_BLOCKING` 仍为 spawn×2 + midAir |
| 21 | `playabilityIssues` 对既有阻断 evidence 仍产 issue | **PASS** | 测试 mapped PU + `PLAYABILITY_MECHANIC_PATH_BLOCKED` 仍产 1 条 error；既有 API 测试仍覆盖 `SPAWN_IN_TERRAIN` 非阻断 |
| 22 | 第一阶段常量冻结 | **PASS** | `:25-33` `Object.freeze`；测试 `Object.isFrozen` 与值；独立断言 F |
| 23 | U2 导出可用 | **PASS** | `api.ts:148-156` 导出 mapper / 两类型 / 两常量 / 异常；测试从 `api.ts` 导入并使用；`pnpm build` exit 0 |
| 24 | 只 import `verdict.ts`，不 import `api.ts` | **PASS** | `public-verdict.ts:8-13` 仅 `./verdict.js`；无环 |
| 25 | 无公共 gate 字段 / `publicCapability` / `publicResult` 变化 | **PASS** | U2 三文件 grep `publicCapability|publicResult` 零命中；`PlayabilityVerdict` 未加 gate 字段；`temporal.ts` 零 diff |
| 26 | 授权边界（只 U2、只白名单、无新依赖） | **PASS** | 见 §3；`pnpm check:deps` 10 包合法 |

## 5. 命令、退出码与输出摘要（复核人现场重跑）

| 命令 | 退出码 | 输出摘要 |
| --- | --- | --- |
| `pnpm exec vitest run packages/contracts/tests/playability-public-verdict.test.ts` | **0** | 1 file / **22 tests passed**；重跑（捕获退出码）exit 0 |
| `pnpm test` | **0** | **178 files / 2925 tests passed**；125.81s；2 个 `[vitest-worker]: Timeout calling "onTaskUpdate"` runner 级 unhandled errors（非断言失败，见 §7） |
| `pnpm build` | **0** | `tsc -b` + 各包 bundle 全通过 |
| `pnpm check:deps` | **0** | “依赖图合法（10 个包）” |
| `pnpm check:links` | **0** | “相对链接零断裂（1249 份文档 · 4159 条链接）” |
| `pnpm check:links`（本报告落盘后复跑） | **0** | “相对链接零断裂（1250 份文档 · 4159 条链接）”；新增本报告 +1 文档 |
| `cd evidence/U2 && shasum -a 256 -c SHA256SUMS` | **0** | 5/5 OK |
| 禁止 / 其他单元文件 `git diff --quiet 848dedb..8a81f62 -- …` | **0** | 零 diff |
| 独立断言脚本（esbuild bundle + `node`） | **0** | A–G 全部 PASS |

## 6. 自选关键断言（至少 2 条；理由 + 结果）

复核实现在 `/tmp` 用 `esbuild` 打包 `public-verdict.ts` 后以 `node` 直接执行，不修改仓库文件。

| # | 自选断言 | 选择理由 | 结果 |
| --- | --- | --- | --- |
| A | 证据存在但 `coverage.temporal` 字段缺失 ⇒ `temporal:"unknown"` ⇒ IE，且不设置 geometry | 仓库测试覆盖“无 evidence”，但未覆盖“有 evidence 而字段缺失”；这是 AC-03 / “缺失按 unknown” 的真实分支 | **PASS** |
| B | `applicable:true` 且本次无 evidence ⇒ 旧 temporal evidence 移除、不追加、`temporal:"unknown"`、不复制旧 geometry；输入不变 | 对应“三个不可妥协约束 #3：旧 temporal evidence 不能冒充当前证据”；仓库只测了 `applicable:false` 移除 | **PASS** |
| C | existing PU + NB candidate + **仅 PU** gate OPEN + `admission.pu=true` ⇒ 不冲突，保留 PU | 验证冲突必须看“对应” candidate 的 gate/admission，防止 cross-capability 误触发 | **PASS** |
| D | existing PU + PU candidate + **仅 NB** gate OPEN + `admission.nb=true` ⇒ 不冲突，保留 PU | 与 C 对称，验证 NB / PU 独立 | **PASS** |
| E | 冲突摘要不含 evidence 的 `detail` / `target`，`details` 键恰为 5 个门控摘要字段 | 防止除 D9 码之外的原始证据经摘要泄漏 | **PASS** |
| F | `PHASE1_CAPABILITY_GATE` / `PHASE1_CAPABILITY_ADMISSION` 冻结且值固定 | 第一阶段常量是能力门安全的硬边界 | **PASS** |
| G | existing coverage 自带旧的 `temporal:"checked"` / `geometry:"checked"` 时，新证据无 geometry ⇒ 结果不沿用旧 geometry | 直接验证“不沿用旧 temporal geometry” | **PASS** |

## 7. 未覆盖项 / 限制（显式披露）

以下均**不**属于 U2 的 required 判定项，不得计入 U2 的 PASS；列在此处避免“整体基本通过”掩盖边界。

- **NOT_RUN（非 U2 范围）**：真实准入链 / 假 NB / 假 PU 全局关闭（AC-10、AC-12、AC-14）、PU 六条件（AC-11，phase-1 `NOT_RUN`）、U4 `runTemporalAudit` 接线、U5 `publish-gate` 消费、U3 `mechanic.ts` gap 替换。U2 只实现 mapper 与门控输入；本报告不对这些单元作任何通过判断。
- **NOT_RUN（边界说明）**：V10 / N10（`partial` / `unknown` 被写成 `checked`，或 `COMPLETE` 无 degradation）是证据生产侧约束，U2 mapper 不生成 coverage；mapper 代码 `:103-105` 不含写 `checked` 的分支。该规则由 U1 适配器 / U4 负责，本次未在 U2 执行。
- **NOT_RUN（消费者）**：V9 / N9 的 mapper 侧非阻断已 PASS；`publish-gate` 是否实际拒稿不变属于 U5，本次未执行。
- **限制**：`gate` / `admission` 是 mapper 的必填输入，不是由 evidence 推导，也没有运行时守卫强制生产中只能传第一阶段常量。生产安全依赖“U4 必须显式传 `PHASE1_*`”的架构约束、无生产调用者（本次 grep 核实）与后续复核。本报告不把“synthetic OPEN 可产生 NB / PU”读成能力开放。
- **限制**：冲突分支不要求 `coverage.temporal === "checked"`；按授权包 §4.3 / U2 brief Q7，candidate + 对应 gate OPEN + admitted 即 STOP，实现对 partial coverage 也采取保守 STOP。仓库测试未单独覆盖 partial + conflict；本次仅代码审阅（`:130-142`）确认，未作为 separate 断言执行。
- **测试运行器噪声**：`pnpm test` 本次 2 个、证据记录 3 个 `[vitest-worker]: Timeout calling "onTaskUpdate"` unhandled errors；测试本身 178/2925 全过，`vitest.config.ts` 已用 `dangerouslyIgnoreUnhandledErrors: true` 使退出码反映断言结果。这属于 runner RPC 噪声，不是产品 / 断言失败，但如实披露。
- **hash 说明**：授权包当前文件 hash 为 `97c8f336…`，与 U2 授权记录引用的签署后 `f45332be…` 不同；差异来自签署后 U1 Ledger 行政更新（§2.1），不是授权内容漂移。

## 8. 独立签署

| 项 | 值 |
| --- | --- |
| 复核人 | fresh 独立复核人（I-03 U2 复核会话；未参与 U2 实现，未采用作者结论） |
| 日期 | 2026-11-16 |
| 结论 | **U2 PASS（仅限本单元）** |
| 未授权项 | U4 / U5 / U3；`PUBLIC_NB` / `PUBLIC_PU`；probe / fixture 实施 |
| 发现 | **FAIL：无。** **NOT_RUN：见 §7（均非 U2 required）。** |

**签署边界**：本复核 PASS 只表示 U2 的代码 / 测试 / 证据足以支持“contracts 能力门 + 公共 Verdict 映射”这一单元；不构成后续单元授权，不构成任何公共能力开放，也不替代用户签署与 Ledger 更新。

## 9. 输出 hash

- 报告正文（本文件从开头到本节标题之前的全部字节）SHA-256：`c471ff91603670d7fba226c70c7003f5e20d2c1e99a14989fd49618c1b5b2f3a`。
- 复算口径：`awk '/^## 9\. 输出 hash$/{exit} {print}' U2-review.md | shasum -a 256`。
- 落盘后完整文件 SHA-256：见复核回报记录（避免 hash 自引用；回报值覆盖包含本节在内的完整字节）。
