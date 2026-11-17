# I-03 实施最终独立验收报告（重基线版）

| 项 | 值 |
| --- | --- |
| 票 | I03-IMPL-07 / ACCEPTANCE |
| 报告路径 | `.scratch/level-playability-v1.1-i03/reports/I03-acceptance.md` |
| 日期 | **2026-11-17** |
| 验收会话 | fresh 独立验收会话；未参与 U1–U5 实现，未参与本地图规划 |
| 仓库 | `/Volumes/shy/some-projects/game-maker` |
| 分支 / HEAD | `main` @ `d26276e5e65d2bc4d2381d5829bd9be4410c682f`（PR #70 重冻结已合入） |
| 验收代码 SHA | `d26276e5e65d2bc4d2381d5829bd9be4410c682f` |
| 验收代码相对首轮的产品 diff | **零**（`148b89b..d26276e -- packages fixtures package.json pnpm-lock.yaml tsconfig* scripts docs .github` 为空） |
| 工作树 | 验收开始时 tracked 文件 clean；验收只新增未跟踪的验收报告与 `evidence/acceptance-run2/` |
| 首轮 FAIL 报告归档 | `.scratch/level-playability-v1.1-i03/reports/I03-acceptance-run1-FAIL.md` · `sha256:7996e705110516e83f6736a53f6c33ab172b87b8bd2334e126edc914ae478ba0`（与首轮原文逐字节一致） |
| 授权包 `docs/v7.8/移动-I03.md` | 当前 `sha256:2bbe7c5534ecb2e28db28657d58de9be54007963c1d4f69f8883568fdc0478f8` |
| 授权包签署对象（签署前） | `sha256:2f89d572008b538be5871fef11d9f539e16829d1f4ceafe6e25a8a250fb9a52e` |
| 授权包签署后 | `sha256:f45332bedd87209353a6f3e482408484151deed788c42996e36436437e1120cb` |
| 独立审查报告 `I03-review.md` | `sha256:40af4b4b243abf1fbaac5a794cf1a8ccaf32b65e3c7ed29278e1d21502feed09` |
| 重冻结授权记录 | `reports/I03-acceptance-baseline-rebaseline-authorization.md` · `sha256:a8b55ee2bace03b9294242d4eeac93f78745cc45abe3bee5fade0523a445cae1` |
| 重冻结记录 | `reports/I03-acceptance-rebaseline.md` · `sha256:9ee431cc3de2bcda8a05070eb48365606daea17491f3c68353c83d35051b8d57` |
| I-02 授权包 | `sha256:797cd6fc7b299e22b6e90b9ef8a9567376ea3a914d70f8b6f1fc0f9a6ecedc56`（未变） |
| 环境 | macOS 15.7.9 · Darwin 24.6.0 arm64 · Node `v22.23.2` · pnpm `10.7.1` · vitest `3.2.7` |

> 本报告只记录验收事实。所有 PASS 均来自本会话在**新基线**上重新执行的命令与原始证据复核；未采信作者总结。
> 本报告不开放任何能力；`PUBLIC_NB` / `PUBLIC_PU` 仍 `BLOCKED`；`publicResult=null`。

---

## 1. 基线 SHA / 验收代码 SHA / 环境

### 1.1 仓库与环境（现场采集）

| 项 | 值 |
| --- | --- |
| `git rev-parse HEAD` | `d26276e5e65d2bc4d2381d5829bd9be4410c682f` |
| `git branch --show-current` | `main` |
| 工作树（开始时） | tracked 文件 clean |
| OS | macOS 15.7.9（Darwin 24.6.0 arm64） |
| Node | `v22.23.2` |
| pnpm | `10.7.1` |
| vitest | `3.2.7` |

### 1.2 授权包 hash 链（完整 hash，实际字节复算）

| 阶段 | 提交 | `sha256` | 判定 |
| --- | --- | --- | --- |
| I03-09 组装 | `4fa4f70` | `0edf5005d52f50ccbaa52be85f9b4ed34b904aacc6b51d7eec72be6ee2863c14` | 与 `evidence/09-package.md` 一致 |
| I03-10 F2 修正（签署对象） | `583c777` | `2f89d572008b538be5871fef11d9f539e16829d1f4ceafe6e25a8a250fb9a52e` | 与 `11-signature.md` / 授权包 §17.1 一致 |
| I03-11 签署栏写入 | `9a3d520` | `f45332bedd87209353a6f3e482408484151deed788c42996e36436437e1120cb` | 与 `11-signature.md` 一致 |
| U1 Ledger | `aae20b3` | `97c8f336ebd7a908cc3360d692e4b70825fa7ec0182b13e36459f769cbef992b` | 仅 §12.2 U1 行变化 |
| U2 Ledger | `4ccb795` | `32152c0182f4282f680b06dcd576b58d05255b0b16a8f78a7e70a272feeb5a70` | 仅 §12.2 U2 行变化 |
| U4 Ledger | `808f7a5` | `5e3fa97f4ae855ef37a18c3aabd708ed28f250af1184c466eaadc890935d6f24` | 仅 §12.2 U4 行变化 |
| U5 Ledger | `0cc0639` | `8a8349b1f26f20d08a6c7573875ed5d0a070d240158c183f1b75721b6ecaf917` | 仅 §12.2 U5 行变化 |
| U4 amendment-02 Ledger | `d470a18` | `46cf181237f1dd3bf3bc30f839c62abb37f1f90787020ffcb445df8790b8c308` | 仅 §12.2 U4 行变化 |
| U3 Ledger（当前） | `13f1735` | `2bbe7c5534ecb2e28db28657d58de9be54007963c1d4f69f8883568fdc0478f8` | 与当前文件逐字一致 |

- 重冻结 PR #70 **未改授权包**；当前 hash 仍为 `2bbe7c55…`，与首轮验收一致。
- 签署前 / 后 hash 与 `evidence/11-signature.md`、授权包 §17.1 逐字一致；`git diff 9a3d520..HEAD -- docs/v7.8/移动-I03.md` 仅 §12.2 五行 Ledger，未改正文 / 约束 / AC。

### 1.3 重冻结输入（用户裁定）

| 项 | 值 |
| --- | --- |
| 触发 | 首轮 FAIL（AC-21：旧 LP-06/07 基线与 U3 授权变更后层内结果不一致） |
| 用户裁定 | Q1「授权重冻结基线」；Q2「接受 INCOMPLETE 关闭」 |
| 授权范围 | **仅** LP-06/07 tracked 基线重冻结 + 验收重跑；不改产品 / 契约 / gate / 能力 |
| 重冻结提交 | `5611e7a`（evidence-only）；合入 `main` `d26276e`（PR #70） |
| 产品 diff | `148b89b..d26276e -- packages fixtures ...` 为空 |

### 1.4 各单元授权 / 复核 / 证据 / Ledger 引用可解析性

| 单元 | 实施 SHA | 复核报告 + 声明 hash | 实际复核 hash | 证据 | 回滚目标 | 判定 |
| --- | --- | --- | --- | --- | --- | --- |
| U1 | `f059afe02264a8b4e8b4b39bd6e0c65bec52f539`（存在） | `reports/U1-review.md` · `52d17013e5c4c73cad106bcae2e26203e58cb35c49c2da4689ae445bbc26ccfd` | 一致 | 分支 `wayfinder/i03-u1-evidence` @ `3c08eae`（为分支祖先） | `c432409`（存在） | 可解析 |
| U2 | `c3522b698b4773d670ba45d2b238d6f3fda7d950`（存在） | `reports/U2-review.md` · `faf27737208c20c537287c001be63084997ce849666c040b1cb7139815fcc7b3` | 一致 | 分支 `wayfinder/i03-u2-evidence` @ `257a6f7`；复核报告实际在 `wayfinder/level-playability-v1.1-i03-u2` @ `9cf89db`（§4.6 A1） | `848dedb`（存在） | 可解析，分支归属有偏差 |
| U4 | `7cdcabe34d7de2abf81d70eccad30705f3ed45c2`（存在） | `reports/U4-review-amendment.md` · `57d8de0feea5ef12c51cebbc74f4acb2ece8f30899ea0defb211aad058ce52c9`；首轮 FAIL `7db8472f…`；rerun `dca6f72a…` | 全部一致 | 分支 `wayfinder/i03-u4-evidence` @ `9a16563`；`SHA256SUMS` 6/6 OK | `a0688be`（存在） | 可解析 |
| U4 amendment-02 | 产品头 `ea29cd9` / 证据头 `2fa5359` | `reports/U4-amendment-02-review.md` · `ab15775230b1b1fbc7c5e1928979059fc495d1621261e56e066727f90c3bd09e` | 一致 | 分支 `wayfinder/i03-u4-amendment-02-evidence` @ `d3eb69c`；`SHA256SUMS` 10/10 OK | drill 分支 `b974c94` | 可解析 |
| U5 | `a12df97fac7c3161f8ba23bd39af1eb1d2a78f72`（存在） | `U5-review.md` `7b6d8023…`；rerun `6ce87eb3…`；final `e0eae056…` | 全部一致 | 分支 `wayfinder/i03-u5-evidence` @ `4af72e8`；`SHA256SUMS` 10/10 OK | `41df0d3`（存在） | 可解析 |
| U3 | `fa9e76c6f3b72f04db964d22191a748b6ef583b8`（存在） | `U3-review-rerun.md` · `5aed841a31f03010c953d79aa1e5c14b7a4fde9ce5769ab36f2f135ead441a25`；首轮 FAIL `57607f39…` | 一致 | 分支 `wayfinder/i03-u3-evidence` @ `75afc40`；`SHA256SUMS` 10/10 OK | `0e3a456`（存在） | 可解析 |

- 五个单元的增量授权记录均含签署人 **amber**、日期 2026-11-16/17、范围仅限该单元、明确 `PUBLIC_NB` / `PUBLIC_PU` 不放行。
- Ledger §12.2 五行均含实际实施 SHA、复核证据路径 + hash、批准人、日期、回滚目标、回滚演练证据；无占位符 / 预填。
- 发现（不改变“可解析”结论，详见 §4.6）：
  - **A1**：U2 Ledger 行写“audit 分支 `wayfinder/i03-u2-evidence` @ `9cf89db`”，但 `9cf89db` 不是该分支祖先（分支头 `257a6f7` 树中无 `U2-review.md`）；复核报告实际在 `wayfinder/level-playability-v1.1-i03-u2` @ `9cf89db`，内容 hash 与 Ledger 一致。
  - **A2**：U1 / U2 的 `commands.log` 被 `.gitignore` 的 `*.log` 忽略，未 `-f` 加入 audit 分支；两文件在工作树存在且 SHA-256 与各自 `SHA256SUMS` 声明一致（U1 `c93f9376…`、U2 `2c0ad105…`）。

---

## 2. AC 索引（AC-01–AC-21 逐条判定）

**证据级别**：E1 = 源码 / 契约 `file:line`；E2 = 测试名 + 断言 + 退出码；E3 = scratch 复跑（命令、路径、计数、原始输出摘要）。

**统一命令证据**：
- E2 主日志 `.scratch/level-playability-v1.1-i03-impl/evidence/acceptance-run2/ac-focused-tests.log` · `sha256:387c0dc15e78e1b084cef931dd70ee512798dab2eaf3739158266f4d4673a04f`（9 文件 / 303 tests，exit 0）；
- 全量 E2/E3 `.scratch/level-playability-v1.1-i03-impl/evidence/acceptance-run2/pnpm-test.log` · `sha256:666c114e6a3dd8398c7abf326562d8493d4af53b87d3ffd2c67fb6fa792c439f`（178 文件 / 2952 tests，exit 0）。
- 下表 `file:line` 指向对应源码 / 测试文件；关键文件 hash 见 §4.7。

| AC | required | 级别 | 证据来源 | 状态 | 证据路径 + hash | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| AC-01 | 是 | E1+E2 | `verdict.ts:37-51,62-73,84-107,156-166,168-178`；`temporal-evidence.ts:179-209`；测试 `playability-temporal-evidence.test.ts:261`（perLag 不含 witness）、`:359`（N6 不携带 proof/Witness/Stats/原始 D9）；`playability-api.test.ts:126`（非时序 evidence 无 temporal 字段） | **PASS** | 源码 / 测试 hash 见 §4.7；E2 日志 `ac-focused-tests.log` `387c0dc1…` | public temporal evidence 只含 `model / lag / degradation / limits` + `kind:"temporal"` witness；未泄漏内部 Proof / Witness / 原始 perLag。 |
| AC-02 | 是 | E2 | `temporal-evidence.test.ts:185`（20 内部码 → 13 公共值）、`:197`（内部独有码不出现在公共输出）、`:370`（未知码 → invalid-input，不原样透传）；E1 `verdict.ts:37-45`、`temporal-evidence.ts:57` | **PASS** | 同上 | 20 个 D9 内部 degradation 完整 many-to-one 到 13 个公共值；未知码不透传、不静默降级。 |
| AC-03 | 是 | E2 | `temporal-evidence.test.ts:221,226,236,243,250`；`playability-public-verdict.test.ts:96,201`；`playability-mechanic.test.ts:338`（不适用 ⇒ 保留 existing，无 temporal 字段）；E1 `verdict.ts:34`、`public-verdict.ts:101-119` | **PASS** | 同上 | `coverage.temporal ∈ {checked,partial,unknown}`；缺失按 unknown；无移动 Hazard ⇒ 不适用、不拉 IE；不写 checked。 |
| AC-04 | 是 | E2 | `temporal-evidence.test.ts:261`（perLag 恰好两项、顺序固定）、`:273`（limits 如实取 hopSamplesChecked=0）、`:293`（certificate none ⇒ INCOMPLETE；public witness 仍 temporal）、`:309`（P2 六项 puConditions）；E1 `verdict.ts:75-107` | **PASS** | 同上 | `perLag` 恰好 `[主档, 基准档]`，各档结论字段完整；不含原始 Witness。 |
| AC-05 | 是 | E2 | `playability-public-verdict.test.ts:116`（NB candidate + gate BLOCKED ⇒ IE）、`:124`（PU candidate + gate BLOCKED ⇒ IE）；`playability-mechanic.test.ts:347`（phase-1 gate BLOCKED：nb/pu candidate 不产公共 NB/PU）；`publish-gate.test.ts:300,309`；E1 `public-verdict.ts:25-33,75-83,145-160` | **PASS** | 同上 | gate BLOCKED 时候选一律公共 IE；不产 NB / PU。 |
| AC-06 | 是 | E2 | `playability-public-verdict.test.ts:87`（existing PU / IE 优先）、`:104`（partial/unknown ⇒ IE）、`:111`（checked + 内部 IE ⇒ IE）、`:187`（existing IE + candidate ⇒ 保持 IE）；E1 `public-verdict.ts:145-160` | **PASS** | 同上 | 优先级 existing PU > existing IE > temporal IE > NB；temporal 不削弱 PU、不把 IE 改成 NB。 |
| AC-07 | 是 | E2 | `playability-public-verdict.test.ts:87,96,104`；`playability-mechanic.test.ts:302,320,331,338`；`ops.test.ts:389,397,413`；E1 `ops.ts:1044-1062,1085,1145-1146,1148`、`public-verdict.ts:116-118,151` | **PASS** | 同上 | 无移动 Hazard ⇒ temporal 缺省且 verdict 不变；有移动 Hazard 缺字段 ⇒ unknown ⇒ IE；IE 永不升级。特别复核见 §4.5。 |
| AC-08 | 是 | E2 | `playability-public-verdict.test.ts:240`（temporal evidence 不产 issue；existing 阻断 evidence 仍产 issue）、`:248`（公共 IE / NB 不产 issue）；`playability-mechanic.test.ts:357`；`playability-api.test.ts:88`；E1 `api.ts:114-119` | **PASS** | 同上 | `PLAYABILITY_TEMPORAL_EVIDENCE` 非阻断；不产 ConfigIssue / warning / error；`playabilityIssues` 映射不变。 |
| AC-09 | 是 | E2 | `playability-public-verdict.test.ts:146,151,166`（V7 / PU 分支冲突；冲突摘要不泄漏原始 D9）；E1 `public-verdict.ts:52-72,133-141` | **PASS** | 同上 | existing PU + temporal candidate + 对应 gate OPEN + admitted ⇒ STOP + HITL（`PublicVerdictConflictError`），不静默择一。 |
| AC-10 | 是 | E2 | 部分证据：`playability-public-verdict.test.ts:116`（synthetic gate/admission）、`temporal-evidence.test.ts:302`（P1 nb-candidate + witness COMPLETE）、`ops.test.ts:357`（集成 smoke）；**无**十项 §8.2 准入条件 / 固定 admission 夹具实现 | **NOT_RUN** | 同上 | NB 准入链在 phase-1 明确为非目标（U2 brief §Non-goals；U2 复核报告 §7 将 AC-10 标 `NOT_RUN`）。mapper 只消费布尔 `admission` 输入，不评估几何/双档/证书/预算/确定性/体积/映射十项；无 false-NB 固定夹具。 |
| AC-11 | **否** | E2 | `temporal-evidence.test.ts:309-316`（P2 六项 puConditions）；`playability-temporal.test.ts:227-245`（geometry-checked / 条件状态） | **NOT_RUN** | 同上 | phase-1 固定 `NOT_RUN`；PU 条件 2（几何）/ 5（空中控制）`BLOCKED`；不得被其他 PU 条件 PASS 抵消。 |
| AC-12 | 是 | E2 | 无实现证据；源码 / 测试检索无 global gate close、证据基线失效、关闭优先级、cache/history/逐关覆盖逻辑；U2 复核报告 §7 将“假 NB / 假 PU 全局关闭”标 `NOT_RUN` | **NOT_RUN** | 同上 | phase-1 只有常量 gate `BLOCKED`，不是可关闭的全局 gate；无 false-NB / false-PU 回滚实现或夹具。按验收计划“无 global gate 实现 ⇒ NOT_RUN”。用户已裁定接受该 required `NOT_RUN`（重冻结授权记录 §2.4）。 |
| AC-13 | 是 | E2 | `playability-public-verdict.test.ts:116,124,132`（NB ≠ PU；admission 独立）；`playability-temporal-evasion.test.ts:232,445`（`midAirHits=0` 只作否决，不作正面证明）；`temporal-evidence.test.ts:309-316`（PU 六条件，`geometry-checked` BLOCKED）；E1 `public-verdict.ts:75-91,145-160`、`temporal-evasion.ts:35,272-304`、`temporal-result.ts:99-100` | **PASS** | 同上 + `ac13-evasion.log` `sha256:0b1ded4eef6afcd2584a77da8f2d9d34cf7a5e09de4451a3b9104153091f5a46`（36 tests，exit 0） | NB 的 `NO_PROVEN_BLOCKER`、`midAirHits=0`、conditional graph cut 不得作为 PU 正面证据。 |
| AC-14 | 是 | E2 | 部分证据：`playability-public-verdict.test.ts:220`（geometry 缺失不伪造、存在则复制）、`temporal-evidence.test.ts:347`（N4：temporal checked 不把 geometry 推成 checked）、`:250`（geometry summary 恒 partial）；**无** I03-03C 分项 PASS 消费 / probe 环境不匹配逻辑 | **NOT_RUN** | 同上 | 几何 probe 与 I03-03C 未实现（AC-15 `NOT_RUN`）；mapper 不伪造 checked，但“只认分项 PASS”“环境不匹配 ⇒ partial”无法演示。U2 复核报告将 AC-14 标 `NOT_RUN`。用户已裁定接受该 required `NOT_RUN`。 |
| AC-15 | **否** | E2+E3 | 无 probe / 夹具物化实现；授权包 §14、L4 | **NOT_RUN** | — | phase-1 固定 `NOT_RUN`；未来 probe 成功仍须 I03-03C 独立复核。 |
| AC-16 | 是 | E2 | `publish-gate.test.ts:264`（G1/G4）、`:300`（G2）、`:309`（G3）、`:357`（G5）、`:277`（G6）、`:286`（G7）、`:370`（G8）、`:389`（G9）、`:327`（G10/变异守卫）、`:339`（G11）、`:402`（源级不消费 temporal）；E1 `publish-gate.ts:56-70,153-183,261-268`；diff 无新增 `throw` | **PASS** | 同上 | G1–G11 全过；拒稿行为不变；无新增 `throw`；temporal 证据不产 `CommandError`。 |
| AC-17 | 是 | E1+E2 | `publish-gate.ts:56-70`（仅 `PublishGateResult.temporal?` 诊断字段）；`git diff 2b57f2a..HEAD` 中 `packages/cli` / `packages/mcp` / `create-game.ts` 零 diff；`publish-gate.test.ts` diff 199 增 / 2 删（仅 import 行），`create-game.test.ts` 零 diff；测试 `publish-gate.test.ts:277,370,389,402` | **PASS** | 同上 | temporal 诊断不落盘、不进 CLI / MCP、不升契约；缺省 ≠ 不适用；现有 publish-gate / create-game 断言零改动。 |
| AC-18 | 是 | E1+E2 | `git diff --name-status 2b57f2a..HEAD -- packages fixtures package.json pnpm-lock.yaml tsconfig* scripts docs .github`：仅 §11.2 白名单产品 / 测试 / fixture 文件 + 授权包 docs；`package.json` / lockfile / tsconfig / scripts / cli / mcp / demo 零 diff；T-55–T-65 全过；`playability-mechanic-matrix.json` 仅 `wide-patrol` 行变化 | **PASS** | T-55–T-65 日志 `t55-t65-guards.log` `sha256:2623dc760f93dc541d4eefdfc5455ad07fdf0a886f73eb438bc2438bbd7c19ea` | 每单元 diff 只含白名单文件与限定目的；无新依赖；T-56/57/58/60/61/62/64 保持冻结语义（T-58 按 AC-19 批准扩展）；无新增生产调用者。 |
| AC-19 | 是 | E1+E2 | `playability-temporal-input.test.ts:589-599`（T-58）；U4 diff 仅新增 `analyzeTemporalInternalTwoLag` 调用计数 1 的正向断言，保留“`analyze:` 实参只有 `stubTemporalAnalyzer`”的负向断言 | **PASS** | 同上 | T-58 按批准语义改写：允许 stub 与指定适配器、禁止其他 analyzer；正负路径均有断言。 |
| AC-20 | 是 | E2+E3 | Ledger §12.2 五行；五份增量授权；六份复核报告 + hash；`evidence/U1–U5`、`U4-amendment-02` `SHA256SUMS`；U4 / U5 / U3 / amendment-02 回滚演练日志；U1 / U2 文档化回滚；`invariant-before/after.txt` | **PASS**（含 §4.6 A1/A2 偏差披露） | 见 §1.4 / §4.6 | 五道复核门证据齐全；Ledger 完整、无预填；U4/U5/U3 实际回滚演练，U1/U2 文档化回滚；`publicCapability="BLOCKED"` / `publicResult=null` / gate `BLOCKED` / 拒稿不变 / 无未解决 STOP。 |
| AC-21 | 是 | E2+E3 | 全量 `pnpm test` / `pnpm build` / `pnpm check:deps` / `pnpm check:links` exit 0；T-55–T-65 PASS；LP-06 / LP-07 在**新冻结基线**上逐项一致；跨进程确定性 PASS | **PASS** | `lp-comparison.json` `sha256:ff2630baf0c4827c5a3deb4aa4a75074829891ac0025ca06ad71ea57399da810`；LP 完整输出与日志 hash 见 §4.3 / §4.7 | 新基线语义 hash：LP-06 `071ae5d5…`、LP-07 `5c7d9391…`；两文件 `semanticEqual=true`、0 changed pairs / 0 changed cases；组成 20 / 96 / 19 不变。首轮旧基线 FAIL 已按用户裁定重冻结并归档。 |

**逐项汇总（required 19）**：PASS = **16**（AC-01–AC-09、AC-13、AC-16–AC-21），FAIL = **0**，NOT_RUN = **3**（AC-10、AC-12、AC-14）。
**非 required**：AC-11 `NOT_RUN`、AC-15 `NOT_RUN`（均已披露，不隐藏、不计入 PASS）。

---

## 3. 负向矩阵

### 3.1 发布闸 G1–G11

| # | 场景 | 期望 | 证据 | 状态 |
| --- | --- | --- | --- | --- |
| G1 | 适用 + 时序 IE | 放行；证据记 IE | `publish-gate.test.ts:264` | **PASS** |
| G2 | 适用 + `nb-candidate` + `gate.nb=BLOCKED` | 放行；公共映射 IE | `publish-gate.test.ts:300` | **PASS** |
| G3 | 适用 + `pu-candidate` + `gate.pu=BLOCKED` | 放行；公共映射 IE | `publish-gate.test.ts:309` | **PASS** |
| G4 | 适用 + `partial` / `unknown` | 放行 | `publish-gate.test.ts:264`（G1/G4 合并） | **PASS** |
| G5 | 时序审计内部抛错 | 不抛；降级 IE / `unknown` 记录 | `publish-gate.test.ts:357` | **PASS** |
| G6 | 未传 `configPath` | 跳过；字段缺省；行为不变 | `publish-gate.test.ts:277` | **PASS** |
| G7 | 无移动 Hazard | `applicable:false`；零文件 I/O | `publish-gate.test.ts:286` | **PASS** |
| G8 | 现有 `PROVEN_UNPLAYABLE` | 照旧拒稿（回归，不变） | `publish-gate.test.ts:370` | **PASS** |
| G9 | QA 报告 error / 六条没跑全 | 照旧拒稿（回归，不变） | `publish-gate.test.ts:389` | **PASS** |
| G10 | 未来 gate `OPEN` + 证据准入通过 | 第一阶段仍不改变拒稿 | `publish-gate.test.ts:327`（G10 / 变异守卫） | **PASS** |
| G11 | 证据字段缺省 | 按 `unknown` 记录；绝不当作 `checked` 或通过 | `publish-gate.test.ts:339` | **PASS** |
| 变异 | 让时序证据直接产生 `CommandError` / 改退出码 | 测试必须失败 | `publish-gate.test.ts:327`、`:402`（源级不消费 temporal） | **PASS**（现有实现未触发变异失败；测试存在并执行） |

### 3.2 负向矩阵 N1–N18

| # | 场景 | 期望 | 归属 | 证据 | 状态 |
| --- | --- | --- | --- | --- | --- |
| N1 | `nb-candidate` + gate `BLOCKED` | 公共 IE，不是 NB | AC-05 | `playability-public-verdict.test.ts:116` | **PASS** |
| N2 | `pu-candidate` + gate `BLOCKED` | 公共 IE，不是 PU | AC-05 | `playability-public-verdict.test.ts:124` | **PASS** |
| N3 | temporal `checked` + gate `BLOCKED` | 仍是 IE | AC-05 | `playability-public-verdict.test.ts:116`、`playability-mechanic.test.ts:347` | **PASS** |
| N4 | 无移动 Hazard + temporal 缺省 | verdict 不变，不拉 IE | AC-07 | `playability-public-verdict.test.ts:87`、`playability-mechanic.test.ts:338`、`ops.test.ts:389` | **PASS** |
| N5 | 有移动 Hazard + temporal 缺省 | `unknown` ⇒ IE | AC-07 | `playability-public-verdict.test.ts:96`、`playability-mechanic.test.ts:331` | **PASS** |
| N6 | `partial` / `unknown` + existing NB | IE；不聚合为 NB | AC-06 | `playability-public-verdict.test.ts:104` | **PASS** |
| N7 | existing PU + temporal candidate + gate `OPEN` | STOP + HITL | AC-09 | `playability-public-verdict.test.ts:146,151` | **PASS** |
| N8 | existing IE + temporal candidate | 保持 IE | AC-06 | `playability-public-verdict.test.ts:187` | **PASS** |
| N9 | temporal evidence 被映射成 `ConfigIssue` | 禁止 | AC-08 | `playability-public-verdict.test.ts:240,248`、`playability-api.test.ts:88` | **PASS** |
| N10 | `partial` / `unknown` 被写成 `checked` | 禁止 | AC-03 | `playability-temporal-evidence.test.ts:236,352`；`public-verdict.ts:101-119` 无写 `checked` 分支 | **PASS** |
| N11 | NB 结果被当作 PU 正面证明 | 禁止 | AC-13 | `playability-public-verdict.test.ts:116,124,132`、`temporal-evasion.ts:35` | **PASS** |
| N12 | `midAirHits=0` / conditional graph cut 作为条件 5 证据 | 禁止 | AC-13 | `playability-temporal-evasion.test.ts:232,445`；`temporal-evidence.test.ts:309-316` | **PASS** |
| N13 | 假 NB / 假 PU | 全局关闭 + 基线失效 + IE + 关闭优先 | AC-12 | 无 global gate / 基线失效实现 | **NOT_RUN** |
| N14 | probe 退出 0 / `all-checked` 当作分项 checked；环境不匹配判 untrusted | 禁止 | AC-14 | 无 probe 实现；仅 `temporal-evidence.test.ts:347`（不伪造 geometry checked） | **NOT_RUN**（probe 部分） |
| N15 | 发布闸 G1–G11 | 全部照旧 | AC-16 | §3.1 | **PASS** |
| N16 | gate 已关闭但缓存 / 历史产物 / 逐关结果仍返回 NB / PU | 禁止 | AC-12 | 无 cache / 历史 / 逐关准入实现；phase-1 常量 gate `BLOCKED` | **NOT_RUN** |
| N17 | `NOT_RUN` 被计入 PASS 或从矩阵隐藏 | 禁止 | 全局规则 | 本报告 §2 / §6 显式列出 AC-10/11/12/14/15 为 `NOT_RUN` | **PASS** |
| N18 | 白名单外修改、新增生产调用者、新依赖 | STOP | AC-18 | 累计 diff 仅白名单；T-56/57/61 通过；`package.json` / lockfile 零 diff | **PASS** |

---

## 4. 回归命令、退出码与 hash

### 4.1 命令顺序与退出码（新基线）

| 顺序 | 命令 | 退出码 | 计数 / 结果 | 日志 + SHA-256 |
| ---: | --- | ---: | --- | --- |
| 1 | 基线采集 | 0 | main `d26276e…`；tracked clean；授权包 `2bbe7c55…` | 本报告 §1 |
| 2 | `pnpm test` | **0** | **178 test files / 2952 tests passed**；3 条 `[vitest-worker]: Timeout calling "onTaskUpdate"` unhandled errors（runner 级警告，非测试失败） | `pnpm-test.log` · `666c114e6a3dd8398c7abf326562d8493d4af53b87d3ffd2c67fb6fa792c439f` |
| 3 | `pnpm build` | **0** | `tsc -b` + 10 包 bundle 完成 | `pnpm-build.log` · `04e7a64795539d1421269b792e5f4f24edae279b0561f2a35a60635274c499e8` |
| 4 | `pnpm check:deps` | **0** | 依赖图合法（10 个包） | `check-deps.log` · `3d0dc5890b6b781d40dfe60d42610d40eb57b01010e1b56db37af0a74c8079c9` |
| 5 | `pnpm check:links` | **0** | 相对链接零断裂（1257 份文档 · 4159 条链接） | `check-links.log` · `6ddda9686a27b926c4c94ae3432290acaf09f32f0ab6f35d65bf1f0aded1ce4f` |
| 6 | T-55–T-65 单独复跑 | **0** | 1 file / 65 tests passed | `t55-t65-guards.log` · `2623dc760f93dc541d4eefdfc5455ad07fdf0a886f73eb438bc2438bbd7c19ea` |
| 7 | LP-06 `node .scratch/level-playability-v1-p1/acceptance-corpus.mjs` | **0** | 20 configs / 96 pairs；语义与新基线**一致** | `lp06-corpus-rerun-full.json` · `a85e2f25dd1f06a03bdffba2ce22f4e79d1c48dbe73af2b7ecb7db18bed6f93b` |
| 8 | LP-07 `node .scratch/level-playability-v1-p1/acceptance-matrix.mjs` | **0** | 39 cases；语义与新基线**一致** | `lp07-matrix-rerun-full.json` · `3e2614c4386679ca82021b74d1dc16e0efdeec95e31a28690f72730ec089181d` |
| 9 | 跨进程确定性（I-02 U5 冻结脚本） | **0** | 两输入 × 3 进程；签名与规范化序列化一致 | `cross-process-rerun.json` · `594a5a1f0e68c7d016a9075918e79e975e40fe7f62bed24310cbfaac56d19774` |
| 10 | AC 定向测试（9 文件） | **0** | 9 files / 303 tests passed | `ac-focused-tests.log` · `387c0dc15e78e1b084cef931dd70ee512798dab2eaf3739158266f4d4673a04f` |
| 11 | AC-13 支撑测试 | **0** | 1 file / 36 tests passed | `ac13-evasion.log` · `0b1ded4eef6afcd2584a77da8f2d9d34cf7a5e09de4451a3b9104153091f5a46` |

- **退出码语义**：以上 `0` 仅表示命令正常结束。本轮 LP-06/07 不仅退出 0，且输出与新冻结基线逐项一致，故 AC-21 PASS。
- **runner 警告**：全量测试出现 3 条 `onTaskUpdate` 超时；属 vitest worker / runner 级，不是断言失败；原样披露，不包装为通过。

### 4.2 T-55–T-65 架构守卫（逐项）

命令：`pnpm exec vitest run packages/contracts/tests/playability-temporal-input.test.ts --reporter=verbose`；exit **0**；1 file / **65 tests passed**。

| 守卫 | 断言摘要 | 结果 |
| --- | --- | --- |
| T-55 | contracts 源码不含 `node:fs` / `node:crypto` | **PASS** |
| T-56 | `verifyTemporalInput` 生产调用者只有 `ops.ts`（+ 定义处） | **PASS** |
| T-57 | `auditPlayabilityTemporal` 生产调用者只有 `ops.ts`（+ 定义处） | **PASS** |
| T-58 | 生产 `analyze:` 实参只有 `stubTemporalAnalyzer`；`analyzeTemporalInternalTwoLag(` 恰好 1 次 | **PASS** |
| T-59 | `readTrustedAtlasInput` 不是 export | **PASS** |
| T-60 | `runTemporalAudit` / `assertPublishableQa` 保持同步（非 async） | **PASS** |
| T-61 | `runTemporalAudit` 三处生产接线各至少一次（`ops.ts` / `create-game.ts` / `publish-gate.ts`） | **PASS** |
| T-62 | `TEMPORAL_LAG_MS` / `TEMPORAL_LAG_BASELINE_MS` 唯一且不复用 `FRAME_MARGIN_MS` | **PASS** |
| T-63 | `lagMs` 无默认值 | **PASS** |
| T-64 | brand Symbol 只在 `temporal-input.ts` 铸造 | **PASS** |
| T-65 | 入口没有几何 / 规避声明参数 | **PASS** |

### 4.3 LP-06 / LP-07 原命令复跑与新冻结基线比较

**新冻结基线（用户裁定，PR #70）**：

| 文件 | SHA-256 |
| --- | --- |
| `.scratch/level-playability-v1-p1/evidence/06-corpus-regression.json` | `1d5db74e3371a48253f80348165bf3c7fd026b316348d0b514faca88ad5aeabc` |
| `.scratch/level-playability-v1-p1/evidence/06-matrix-acceptance.json` | `fdc77aada4c89f70f96117dd9071709f34d15f83f501a74942240bff7c3174ef` |

**冻结基线组成（现场重算）**：usableConfigs **150**；uniquePairs **96**；uniqueConfigs **20**；x 轴 `motion.cycle` 移动 Hazard 实体 **19**（分布在 16 个 config）。证据：`corpus-composition.json` · `sha256:f2537838d2fd5655f32a30f2af1e36cd46825b191494a7127a1039a5fd364205`。

**比较方法**：读取新冻结 tracked 证据与本次复跑完整 JSON，删除顶层 `generatedAt`，对象键排序后规范 JSON 深度比较并计算 SHA-256。

| 项 | 新冻结基线 | 本次复跑 | 判定 |
| --- | --- | --- | --- |
| LP-06 语义 hash（去 `generatedAt`） | `sha256:071ae5d58502984374ae0c3c20748571303a1675cb43ef9da1f45456682bb4c3` | `sha256:071ae5d58502984374ae0c3c20748571303a1675cb43ef9da1f45456682bb4c3` | **一致** |
| LP-06 深度比较 | — | `semanticEqual=true` | **一致** |
| LP-06 counts | 150 / 96 / 20 / 96 / 20 / 31 | 150 / 96 / 20 / 96 / 20 / 31 | 一致 |
| LP-06 pair 变化 | — | **0 / 96** | 一致 |
| LP-06 20 config verdict | 见 `lp-comparison.json` | 逐项相同 | 一致 |
| LP-07 语义 hash（去 `generatedAt`） | `sha256:5c7d9391b27e45beeaca113d61bdf37d9aae216dfb266815bd0115d0401d1665` | `sha256:5c7d9391b27e45beeaca113d61bdf37d9aae216dfb266815bd0115d0401d1665` | **一致** |
| LP-07 深度比较 | — | `semanticEqual=true` | **一致** |
| LP-07 case 变化 | — | **0 / 39** | 一致 |
| LP-07 finalDistribution | IE 3 · PROVEN 19 · NB 17 | IE 3 · PROVEN 19 · NB 17 | 一致 |

- 新冻结语义 hash 与用户裁定值逐字一致；新 tracked 文件 hash 与重冻结记录逐字一致。
- **tracked evidence 隔离**：复跑前 recorded hash 为新基线 `1d5db74e…` / `fdc77aad…`；复跑后已 `git checkout --` 恢复，恢复后 hash 逐字回到新基线；`git status --porcelain` 对两文件为空。完整复跑输出保存在 `evidence/acceptance-run2/lp06-corpus-rerun-full.json` / `lp07-matrix-rerun-full.json`。
- 首轮旧基线的 FAIL 比较与完整归因保留在归档报告 `I03-acceptance-run1-FAIL.md`；本轮不重复旧基线比较，也不修改历史证据。

### 4.4 跨进程确定性（I-02 U5 冻结命令）

命令：`node .scratch/level-playability-v1.1-u5/scripts/cross-process-determinism.mjs`（先 `pnpm build`，exit 0）。环境：Darwin 24.6.0 arm64 · Node v22.23.2 · pnpm 10.7.1。

| 输入 | 冻结签名 | 本次签名（3 进程） | 冻结规范化 sha256 | 本次规范化 sha256（3 进程） | 墙钟 | 判定 |
| --- | --- | --- | --- | --- | --- | --- |
| `last-train` fixture | `e504455e` | `e504455e,e504455e,e504455e` | `sha256:f154e646…6c94` | `sha256:f154e646ba5d14c29ab39850744865dc2eeca2c9b67d06f5dd4f4b26855c6c94` | 0 / 1 / 1 | **PASS** |
| compact NB 内存世界 | `2c4d7930` | `2c4d7930,2c4d7930,2c4d7930` | `sha256:da8d07ab…779a` | `sha256:da8d07abd86d162da46b6b65cc66f08e3485db4652ed69240c7d1b48b710779a` | 0 / 67 / 67 | **PASS** |

- `internalResult`：`last-train` = `insufficient-evidence`；compact NB = `nb-candidate`；`certificateKind`：`none` / `witness`。均与冻结输出一致。
- 命令输出 `ok:true`，exit **0**；两输入的 `signatureEqual` / `normalizedEqual` / `wallClockDiffered` 均为 true。实际签名与规范化 hash 已逐项比较，均与冻结值一致。
- 复跑前 / 后 tracked 证据 `04-cross-process.json` hash：`3a01487ee8b144a92a540cae896716a6293e5c7658ec580ee57f7a47645444c6`；复跑后已恢复，hash 相同；`git status` 对该文件为空。

### 4.5 AC-07 特别复核（U3 接管 + U4 amendment-02 降级路径）

**要求**：existing NB + trusted 失败 / analyzer 抛错 ⇒ 公共 temporal 诊断 IE / unknown，不得记录 NB；同时 `PUBLIC_NB` / `PUBLIC_PU` 仍 `BLOCKED`、`publicCapability="BLOCKED"` / `publicResult=null`、发布拒稿行为不变。

| 检查 | 证据 | 结果 |
| --- | --- | --- |
| existing NB（`NO_PROVEN_BLOCKER`，`ops.test.ts:347`）+ trusted 输入不可用 ⇒ publicVerdict IE / `coverage.temporal="unknown"` / evidence `[]`，不抛 | `ops.test.ts:397`；`ops.ts:1044-1062`（`temporalFailure` 用真实 `mapPublicVerdict`，注释明确不得复制 existing NB）；`public-verdict.ts:151`（`temporalState !== "checked"` ⇒ IE） | **PASS** |
| existing NB + 真实 analyzer 抛错 ⇒ IE / unknown / evidence `[]`，不抛 | `ops.test.ts:413`（`vi.doMock` 注入真实 `analyzeTemporalInternalTwoLag` 抛错，走真实 `runTemporalAudit`）；`ops.ts:1145-1146` | **PASS** |
| `PUBLIC_NB` / `PUBLIC_PU` 仍 `BLOCKED` | `public-verdict.ts:25-33`（`PHASE1_CAPABILITY_GATE = {nb:"BLOCKED",pu:"BLOCKED"}`，admission 两项 false）；`playability-public-verdict.test.ts:261-265`（常量冻结） | **PASS** |
| I-02 `publicCapability="BLOCKED"` / `publicResult=null` 未被改写 | `temporal-result.ts:44-45`；`temporal.ts:380-381`；U1–U5 `invariant-after.txt` 均记录相同值 | **PASS** |
| 发布拒稿行为不变 | G8 / G9（`publish-gate.test.ts:370,389`）；全量 publish-gate / create-game 测试通过；`publish-gate.ts` diff 无新增 `throw` | **PASS** |
| U3 temporal 接管：`wide-patrol` 层内 NB + checked、公共 IE；applicable partial/unknown ⇒ IE；缺 evidence ⇒ unknown ⇒ IE；不适用保留 existing | `playability-mechanic.test.ts:302,320,331,338,347` | **PASS** |

**结论**：AC-07 特别复核全部满足；降级路径不再把 existing NB 复制为公共 verdict，而是经 U2 mapper 收敛为 IE / unknown。

### 4.6 额外发现与限制（不隐去）

| # | 发现 | 影响 | 处理 |
| --- | --- | --- | --- |
| A1 | U2 Ledger 行写“audit 分支 `wayfinder/i03-u2-evidence` @ `9cf89db`”，但 `9cf89db` 不是该分支祖先（分支头 `257a6f7` 树中无 `U2-review.md`）；复核报告实际在 `wayfinder/level-playability-v1.1-i03-u2` @ `9cf89db` | 证据仍可按 SHA 解析且 hash 一致；分支归属文字不准确 | 记录，不修补历史 Ledger；AC-20 仍判 PASS（证据可解析、hash 一致） |
| A2 | U1 / U2 `commands.log` 被 `.gitignore` 的 `*.log` 忽略，未 `-f` 加入 audit 分支；`SHA256SUMS` 列了该文件但分支树中缺失 | 工作树文件存在且 SHA-256 与声明一致（U1 `c93f9376…`、U2 `2c0ad105…`）；audit 分支单独不可完整校验 | 记录为证据归档卫生问题；不影响本轮 hash 复核 |
| A3 | 全量 vitest 有 3 条 `onTaskUpdate` worker 超时（runner 级） | 非测试失败；与历史 I03-10 / U3 / U5 记录同类 | 原样披露 |
| A4 | LP-06/07 无 vitest、不在 CI（L1） | 只能 scratch 复跑；复跑会临时改写 tracked 证据 | 已在 §4.3 恢复并验证新基线 hash / `git status` |

### 4.7 证据索引（本轮 scratch）

目录：`.scratch/level-playability-v1.1-i03-impl/evidence/acceptance-run2/`

| 文件 | SHA-256 |
| --- | --- |
| `pnpm-test.log` | `666c114e6a3dd8398c7abf326562d8493d4af53b87d3ffd2c67fb6fa792c439f` |
| `pnpm-build.log` | `04e7a64795539d1421269b792e5f4f24edae279b0561f2a35a60635274c499e8` |
| `check-deps.log` | `3d0dc5890b6b781d40dfe60d42610d40eb57b01010e1b56db37af0a74c8079c9` |
| `check-links.log` | `6ddda9686a27b926c4c94ae3432290acaf09f32f0ab6f35d65bf1f0aded1ce4f` |
| `t55-t65-guards.log` | `2623dc760f93dc541d4eefdfc5455ad07fdf0a886f73eb438bc2438bbd7c19ea` |
| `ac-focused-tests.log` | `387c0dc15e78e1b084cef931dd70ee512798dab2eaf3739158266f4d4673a04f` |
| `ac13-evasion.log` | `0b1ded4eef6afcd2584a77da8f2d9d34cf7a5e09de4451a3b9104153091f5a46` |
| `lp06-corpus-rerun-full.json` | `a85e2f25dd1f06a03bdffba2ce22f4e79d1c48dbe73af2b7ecb7db18bed6f93b` |
| `lp07-matrix-rerun-full.json` | `3e2614c4386679ca82021b74d1dc16e0efdeec95e31a28690f72730ec089181d` |
| `lp-comparison.json` | `ff2630baf0c4827c5a3deb4aa4a75074829891ac0025ca06ad71ea57399da810` |
| `cross-process-rerun.json` | `594a5a1f0e68c7d016a9075918e79e975e40fe7f62bed24310cbfaac56d19774` |
| `corpus-composition.json` | `f2537838d2fd5655f32a30f2af1e36cd46825b191494a7127a1039a5fd364205` |
| `lp06-stdout.json` | `9da9484c6513c20ba133259683c10c1daee10fd0299a0f0f1b60ced5312c35c8` |
| `lp07-stdout.json` | `6890ac2e868534e98e2299ac52b3c69c827bd687417c0e6f054ad6961532e877` |

关键源码 / 测试文件 SHA-256（HEAD @ `d26276e`；产品代码与 `148b89b` 相同）：

| 文件 | SHA-256 |
| --- | --- |
| `packages/contracts/src/playability/verdict.ts` | `343f8e24eb75516c13358b4b7bfafdf103488efb47d1b4e393210f1340350c00` |
| `packages/contracts/src/playability/temporal-evidence.ts` | `ec7844aa420a09deb4796635a1089d9562ea59943e5ae505aeb89a7aac154e81` |
| `packages/contracts/src/playability/public-verdict.ts` | `ec67f5a7737e711ef4d25fb52fadc7c210eb50c23de9fe8eac3c3175d493a18c` |
| `packages/contracts/src/playability/api.ts` | `52ccef05a19ba9f7b6e8840ecae61c42174539e5d62c6b872c3478abce1c4811` |
| `packages/contracts/src/playability/mechanic.ts` | `9891145aba9271798be476c802734f445e0fcc874f68fa83fc98d9c8a5ed2984` |
| `packages/contracts/src/playability/temporal-result.ts` | `04e3c37ca140fa09b3ea1eabf0d0d3336c06cdda2cdeafde719c5b44c6d343fc` |
| `packages/contracts/src/playability/temporal.ts` | `6df8475822717d7e06a611e2e539785a3f8c9f67719e93d07e03d6373ef7ce53` |
| `packages/contracts/src/playability/temporal-evasion.ts` | `8712da87e6e08e37e3c437106ee8f4b28707b51cee4522ceb1fb2f9b4799d773` |
| `packages/assets/src/ops.ts` | `587dca3e44467b1d251c0a95ec637980d125bab36141a375f80a7f134bd56c58` |
| `packages/pipeline/src/publish-gate.ts` | `72786d2bce3d612af730af05560cf3b49d0123f16b5f7dddf0300c6274cfc28a` |
| `packages/contracts/tests/playability-temporal-evidence.test.ts` | `06ba73bbc4929bfde7d3d2dba6c591b4b3681555edb37f854611fba549a1a2af` |
| `packages/contracts/tests/playability-public-verdict.test.ts` | `4d68e624f93dc965988b3b65b64c01f6156a32c8daad58ef8700b9d4ceaa7fde` |
| `packages/contracts/tests/playability-api.test.ts` | `0c3a27a52499c4f3b6898f17fa1d8914cdef4dbf65103c40511b68fbf1f4c9ec` |
| `packages/contracts/tests/playability-mechanic.test.ts` | `7c627b01bb650e57e3461ae6b409ca7c36a91e944544588991a40797b7fbb708` |
| `packages/contracts/tests/playability-temporal-input.test.ts` | `4c4acf1958f6866c641f1f94c58306fdd9992e89957bd22f5ace8a48bce92ade` |
| `packages/assets/tests/ops.test.ts` | `55c23e49da3e352824ccfd51f60671ebda49e249926a9f7bd09eba05d7646edb` |
| `packages/pipeline/tests/publish-gate.test.ts` | `8a45a436363bd1e1f49d9d2c34d7d8a43dd186bc46c9531dda1f7a0ded237f45` |
| `packages/contracts/tests/playability-temporal-evasion.test.ts` | `3839288b33fe623b9c3f420767c6b92b741729fee1bc494f70078013ecc30817` |

---

## 5. L1–L8 固定披露

| 编号 | 已知限制 | 本轮验收处理 |
| --- | --- | --- |
| **L1** | LP-06/07 无 Vitest、不在 CI | 已用原命令 scratch 重跑；退出码 0，且在新冻结基线上语义逐项一致（§4.3）；记录限制，未包装成 CI 通过。 |
| **L2** | Runtime hitbox equality 未证 | 未宣称 Runtime 几何已 checked；`runtimeBody="unverified"`、`geometry.summary.coverage="partial"` 原样保留。 |
| **L3** | PU 条件 5 未闭合 | AC-11 非 required、`NOT_RUN`；条件 2 / 5 `BLOCKED`；未被其他 PU 条件 PASS 抵消。 |
| **L4** | 几何 probe 未实现、夹具未物化 | AC-15 非 required、`NOT_RUN`；AC-14 required、`NOT_RUN`；未来 probe 成功仍须 I03-03C 独立复核。 |
| **L5** | 19 关语料只承担 IE 不回归 | 新基线上 20 configs / 96 pairs / 19 x 轴 Hazard 与复跑逐项一致；未把语料用作 NB / PU 正例。 |
| **L6** | 不新增性能基准 | 沿用 I-02 / U5 预算证据；本轮未新增性能基准。 |
| **L7** | 跨进程确定性检查为 scratch、非 CI | 已记录命令、环境、输出与 hash；实际输出逐项比较（§4.4）。 |
| **L8** | 验收全绿不等于能力开放 | 本报告整体状态为 **INCOMPLETE**（无 required FAIL，但存在 required `NOT_RUN`），不构成关闭完成，更不构成开放；`PUBLIC_NB` / `PUBLIC_PU` 继续 `BLOCKED`；`publicResult=null`。 |

---

## 6. 整体状态

### 6.1 判定

| 项 | 结果 |
| --- | --- |
| required AC 总数 | 19 |
| required PASS | **16**（AC-01–AC-09、AC-13、AC-16–AC-21） |
| required FAIL | **0** |
| required NOT_RUN | **3**（AC-10、AC-12、AC-14） |
| 非 required | AC-11 `NOT_RUN`、AC-15 `NOT_RUN`（已披露） |
| **整体状态** | **INCOMPLETE** |
| **验收退出码** | **0**（没有 required FAIL；**不等于整体 PASS**，仍有 required `NOT_RUN`） |

### 6.2 FAIL / NOT_RUN 明细

- **required FAIL：无。**
- **AC-10（required，NOT_RUN）**：NB 十项 §8.2 准入规则 / 固定 admission 夹具未在 phase-1 实现；mapper 只消费布尔 `admission`。U2 复核报告标 `NOT_RUN`；用户已裁定接受。
- **AC-12（required，NOT_RUN）**：无 global gate close / 证据基线失效 / cache-history-逐关优先实现；phase-1 仅常量 gate `BLOCKED`。用户已裁定接受。
- **AC-14（required，NOT_RUN）**：无 I03-03C 分项 PASS 消费 / probe 环境不匹配逻辑；仅能证明 mapper 不伪造 geometry checked。用户已裁定接受。
- **AC-11 / AC-15（非 required，NOT_RUN）**：PU 条件 2 / 5 `BLOCKED`；几何 probe 未实现。已按 phase-1 固定披露。
- **首轮 AC-21 FAIL 的处置**：用户裁定授权重冻结 LP-06/07 tracked 基线（PR #70），本轮在新基线上重跑；LP-06/07 语义 hash 与新基线逐项一致，AC-21 转 **PASS**。首轮 FAIL 报告原样归档，不修改历史记录。

### 6.3 关闭相关不变量

- `PUBLIC_NB` / `PUBLIC_PU`：**仍 `BLOCKED`**（`public-verdict.ts:25-33`）。
- `publicCapability="BLOCKED"` / `publicResult=null`：**未改写**（`temporal-result.ts:44-45`、`temporal.ts:380-381`）。
- 发布拒稿行为：**与冻结基线一致**（G1–G11 + 全量 publish-gate / create-game 测试通过；`publish-gate.ts` diff 无新增 `throw`）。
- 未解决 STOP：未发现。白名单外修改 / 新依赖 / 新增生产调用者：未发现（§4.2、§4.6）。
- **关闭 ≠ 开放**：本报告只表示验收事实；phase-1 关闭仍需用户审阅并签署，且不开放任何公共能力。

---

## 7. 用户签署记录

| 项 | 值 |
| --- | --- |
| 签署人 | **amber** |
| 日期 | **2026-11-17** |
| 结论 | **接受 INCOMPLETE；phase-1 收口** |
| 备注 | 用户裁定：AC-10 / AC-12 / AC-14 为 required `NOT_RUN`，以 INCOMPLETE 完整披露收口；AC-11 / AC-15 非 required `NOT_RUN`；`PUBLIC_NB` / `PUBLIC_PU` 仍 `BLOCKED` |

> 本报告由独立验收会话撰写；**用户审阅并签署**。验收会话未替用户签署。
> 整体状态为 **INCOMPLETE**（required PASS 16 / FAIL 0 / NOT_RUN 3）；required `NOT_RUN` 为 AC-10 / AC-12 / AC-14，非 required `NOT_RUN` 为 AC-11 / AC-15。用户已于 **2026-11-17** 签署接受该状态并记录 phase-1 关闭；关闭 ≠ 能力开放。
