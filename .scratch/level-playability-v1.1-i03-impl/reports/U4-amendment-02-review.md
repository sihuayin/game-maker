# U4 amendment-02 独立复核报告

> 复核对象：I-03 实施 U4 amendment-02 —— `temporalFailure` 降级路径的 `publicVerdict` 不再复用 `existingAudit`，改经 `mapPublicVerdict` 映射为 IE。
> 结论：**PASS**（逐项见 §3；限制见 §7）。
> 边界：本报告的 PASS **只**表示 amendment-02 证据足以支持该修复；**不**授权 U3 签署 / 合并 / Ledger 更新；**不**开放 `PUBLIC_NB` / `PUBLIC_PU` 或任何能力；**不**授权 probe / fixtures 实施；不改变发布闸行为。

## 0. 复核人 / 日期 / 环境

| 项 | 值 |
| --- | --- |
| 复核人 | fresh 独立复核代理（未参与 U4 amendment-02 实施；未采信作者结论） |
| 日期 | 2026-11-17 |
| 仓库 | `/Volumes/shy/some-projects/game-maker` |
| 分支 / HEAD | `wayfinder/level-playability-v1.1-i03-u4-amendment-02` · `2fa5359` |
| 环境 | Darwin 24.6.0 arm64（macOS 15.x）；node `v22.23.2`；pnpm `10.7.1`；vitest `3.2.7` |
| 工作树状态 | 复核开始时仅有未跟踪的 `reports/U3-review.md`；复核结束时仅新增本报告。产品代码 / 证据 / 授权文件零修改。 |

## 1. 输入 / 输出 hash

### 1.1 输入

| 输入 | SHA-256 / 值 | 声明值对照 | 结果 |
| --- | --- | --- | --- |
| 授权包 `docs/v7.8/移动-I03.md` | `8a8349b1f26f20d08a6c7573875ed5d0a070d240158c183f1b75721b6ecaf917` | 与输入包 / amendment-02 授权记录一致 | PASS |
| amendment-02 授权记录 `reports/U4-brief-amendment-02.md` | `bdc6cb8357556ef2e2b1d44f79dbf55900b909774fa546f395a6ed959609d0e0` | 文件无自声明 hash，复核人自算 | PASS（无声明值可比，属限制） |
| U3 FAIL 报告 `reports/U3-review.md` | `57607f39a67356eb8ba997047bb4722654f4ff39d1715c730f0bab5c0e77163d` | 与输入包声明一致；正文结论为 FAIL | PASS |
| 复核输入包 `reports/U4-amendment-02-review-input.md` | `c225b6fc0d7138d999f43e13c414962db5390a17f0471d9ca1c66a16edd7d9a7` | 无声明值，复核人自算 | PASS |
| 证据清单 `evidence/U4-amendment-02/SHA256SUMS` | `0dcfb60af91ade67addf03eb0f939e90bcfaec58526d13b5616072b81386c0bf` | 10 个文件 `shasum -a 256 -c` 全部 `OK`，退出码 0 | PASS |
| Base 提交 | `90eb81c6e812435165ec4ec63adbba9e7b998cce` | 输入包声明 `90eb81c` | PASS |
| Code/test head | `ea29cd94ea10ccc307978f4e92510dbde49d1dc5` | 输入包声明 `ea29cd9` | PASS |
| Evidence head | `2fa535923555511245780de81aad271a23fb73cf` | 当前分支 HEAD | PASS |
| Drill 分支 head | `b974c94e49748912db01f4075241afe2c03881dc` | `wayfinder/i03-u4-amendment-02-rollback-drill` | PASS |
| `90eb81c..ea29cd9` 产品 diff | `a4fdf1b1195c8883fa179039b744a8851638d0b774168f3a00a90cd7b0d262eb` | 复核人自算 | PASS |

### 1.2 输出（产品文件 / 运行日志）

| 输出 | SHA-256 |
| --- | --- |
| `ea29cd9:packages/assets/src/ops.ts` | `587dca3e44467b1d251c0a95ec637980d125bab36141a375f80a7f134bd56c58` |
| `90eb81c:packages/assets/src/ops.ts`（修复前） | `6105ca7248b15eb8fcdedd77b620e17df196c56a1341dd4c33e4948a0be028dc` |
| `ea29cd9:packages/assets/tests/ops.test.ts` | `55c23e49da3e352824ccfd51f60671ebda49e249926a9f7bd09eba05d7646edb` |
| Tree `90eb81c` / drill head | `3341aa4484d77696ed578e060dd2d690e399e085`（两者逐字相等） |
| Tree `ea29cd9` | `48b81f9eb3aadc3ad2dec9208faa546322850ec1` |
| Tree `2fa5359` | `07dad6fd176bed26d67bd1ff54df6d1fd7ed0e0a`（仅比 `ea29cd9` 多 `.scratch` 证据 / 输入包） |
| 本复核交付日志（临时，`/tmp`） | `u4-targeted.log` `8a32dc07…`；`u4-fulltest.log` `8d20d829…`；`u4-drill-mutation.log` `1a6d8d7b…`；`u4-drill-full2.log` `0f835b56…` |

> 本报告自身无法内嵌自身 hash；其 SHA-256 见交付回复。

## 2. Diff scope

`git diff --name-status 90eb81c..ea29cd9` **只有 2 个文件**（14 insertions / 3 deletions）：

1. `packages/assets/src/ops.ts` — `temporalFailure` 的 `publicVerdict` 改用 `mapPublicVerdict(...)`。
2. `packages/assets/tests/ops.test.ts` — trusted 失败 / analyzer 抛错两例断言改为 IE / unknown / 空 evidence。

零 diff / 未漂移核对：

- `git diff --stat ea29cd9 2fa5359 -- packages` 为空 ⇒ 证据提交未混入产品代码。
- `git diff --name-status 90eb81c..ea29cd9 -- . ':(exclude)packages'` 为空。
- `git diff --stat 90eb81c ea29cd9 -- packages/contracts packages/pipeline packages/cli packages/mcp` 为空。
- `invariant-after.txt` 列出的 6 个 contracts / pipeline 文件实测 hash 与快照逐个一致；`packages/cli`、`packages/mcp` tree id 与快照一致。
- `runTemporalAudit` 生产调用者仍恰为 `ops.ts` / `publish-gate.ts` / `create-game.ts` 三处，未新增。
- 证据提交 `2fa5359` 只新增 12 个 `.scratch` 文件（10 个证据 + `SHA256SUMS` + 复核输入包）。

## 3. 逐项核对

| # | 项 | 结论 | 证据 |
| --- | --- | --- | --- |
| 1 | 授权包 hash `8a8349b1…` | **PASS** | 实测一致（§1.1） |
| 2 | amendment-02 授权记录（仅 U4 降级路径、签署人 amber、2026-11-17） | **PASS** | `U4-brief-amendment-02.md`；范围与改动文件一致 |
| 3 | U3 FAIL 报告 hash `57607f39…` | **PASS** | 实测一致，正文结论 FAIL |
| 4 | `evidence/U4-amendment-02/SHA256SUMS` | **PASS** | 10/10 `OK`，退出码 0 |
| 5 | 产品 diff 仅 `ops.ts` + `ops.test.ts` | **PASS** | §2；无其他产品文件、无授权包正文改动 |
| 6 | `temporalFailure` 使用真实 `mapPublicVerdict({ existing, temporal:{applicable:true}, gate, admission })` | **PASS** | `ops.ts:1044-1062`；import 自 `@game-maker/contracts`；非复制、非手写判定 |
| 7 | gate / admission 显式传第一阶段常量 | **PASS** | `PHASE1_CAPABILITY_GATE` / `PHASE1_CAPABILITY_ADMISSION`，未默认、未解释 `OPEN` |
| 8 | existing NB + trusted 失败 ⇒ publicVerdict IE / coverage unknown / evidence [] | **PASS** | 作者回归测试 + 复核人断言 A1 |
| 9 | existing NB + analyzer 抛错 ⇒ publicVerdict IE / coverage unknown / evidence [] | **PASS** | 作者 mock 注入测试（真实 `runTemporalAudit` 路径）；两测试均实跑通过 |
| 10 | existing PU / IE 优先级不被削弱 | **PASS** | mapper 先判 existing PU / IE；复核人断言 A2 / A3 |
| 11 | legacy `verdict` / `degradation` 与兜底 catch 不变 | **PASS** | diff 仅动 `publicVerdict` 一行；A5 验证 trusted 失败时 legacy IE、无 degradation |
| 12 | 无 `as any`；测试走真实函数 | **PASS** | 改动文件无 `as any` / `@ts-ignore`；仅 analyzer 抛错用例按需 `vi.doMock` 注入异常 |
| 13 | 发布闸 / U3 / contracts / CLI / MCP 行为不变 | **PASS** | 零 diff + 全量测试通过 |
| 14 | 目标测试 `pnpm exec vitest run packages/assets/tests/ops.test.ts` | **PASS** | exit 0；1 file / 21 tests |
| 15 | 全量 `pnpm test` | **PASS** | exit 0；178 files / 2945 tests；5 条 runner 级告警 |
| 16 | `pnpm typecheck` | **PASS** | exit 0 |
| 17 | `pnpm build` | **PASS** | exit 0 |
| 18 | `pnpm check:deps` | **PASS** | exit 0；10 个包 |
| 19 | `pnpm check:links` | **PASS** | exit 0；零断裂（1254 份文档，见 §7 计数说明） |
| 20 | 回滚演练分支结构（revert `ea29cd9` + `d8002df`，产品树回 base） | **PASS** | drill head `b974c94`；drill tree == `90eb81c` tree |
| 21 | 回滚演练测试（目标 21 / 全量 2945） | **PASS** | 独立 worktree 实跑：21 / 21，178 / 2945，exit 0 |
| 22 | delivery 未被污染 | **PASS** | `git diff --name-status 90eb81c drill` 为空；drill 无证据提交；主工作树干净 |
| 23 | U3 签署 / 合并 / Ledger | **NOT_RUN** | 超出本复核授权边界，明确不授权 |
| 24 | 能力开放 / `PUBLIC_NB` / `PUBLIC_PU` / probe / fixtures | **NOT_RUN** | 超出本复核授权边界，明确不授权 |

## 4. 命令与退出码

### 4.1 交付 head（`ea29cd9` / 工作树 HEAD `2fa5359`）

| 命令 | 退出码 | 关键输出 |
| --- | --- | --- |
| `pnpm exec vitest run packages/assets/tests/ops.test.ts` | 0 | 1 file / 21 tests passed |
| `pnpm test` | 0 | 178 files / 2945 tests passed；5 条 `[vitest-worker] Timeout calling "onTaskUpdate"`（runner 级，非测试失败） |
| `pnpm typecheck` | 0 | 所有 workspace `typecheck: Done` |
| `pnpm build` | 0 | `tsc -b` + 各包 bundle 完成 |
| `pnpm check:deps` | 0 | 依赖图合法（10 个包） |
| `pnpm check:links` | 0 | 相对链接零断裂（1254 份文档 · 4159 条链接） |

### 4.2 回滚演练（隔离 worktree，detached @ `b974c94`）

| 命令 | 退出码 | 关键输出 |
| --- | --- | --- |
| `vitest run packages/assets/tests/ops.test.ts`（drill 原树） | 0 | 21 / 21；源码为 `publicVerdict: existingAudit`、旧断言存在 |
| `pnpm build`（worktree，补齐未跟踪 dist） | 0 | `packages/demo/dist/shell.js` 等产物生成 |
| `vitest run --passWithNoTests`（worktree，build 后） | 0 | 178 files / 2945 tests passed；4 条 runner 告警 |
| 变异敏感性：把修复后测试放到 drill 源码上跑目标文件 | 1 | 恰 2 条失败：`expected 'NO_PROVEN_BLOCKER' to be 'INSUFFICIENT_EVIDENCE'`（第 405 / 431 行） |

> 第一次隔离 worktree 全量跑 exit 1（3 files / 13 tests 失败），原因是 worktree 内未构建 `packages/demo/dist/shell.js` / visual-world bundle（CLI / MCP 用例）以及 1 条 `compile-runtime` 20s 超时；在 worktree 内执行 `pnpm build` 后重跑即 2945 全通过。该次失败与本修复无关，记录于此以示未隐藏。

## 5. 回滚演练核对

- 分支从 `ea29cd9` 切出，`git revert --no-edit ea29cd9 d8002df` 产生 `433db46` / `b974c94`。
- drill 分支 tree `3341aa44…` 与 base `90eb81c` tree **逐字相等**；`git diff --name-status 90eb81c drill` 为空 ⇒ 产品、证据、delivery 目录均未被污染。
- drill 源码保留修复前语义（`publicVerdict: existingAudit`，旧断言），目标测试 21 / 21 通过。
- 复核人另在 detached worktree 独立重跑全量：178 files / 2945 tests，exit 0。
- 变异敏感性反证：同一套 drill 源码 + 修复后测试 ⇒ 恰好在两条回归断言处失败（实际 `NO_PROVEN_BLOCKER`），说明新增断言确实能抓住本缺陷。

## 6. 自选关键断言（复核人独立编写，未进仓库）

方法：Node 直接 import `packages/assets/dist/index.js` 与 `packages/contracts/dist/index.js`，用真实 `last-train` fixtures；`packDir` 指向空临时目录以触发 trusted 失败。脚本位于 `/tmp`，未写入仓库。

| 断言 | 结果 |
| --- | --- |
| A1 existing NB + trusted 失败 ⇒ `publicVerdict.verdict=IE`、`coverage.temporal=unknown`、`publicVerdict.evidence=[]`，且 `publicVerdict !== existing`（不再复用原对象） | PASS |
| A2 existing PU + trusted 失败 ⇒ `publicVerdict.verdict` 仍为 `PROVEN_UNPLAYABLE`（不被降级） | PASS |
| A3 existing IE + trusted 失败 ⇒ `publicVerdict.verdict` 仍为 `INSUFFICIENT_EVIDENCE` | PASS |
| A4 existing NB 携带非时序 evidence + trusted 失败 ⇒ verdict IE，且 mapper 保留该非时序 evidence（见 §7 注） | PASS（行为观察） |
| A5 trusted 失败时 legacy `verdict=IE`、无 `degradation` 字段（兜底字段未被本次修改影响） | PASS |
| A6a 无 `existingAudit` + 坏 pack ⇒ IE，coverage 为 `not-checked×3 + temporal=unknown` | PASS |
| A6b 无 `existingAudit` + 有效 pack ⇒ legacy-only 最小 IE，coverage 无 `temporal` 键 | PASS |
| M1 修复后测试 × 修复前源码（drill） ⇒ 恰 2 条回归失败，实际值 `NO_PROVEN_BLOCKER` | PASS（反证回归有效性） |

## 7. 限制与未覆盖

1. **analyzer 抛错路径**只在 vitest 内通过 `vi.doMock("@game-maker/contracts")` 注入异常复现，未在独立进程再复现；不过它走的是真实 `runTemporalAudit` → 内层 `catch` → `temporalFailure`，代码路径与静态核对一致。
2. **`evidence []` 的边界**：mapper 会保留 existing 的非时序 evidence（并移除旧 temporal evidence）。作者 fixture 的 `existingAudit.evidence` 为空，因此 `publicVerdict.evidence=[]` 成立；若 existing 带非时序 evidence，公开 verdict 仍为 IE 但会保留该 evidence（A4）。这是 U2 mapper 的既定语义，不构成本修复缺陷，但 U5 消费方不应把 `publicVerdict.evidence` 为空当作普遍成立。
3. **无 existingAudit 的 trusted 失败路径**：修复后 `publicVerdict.coverage.temporal` 变为 `unknown`（A6a）；verdict 仍为 IE，符合授权包 §4.2，但作者的回归测试未显式覆盖此分支，属复核人观察项。
4. `check:links` 本次为 1254 份文档，证据运行时为 1253；差异来自证据运行之后才加入的 `reports/U4-amendment-02-review-input.md`（`.md` 文件数 +1），非链接断裂。
5. 回滚演练在隔离 worktree 中进行，`node_modules` 以符号链接复用主工作树依赖；首次全量因 worktree 内未构建 dist 出现 13 条环境性失败，构建后全量通过（§4.2）。此方式不等同于在原分支原地 checkout 重跑，但 drill tree 与 base 逐字相等，结论不受影响。
6. Runner 级 `onTaskUpdate` 告警数量在多次运行间为 4–5 条（作者证据 5 条、复核全量 5 条、drill 重跑 4 条）；均为 vitest worker 层警告，非测试失败，未掩盖任何红测。
7. 授权包 `main` 远端 ref、合并 PR 状态未复核；本报告只按给定本地提交与 hash 判定。
8. 未复核 U3 产品语义本身；`U3-review.md` 仅作为授权触发与 hash 输入。该文件在本分支为未跟踪文件，复核未修改它。
9. 本报告不构成用户签署，不授权合并 / 发布 / U3 推进。

## 8. 独立签署

复核人：**fresh 独立复核代理**（未参与 U4 amendment-02 实施，未采信作者结论）
日期：**2026-11-17**
结论：**PASS** —— U4 amendment-02 的降级路径修复与其证据足以支持该修复本身。

签署边界（再次声明）：本 PASS **不**授权 U3 合并 / Ledger，**不**开放任何能力或 gate，**不**授权 probe / fixtures 实施，也不修改发布闸行为。
