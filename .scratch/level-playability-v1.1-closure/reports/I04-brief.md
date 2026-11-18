# I-04 unit brief · 负向与回归验收

| 项 | 值 |
| --- | --- |
| 票 | [`04-i04-brief`](../issues/04-i04-brief.md)（grilling，resolved 2026-11-18） |
| 授权包 | `docs/v7.8/移动-收口.md` §4（UNSIGNED 草案） |
| 差分底座 | [`01-coverage-inventory`](../evidence/01-coverage-inventory.md) @ `sha256:9cba8e38…` |
| 状态 | **brief 冻结；I-04 `NOT_AUTHORIZED`**——实施前仍需独立增量授权记录 + 用户签署 |
| 基线 | 单元分支切出时的 `main` SHA（不在本 brief 预填） |

## 0. 单元性质

I-04 = **受限测试补齐 + 只读验收扫描 + 独立复核**。

- 允许**新增测试**证明已有行为；**不允许修改被测行为**让验收通过。
- 不新增算法、不改产品源码、不改既有测试、不改既有 fixture。
- 不消费 P7 / I-03 的结论冒充 I-04 PASS。

## 1. 范围与逐项判据

| # | 要求 | 现状（盘点） | I-04 动作 | 目标判定 |
| --- | --- | --- | --- | --- |
| I04-01 | G-01 Hitbox 来源可信（真实帧几何 ↔ Runtime body） | PARTIAL | **正向交叉核对 deferred to P3+P6（`NOT_RUN`）**；仅汇总既有负例证据；不得用 P1 夹具替代 | PASS（负向）+ NOT_RUN（正向，非 required） |
| I04-02 | G-02 Lag 来源明确 | PASS | 汇总 + fresh 复跑 | PASS |
| I04-03 | G-03 时间行为确定 | PARTIAL | 写明确支持范围 + 新增具名 `unknown-phase` 端到端负例 | PASS（带支持范围限制） |
| I04-04 | G-04 垂直规避不得伪造 | PARTIAL | 只验否定侧；正向闭合归 PU-C5 | PASS（否定侧） |
| I04-05 | G-05 运动模型边界严格 | PARTIAL | 新增 moving platform / danger strike 两个 `model-out` 直接测试 | PASS |
| I04-06 | G-06 判定语义受限 | PASS | 汇总 + fresh 复跑 | PASS |
| I04-07 | G-07 生产集成独立验收 | PARTIAL | 产出 I-04 自己的验收报告 + fresh 复核 + 用户签署 | PASS（I-04 范围内） |
| I04-08 | 伪造几何拒绝 | PASS（否定侧） | 汇总 + fresh 复跑 | PASS |
| I04-09 | 未知相位拒绝 | PARTIAL | 同 I04-03 的具名负例 | PASS |
| I04-10 | 错误 lag 拒绝 | PASS | 汇总 + fresh 复跑 | PASS |
| I04-11 | V1 完整回归 | PASS（带限制） | 在 I-04 基线原样复跑 vitest + LP-06/07 | PASS（带已知限制） |
| I04-12 | 确定性 / 重复执行 | PASS（带限制） | 原样复跑进程内 + 跨进程确定性证据 | PASS（带已知限制） |
| I04-13 | 19 个 moving-hazard config 无误拒 | PARTIAL | L1 全量扫描 + L2 发布闸子集 | PASS（带 L2 覆盖披露） |

### 1.1 Deferred 项（必须出现在验收报告首页，不计入 required）

- **G-01 正向交叉核对**：依赖 P2 probe + P3 复核 + P6 消费；三者未授权。I-04 标 `NOT_RUN`，**不得**把「unit PASS」写成「G-01 已闭合」。
- **G-04 正向闭合**：归 PU-C5（条件 5）。
- **AC-10 / AC-12 / AC-14**：Phase-2 required `NOT_RUN`，不属 I-04。

## 2. 白名单

### 2.1 允许新增（只增）

| 路径 | 目的 |
| --- | --- |
| `packages/contracts/tests/playability-unknown-phase.test.ts` | 具名 `unknown-phase` 端到端负例（断言 IE；不得提升） |
| `packages/contracts/tests/playability-model-out.test.ts` | moving platform（moving solid）与 danger `strike` 的 `model-out` 直接测试 |
| `.scratch/level-playability-v1.1-closure/scripts/i04-publish-gate-scan.mjs` | L1 / L2 扫描脚本（只读调用既有 API，不联网、不写产品目录） |
| `.scratch/level-playability-v1.1-closure/evidence/i04/**` | 命令日志、扫描结果、哈希 |
| `.scratch/level-playability-v1.1-closure/reports/I04-acceptance.md` | 验收报告 |
| `.scratch/level-playability-v1.1-closure/reports/I04-review.md` | fresh 复核报告 |
| `.scratch/level-playability-v1.1-closure/reports/I04-signature.md` | 用户签署记录 |

### 2.2 禁止修改

- `packages/**/src/**` 任何产品源码（含 `temporal.ts`、`verdict.ts`、`publish-gate.ts`、`ops.ts`）。
- 任何**既有**测试文件（含断言、用例名、期望值）。
- `fixtures/**` 任何文件。
- 已签署文档（I-00 / I-02 / I-03 / Phase-2 annex）。
- 其他 `.scratch` effort 的目录。
- Lockfile、`package.json`、`tsconfig*`。

### 2.3 测试数据

新增测试默认**内联构造** config / manifest / 报告对象；需要新增 fixture 文件 ⇒ STOP + 扩展白名单，不在本 brief 预授权。

## 3. 验收执行

### 3.1 回归口径

在 I-04 基线（单元分支切出时的 `main`）依次运行并记录命令、退出码、耗时、输出哈希：

```
pnpm test
pnpm typecheck
pnpm build
pnpm check:deps
pnpm check:links
```

LP-06/07 在**干净临时 worktree** 的同一基线复跑：

```
node .scratch/level-playability-v1-p1/acceptance-corpus.mjs
node .scratch/level-playability-v1-p1/acceptance-matrix.mjs
```

- 记录退出码、计数（20 config / 96 pairs / 39 cases）、产物 JSON 哈希。
- 主工作树必须保持零污染；复跑后 `git status --porcelain` 为空（或仅含本单元白名单内文件）。
- LP-06/07 不在 CI、会覆写 tracked 证据 JSON —— 写入已知限制。
- I-03 `acceptance-run2/` 证据目录在 I-04 基线不存在：不引用其日志作为可复算证据，写入已知限制。

### 3.2 19 关「无误拒」双层扫描

**L1（全 16 config / 19 mover）**：`i04-publish-gate-scan.mjs` 对每个 config 调用 `auditPlayabilityTemporal` + `auditPlayability`：

- 断言 19 个 mover 的时序结果为 `insufficient-evidence`，不得产出 `nb-candidate` / `pu-candidate`。
- 断言静态 verdict 与 LP-06 冻结基线一致（`NO_PROVEN_BLOCKER` / `PROVEN_UNPLAYABLE` / `INSUFFICIENT_EVIDENCE` 逐 config 比对）。

**L2（有现成 qa-report + pack 的子集）**：调用 `assertPublishableQa`，断言放行决定与基线一致。

**「误拒」定义**：任一 config 相比基线**新增** `PROVEN_UNPLAYABLE`，或 temporal 产出 candidate，或 L2 中放行决定发生变化。

- 缺 qa-report 的 config 记为 **L2 未覆盖**，不得为它生成 QA，也不得推断「放行通过」。
- 任一误拒 ⇒ STOP + HITL；I-04 不允许新增算法，不得自行修判据。

### 3.3 新增测试的断言要求

- `playability-unknown-phase.test.ts`：相位不可确定且无安全等待格 ⇒ `INSUFFICIENT_EVIDENCE`；不得提升为 NB / PU；测试名必须显式含 `unknown-phase`。
- `playability-model-out.test.ts`：moving platform（moving solid）与 danger `strike` 各一例 ⇒ IE + `model-out`；不得静默近似。
- 两个文件只 import 既有公共 API，不复制内部实现。

### 3.4 确定性

- 同输入重复执行签名一致（进程内，至少 3 次）。
- 跨进程证据按既有脚本复跑并记录；不在 CI 写入已知限制。

### 3.5 证据目录

`evidence/i04/` 至少含：`commands.log`、`pnpm-test.log`、`typecheck.log`、`build.log`、`deps.log`、`links.log`、`lp06.json`、`lp07.json`、`scan-l1.json`、`scan-l2.json`、`determinism.json`、`invariants.json`、`SHA256SUMS`。

不变量快照必须同时保存修改前基线与运行后结果：`publicCapability="BLOCKED"`、`publicResult=null`、`PUBLIC_NB` / `PUBLIC_PU` gate `BLOCKED`、发布拒稿行为不变。

## 4. 判定模型

- 逐项：`PASS` / `FAIL` / `NOT_RUN`。
- 单元整体：无 `FAIL` 且所有 in-scope required 项 `PASS` ⇒ `PASS`；in-scope 项有 `NOT_RUN` ⇒ `INCOMPLETE`；任一 `FAIL` ⇒ `FAIL`。
- 退出码：`0` = 无 required FAIL；`1` = 至少一个 required FAIL；`2` = 输入 / 基线 / 报告结构无效。
- `NOT_RUN` 不得计为 `PASS`；不得用通过率 / 加权替代逐项判定。
- Deferred 项（§1.1）不是 required，但必须在报告首页列出，且不得表述为已闭合。

## 5. 复核与签署

- fresh reviewer 未参与 I-04 实施；只接收白名单、命令日志、证据 hash、报告。
- 复核至少：独立复算 L1 扫描；抽查 3 个负例（伪造几何 / 未知相位 / 错误 lag）；核对 `git diff --stat` 与白名单逐项比对；核对不变量快照。
- 全量 vitest 以命令日志 + hash 采信，不要求重跑 2952 例。
- 复核 PASS + 用户签署后才可合并；报告含独立性、日期 / 环境、输入 hash、限制、签署行。

## 6. STOP

1. 白名单外任何改动（含既有测试、产品源码、fixtures、Lockfile / tsconfig）⇒ STOP。
2. L1 / L2 任一误拒 ⇒ STOP + HITL；不得修改判据或算法。
3. 用 P1 夹具或静态层结论替代 G-01 / G-04 正向证据 ⇒ STOP。
4. 把 `NOT_RUN` 写成 `PASS`，或把 I-03 / P7 结论当 I-04 PASS ⇒ STOP。
5. 生成新 QA / 新 fixture / 触上游 ⇒ STOP。
6. 主工作树出现白名单外污染且无法说明 ⇒ STOP。

## 7. 回滚

I-04 属**产品相邻（只增测试）**单元：

- 回滚目标 = 单元分支切出时的 `main` SHA。
- 必须做隔离分支 revert drill：撤销新增测试 / 脚本 commit → 跑 `pnpm test` + 全量 `pnpm test` → 记录日志、退出码、hash。
- 产品源码零改动，故无产品行为回滚；若发现产品改动 ⇒ 已违反白名单，按 STOP 处理。

## 8. Handoff（→ I-05）

I-04 签署后向 I-05 交付：回归基线（命令 + hash）、L1 / L2 扫描结果与脚本、已知限制清单、deferred 项清单、不变量快照。

本 brief 不授权 I-05；I-05 仍需独立增量授权。
