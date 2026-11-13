# U5-03 墙钟 abort 与确定性 — 证据

| 项 | 值 |
| --- | --- |
| 日期 | 2026-11-13 |
| 分支 | `wayfinder/level-playability-v1.1-u5` |
| base | `750408d`（U5-02） |
| 授权包 SHA-256 | `797cd6fc7b299e22b6e90b9ef8a9567376ea3a914d70f8b6f1fc0f9a6ecedc56`（未变） |
| 实现票 | [U5-03](../issues/04-u5-03-determinism.md) |

## 产品改动

**无。** 审计确认 `determinismSignature`、墙钟注入与遍历顺序已满足 D5 §8 / D9 §7，未发现需要修改的产品缺口：

- `determinismSignature` 覆盖 `stats.grid`、`stats.work` 计数、`internalResult`、`certificate`、`diagnostics` 原因码、`stats.budget` 状态；
- 排除 `stats.timing.wallClockMs`、`diagnostics.detail`、时间戳与 `testHooks`；
- 对象键由 `stableStringify` 排序，数组保留语义顺序；字符串排序使用码点比较（无 `localeCompare`）；
- W 的 BFS / 策略提取使用整数状态与固定顺序；hop 端点排序、`puConditions` 顺序、`secondaryReasons` 字典序均已冻结。

新增内容全部为测试与 scratch 证据：

| 文件 | 改动 |
| --- | --- |
| `packages/contracts/tests/playability-temporal.test.ts` | +7 条 U5-03 测试 |
| `.scratch/level-playability-v1.1-u5/scripts/cross-process-determinism.mjs` | 新建：跨进程 E3 证据脚本 |
| `.scratch/level-playability-v1.1-u5/evidence/04-cross-process.json` | 新建：跨进程输出 |

- `temporal.ts` / `temporal-budget.ts` / `temporal-witness.ts` / `temporal-evasion.ts`：**零改动**。
- 无新依赖、无 JSON fixture、无公共 barrel 导出、未扩闭集。

## 墙钟 abort-only

| 场景 | 注入 | 结果 |
| --- | --- | --- |
| 步进时钟 + `timeBudgetMs=10` / `checkpointWork=1` | `now` 每次 +100ms | 确定性命中 `wall-clock-abort`；`budgetStatus="aborted"`、`budgetKind="wall-clock-abort"`；重复运行签名一致 |
| 同一工作预算 + 恒定时钟 | `now = () => 0` | 不 abort，`nb-candidate`；证明 abort 只由注入时钟驱动，不依赖真实耗时 |
| 速率 0 / 1ms 的同一输入 | 独立进程 | `wallClockMs` 0 vs 67，签名与规范化序列化完全一致 |

## 确定性证据

### 签名覆盖与排除

| 字段 | 进入签名 | 证据 |
| --- | --- | --- |
| `certificate`（含 witness / proof） | 是 | 改动一条 `verifications` 的 `t0` ⇒ 签名改变 |
| `stats.grid` / `stats.work` / `budgetStatus` / `budgetKind` | 是 | U1 预算测试逐字段覆盖（R1 已复核） |
| `diagnostics.degradationReason` / `secondaryReasons` | 是 | U1 预算测试 |
| `stats.timing.wallClockMs` | 否 | 速率 0 / 1ms 结果签名一致；规范化视图剔除后逐字节一致 |
| `diagnostics.detail` | 否 | 两类 `spawn-not-on-lattice` 缺口（出界 / 不 standable）细节不同、签名一致 |

### 重复运行

四个世界（NB / PU / G / 门区失败）× 三档 lag（0 / 16.67 / 200ms）各跑两遍：

- `stats.determinismSignature` 相等；
- `deterministicView`（剔除 `wallClockMs` / `detail`）的规范化 JSON 逐字节相等。

### 策略顺序

- D5 §8：同 rank 后继取最小 `footX`、再最小 `k`。
- 在 `playerSpeed=90`、`maxStates=38` 的小世界上有 **30 个多候选状态**；逐状态枚举全部同 rank 合法后继，选中的后继与最小 `(footX, k)` **零分歧**。
- W 的策略表按状态索引升序输出；BFS FIFO、前驱 x 升序；不依赖 `Set` / `Map` 迭代顺序。

### 跨进程（E3）

脚本：`.scratch/level-playability-v1.1-u5/scripts/cross-process-determinism.mjs`
输出：`.scratch/level-playability-v1.1-u5/evidence/04-cross-process.json`

| 输入 | 结果 | 签名 | 规范化 sha256 | 墙钟 |
| --- | --- | --- | --- | --- |
| `last-train` fixture | IE / `none` | `e504455e`（3 进程一致） | `sha256:f154e646…6c94`（3 进程一致） | 0 vs 1（不同） |
| compact NB 内存世界 | `nb-candidate` / `witness` | `2c4d7930`（3 进程一致） | `sha256:da8d07ab…779a`（3 进程一致） | 0 vs 67（不同） |

两个输入都覆盖了「进程数 ≥ 2」「时钟速率不同」「签名一致」「规范化序列化一致」。

## 命令与退出码

| 命令 | 退出码 | 结果 |
| --- | ---: | --- |
| `pnpm build` | **0** | 通过 |
| `pnpm typecheck` | **0** | 通过 |
| 定向 `playability-temporal.test.ts` + `playability-temporal-budget.test.ts` | **0** | **52 / 52 passed** |
| `playability-temporal-input.test.ts --reporter=verbose` | **0** | **65 / 65 passed**；T-55 / T-57 / T-58 / T-61 / T-62 / T-64 全 ✓ |
| `node .scratch/level-playability-v1.1-u5/scripts/cross-process-determinism.mjs` | **0** | 两个 case 的签名 / 规范化序列化均一致；`ok: true` |
| `pnpm test` | **0** | **176 files / 2860 tests passed**；3 条 `onTaskUpdate` RPC 超时（工具层，非断言失败） |

原始输出：`04-{build,typecheck,architecture,targeted,test}.log`（本地保留，不入库）。

| 日志 | sha256 |
| --- | --- |
| `04-test.log` | `b110c5610ae9801defc4d4c98fb9751846657fd492bc65c13185d59ee98adee9` |
| `04-build.log` | `7408a346dc9b3bdfb95bac36faceb5978515209b16ec3ba0667333601667706b` |
| `04-typecheck.log` | `b456fec33c9a48b4cbd55316994e077075fed0425101f58036306a903831488d` |
| `04-architecture.log` | `f2fdee694b9b9fa80bda1b5f1afef0bcdfe9697f8646e3123fad986f66681c14` |
| `04-targeted.log` | `4ff6d1cb80c9a32bd2019d62cf4436f35625dd66ad2a3814e3b6a7a4e34efec7` |
| `04-cross-process.json` | `3a01487ee8b144a92a540cae896716a6293e5c7658ec580ee57f7a47645444c6` |

## 已知限制

- 真实墙钟 abort 的发生点依赖环境，按 D5 Q1 **不在确定性承诺范围内**；确定性承诺只覆盖「在工作预算内完成」的运行与注入时钟的确定性 abort。
- U9 不在 U5 组装路径（`coverage.temporal = partial`，D10 §1.1），跨进程完整证书证据由 W 提供；U9 的确定性由 U2 测试覆盖。
- U5-02 的 `stats.work.hopSamplesChecked = 0` 与 U4 独立搜索预算缺口仍未闭合；它们不影响本票的签名 / 序列化一致性结论。
- U5-01 登记的 **F（门区不成立）证书形状缺口**已由 [增量裁定 08](../../level-playability-v1.1-i02/reports/08-u5-f-certificate-decision.md) 解决（方案 ③：`none` + `no-permanent-gate`）。

## 结论

墙钟 abort 可由注入时钟确定性触发；签名与规范化完整序列化排除 `wallClockMs` / `detail`；四世界 × 三档重复运行一致；策略 tie-break 零分歧；两个输入在独立进程中签名与序列化一致。U5-03 为**零产品改动**的验证硬化票。U5-04 为下一 frontier 票。
