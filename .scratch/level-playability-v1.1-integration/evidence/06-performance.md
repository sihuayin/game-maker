# I00-06 性能取证与预算

| 项 | 值 |
| --- | --- |
| 票 | [I00-06 性能取证与预算](../issues/07-i00-06-performance-budget.md) |
| 类型 | I-00 / EVIDENCE |
| 日期 | 2026-11-09 |
| 分支 / HEAD | `wayfinder/level-playability-v1.1-integration` / `330d6dc3919d9f7fa9de05baff9668a4a1177133` |
| Node / 机器 | v22.23.2 / Apple M4 · 10 cores · 16 GiB · darwin arm64 |
| 探针 | [`../scripts/perf-probe.mjs`](../scripts/perf-probe.mjs)，`sha256:4485333e81ee…` |
| P0 模型（只读） | [`../../level-playability-v1.1-p0/prototype/temporal-model.mjs`](../../level-playability-v1.1-p0/prototype/temporal-model.mjs)，`sha256:01788b03db2b…` |
| 语料清单（只读） | [`../../level-playability-v1/corpus/inventory.json`](../../level-playability-v1/corpus/inventory.json)，`sha256:ba1d051a401a…` |
| 命令 | `node --expose-gc .scratch/level-playability-v1.1-integration/scripts/perf-probe.mjs --out .scratch/level-playability-v1.1-integration/evidence/06-perf` |
| 退出码 / 用时 | `0` / 3.68 s（13/13 检查通过） |
| 产品目录修改 | 无（`packages/**`、`fixtures/**`、`docs/**`、P0 目录均未改） |

## 0. 结论速览

1. **真实语料量级远小于 P0 的压力假设**：21 份唯一横向 config / 31 个 hazard / 19 个移动 hazard。按 P0 的 `phaseSteps=200`、`xStep=2`，状态容量 `xPositions × phaseSteps` 的 p50 = **137,800**、max = **177,800**；按分辨率规则取最大合法 `phaseSteps` 后 max = **220,480**。
2. **真正的最坏搜索成本**：在 goal 永久被覆盖（但非永久封锁门）的合成用例上，W=1440 需 137,090 visited / 411,070 edges / **48–50 ms**；W=5760 需 569,090 visited / 1,707,070 edges / **215 ms**。P0 的 `4096 / 12288 / 7–19 ms` 只是「首条 witness 很快找到」的单点，不是预算依据。
3. **状态空间公式**：`stateCapacity = xPositions × phaseSteps`，`xPositions = floor((world.xMax − world.xMin − player.width)/xStep) + 1`（另加 start/goal 特殊点）。宽度扫掠的容量拟合 slope=100、`r²=1.000`。
4. **边数公式**：`edges/state = 2·floor(maxStepPx/xStep) + 1`，`maxStepPx = maxSpeed·periodMs/phaseSteps`。16 个非退化点全部在 **0.46%** 误差内。总边数 ≈ `xPositions × phaseSteps × (2·floor(maxSpeed·periodMs/(phaseSteps·xStep)) + 1)`。
5. **distance 不是成本驱动**：状态容量 slope=0；elapsed 对 distance 的 slope = **−0.00044 ms/px**（`r²=0.0008`），即噪声级。distance 只通过可达区域略微减少边数（20→160 减少 2.5%）。
6. **建议预算**：默认 `maxStates = 500_000`、`timeBudgetMs = 2_000`；契约硬上限 `maxStates = 1_000_000`、`timeBudgetMs = 10_000`。实测每 edge ≈ **0.126 µs**（p50），500k 状态 / 1.5M 边约 0.2–0.3 s、约 55 MiB。
7. **超限策略**：**逐层降级**（只把移动 hazard 这一检查层降为 `INSUFFICIENT_EVIDENCE`，`coverage = partial`），不是整关降级、也不是逐路径部分结果。预算耗尽不得产出 witness / proof；聚合按 [`api.ts:87-92`](../../../packages/contracts/src/playability/api.ts) 落 `INSUFFICIENT_EVIDENCE`。
8. **墙钟边界已验证**：`Date.now()` 只出现在 `analyze`（预算检查 + `elapsedMs`）与 `reconstruct`（展示字段），不进入三角波/碰撞/永久封锁门。行为上：非门输入在 `timeBudgetMs=0/1 ms` 只会在 `SAFE` 与 `IE` 之间切换，**绝不** `PROVEN_UNPLAYABLE`；永久封锁门输入在 `timeBudgetMs=0/1 ms`、`maxStates=0/1` 下仍是 `PROVEN_UNPLAYABLE`。

## 1. 输入、环境与复现

### 1.1 只读输入

| 输入 | SHA-256 |
| --- | --- |
| P0 模型 `temporal-model.mjs` | `01788b03db2bef13de5f9951368760f9cc79ba07effb8680d98c6ee270206d4d` |
| 语料清单 `inventory.json` | `ba1d051a401ac70f45be5a705e2c478961ffc3fc0a6c9feb4cde09365df5f74f` |
| P0 safe A 输入 `cases/a/analyzer-input-lag16.67ms.json` | `29ef9750137307a42332e51ecde7480e4c3b20665bcc498f9c1cfba6674cdbd4` |
| P0 gate B 输入 `cases/b/analyzer-input-lag16.67ms.json` | `74e993a673bbf59713303f5eb66473644da8734f69a7dacf6157d118e7275765` |

语料扫描范围：`inventory.json` 中 `parseOk ∧ format=game-config/v1 ∧ unique by contentHash`。与 P0 的 E3 复扫口径一致（21 configs / 31 hazards / 19 moving / 121 frames）。本票**不重开** P0 的几何审计，只复用其清单数字。

### 1.2 复现

```bash
node --expose-gc .scratch/level-playability-v1.1-integration/scripts/perf-probe.mjs \
  --out .scratch/level-playability-v1.1-integration/evidence/06-perf
```

- 退出码 `0`；`meta.json` 中 `checks` 13/13 `pass`。
- 探针只用 Node 内置模块 + 只读 `import` P0 原型；不写 `package.json`、不装依赖、不接 CI。
- 原始 stdout：[`06-perf/stdout.txt`](06-perf/stdout.txt)；环境与检查项：[`06-perf/meta.json`](06-perf/meta.json)。

### 1.3 产物

| 文件 | 内容 |
| --- | --- |
| [`06-perf/meta.json`](06-perf/meta.json) | 环境、命令、SHA、13 项检查 |
| [`06-perf/corpus.json`](06-perf/corpus.json) | 19 个移动 hazard 的分布、规范状态容量、36 次语料分析 |
| [`06-perf/growth.json`](06-perf/growth.json) | 4 条扫掠（18 个用例）、线性拟合、边数公式验证 |
| [`06-perf/repeats.json`](06-perf/repeats.json) | 3 个输入 × 7 次重复的 elapsed 分布 |
| [`06-perf/budget-boundary.json`](06-perf/budget-boundary.json) | 极端 `timeBudgetMs` / `maxStates` 的三态边界 |
| [`06-perf/stdout.txt`](06-perf/stdout.txt) | 本次运行的 stdout 摘要 |

> 输出 JSON 内含 `at` 时间戳与实际耗时，因此重跑会得到不同 SHA；`meta.json` 中的模型/脚本/清单 SHA 是输入指纹，可跨运行复核。

## 2. 现有语料的真实量级

### 2.1 语料计数与分布

| 维度 | 值 |
| --- | --- |
| 唯一横向 config | 21 |
| hazard 总数 | 31 |
| 含 motion 的 config | 16 |
| 移动 hazard | 19（全部 `axis:"x"`、`kind:"cycle"`） |
| `distance` | min 40 / p50 120 / max 200 |
| `periodMs` | min 2500 / p50 3000 / max 4000 |
| hazard 速度 `2·distance/periodMs` | min 0.027 / p50 0.069 / max 0.138 px/ms |
| world 宽度 | min 640 / p50 1440 / max 1920 |
| `xPositions`（N=200, xStep=2） | min 273 / p50 689 / max 889 |
| 状态容量（N=200） | min 54,600 / p50 **137,800** / max **177,800** |
| 分辨率规则下最大容量 | min 36,855 / p50 111,618 / max **220,480** |

分辨率规则：`phaseSteps ≤ maxSpeed · periodMs / xStep`，否则 `maxStepPx < xStep`，玩家连一个网格步都走不了。见 §2.3。

### 2.2 用真实 config + manifest 跑分析

把每个移动 hazard 单独作为 P0 输入（world 宽高、玩家/ hazard 的 manifest 尺寸与 anchor、`at` 推导盒顶），跑 `lagMs=16.67`、`phaseSteps=200`、`xStep=2`。原速带（config 自带速度，缺省 90 px/s）与 P0 的 160 px/s 各跑一次：

| 分组 | n | 结果 |
| --- | --- | --- |
| 输入门提前退出（永久封锁门但未声明垂直规避） | 8 | `INSUFFICIENT_EVIDENCE / unplayable-proof-requires-vertical-evasion-assumption` |
| 网格可动（`maxStepPx ≥ xStep`） | 14 | `INSUFFICIENT_EVIDENCE / no-witness-found`；elapsed p50 **32 ms**、p90 38.4、max 43 |
| 网格退化（`maxStepPx < xStep`） | 14 | 只有 200 个 states（等待边），elapsed 0 ms |

**重要缺陷（供 I-01 契约）**：在默认玩家速度 90 px/s、`xStep=2`、`phaseSteps=200` 下，`maxStepPx = 90/1000 × periodMs/200 = 1.125–1.8 px < 2`，19 个移动 hazard **全部退化**；只有 P0 手写的 160 px/s 输入才全部合法（19/19）。退化时分析器安全地落 `IE / no-witness-found`，但语义是错的：不是「找不到路」，而是「时间分辨率无法表达一步」。契约必须：

- 显式校验 `maxSpeed · periodMs / phaseSteps ≥ xStep`；
- 不满足时返回专门的 IE reason（例如 `time-resolution-unrepresentable`），而不是 `no-witness-found`；
- 或由契约按 `phaseSteps = floor(maxSpeed·periodMs / xStep)` 推导 N（上限再与 `maxStates` 对齐）。

### 2.3 P0 单点样本的复现

P0 案例 A（W=1408, `xStep=2`, N=200, 160 px/s, lag 16.67 ms）本机重复 7 次：**4096 visited / 12,288 edges**，`elapsedMs` = `[4,2,3,2,2,2,3]`（p50 2、max 4），与 P0 的 7–19 ms 同量级、但更快。它只覆盖「BFS 很快找到首条 witness」的路径；预算不能建立在这个单点上（见 §3 的全搜索）。

## 3. 状态空间与成本的增长曲线

### 3.1 解析模型（本票实测验证）

```text
xPositions   = floor((world.xMax − world.xMin − player.width) / xStep) + 1   (+ start/goal 特殊点)
stateCapacity = xPositions × phaseSteps
dt            = periodMs / phaseSteps
maxStepPx     = maxSpeed × dt = maxSpeed × periodMs / phaseSteps
edges/state   = 2·floor(maxStepPx / xStep) + 1          (内部格；边界更少)
totalEdges    ≈ xPositions × phaseSteps × (2·floor(maxSpeed·periodMs/(phaseSteps·xStep)) + 1)
resolution    : maxSpeed·periodMs / phaseSteps ≥ xStep
```

16 个非退化扫掠点的 `edgesChecked/statesVisited` 与 `2·floor(maxStepPx/xStep)+1` 误差为 **−0.01% ~ −0.46%**（[`growth.json`](06-perf/growth.json) 的 `growth.formula`）。

### 3.2 world 宽度（distance=20, period=4000, N=200, xStep=2, 160 px/s）

| 视觉宽 | xPositions | 状态容量 | visited | edges | elapsed |
| --- | --- | --- | --- | --- | --- |
| 640 | 301 | 60,200 | 57,090 | 171,070 | 21 ms |
| 1440 | 701 | 140,200 | 137,090 | 411,070 | 53 ms |
| 2880 | 1,421 | 284,200 | 281,090 | 843,070 | 100 ms |
| 5760 | 2,861 | 572,200 | 569,090 | 1,707,070 | 215 ms |

拟合：状态容量 slope **100 / px**，`r²=1.000`；edges slope **300 / px**，`r²=1.000`；elapsed slope **0.0376 ms / px**，`r²=0.9989`。**宽度线性**。

### 3.3 hazard distance（W=2880, period=4000, N=200）

| distance | 状态容量 | visited | edges | elapsed |
| --- | --- | --- | --- | --- |
| 20 | 284,200 | 281,090 | 843,070 | 105 ms |
| 40 | 284,200 | 280,080 | 840,040 | 101 ms |
| 80 | 284,200 | 278,040 | 833,920 | 101 ms |
| 160 | 284,200 | 273,960 | 821,680 | 98 ms |

拟合：状态容量 slope **0**（`r²=1.000`）；edges 仅因可达区域被更宽的 hazard 压缩而下降 2.5%；elapsed 在 98–105 ms 内波动，**两次独立运行的 slope 符号相反**（−0.0004 / −0.0395 ms/px），绝对值 < 0.04 ms/px，即 160 px 的 distance 变化对应 < 6.4 ms（< 7%）。**distance 不是成本驱动**——它只改变碰撞剪枝，不改变 `(x, phase)` 状态空间。

### 3.4 periodMs（W=1440, distance=20, N=200）

| periodMs | dt | maxStepPx | 状态容量 | visited | edges | elapsed |
| --- | --- | --- | --- | --- | --- | --- |
| 2000 | 10 | 1.6 | 140,200 | 200 | 200 | 0 ms（退化） |
| 4000 | 20 | 3.2 | 140,200 | 137,090 | 411,070 | 48 ms |
| 8000 | 40 | 6.4 | 140,200 | 137,090 | 958,430 | 100 ms |
| 16000 | 80 | 12.8 | 140,200 | 137,090 | 1,777,970 | 177 ms |
| 32000 | 160 | 25.6 | 140,200 | 137,090 | 3,411,631 | 306 ms |

拟合（排除退化点）：edges slope **105.5 edges / period-ms**，`r²=0.9982`；elapsed slope **0.00899 ms / period-ms**，`r²=0.9930`。**状态容量不随 period 变；边数与耗时随 period 线性增长**（因为每步允许的位移变大）。

### 3.5 phaseSteps / dt（W=1440, period=8000）

| N | dt | maxStepPx | 状态容量 | visited | edges | elapsed |
| --- | --- | --- | --- | --- | --- | --- |
| 50 | 160 | 25.6 | 35,050 | 34,270 | 852,845 | 77 ms |
| 100 | 80 | 12.8 | 70,100 | 68,540 | 888,920 | 90 ms |
| 200 | 40 | 6.4 | 140,200 | 137,090 | 958,430 | 101 ms |
| 400 | 20 | 3.2 | 280,400 | 274,190 | 822,170 | 98 ms |
| 800 | 10 | 1.6 | 560,800 | 800 | 800 | 0 ms（退化） |

拟合（排除退化点）：**状态容量 slope 701 / phase step，`r²=1.000`；耗时在 77–101 ms 平台**。原因：`maxStepPx` 与 N 成反比，`edges/state` 同步下降，总边数近似恒定；但 visited 数组与 BFS 队列随 N 线性增长。**结论：N 的成本首先是内存（状态容量），不是时间。** 因此 `maxStates` 是主约束，`timeBudgetMs` 是看门狗。

### 3.6 峰值与每 edge 成本

- 最大实测：569,090 visited / 1,707,070 edges / **215 ms**，`heapΔ ≈ 61.4 MiB`（GC 前置、非精确峰值，仅供量级参考；约 **113 B/state**，含队列对象与垃圾）。
- 每 edge：p50 **0.126 µs**、p90 0.573 µs、max 3.01 µs（小样本受 JIT/固定开销影响）；大样本稳态 0.09–0.13 µs。

## 4. 重复运行与方差

同一输入连续跑 7 次（`--expose-gc`，每次前置 GC）：

| 输入 | visited / edges | elapsedMs（全部 7 次） | warm（去掉首跑） | 结论 |
| --- | --- | --- | --- | --- |
| safe A（W=1408, N=200） | 4,096 / 12,288 | `[4,3,2,2,2,2,3]`，p50 2、max 4 | p50 2、max 3 | verdict 恒 `NO_PROVEN_BLOCKER` |
| 全搜索 W=1440 | 137,090 / 411,070 | `[50,49,48,50,48,48,48]`，p50 48、max 50 | p50 48、max 50 | verdict 恒 `INSUFFICIENT_EVIDENCE` |
| 全搜索 W=2880 | 281,090 / 843,070 | `[102,101,101,102,104,100,102]`，p50 101、max 104 | p50 101.5、max 104 | verdict 恒 `INSUFFICIENT_EVIDENCE` |

- **计数与结论完全稳定**：同一输入的 `statesVisited` / `edgesChecked` / `verdict` / `reason` 在 7 次中逐项相同；只有 `elapsedMs` 在 ±8% 内波动（首跑有 JIT 预热，safe A 首跑 4 ms vs warm 2 ms）。
- 这直接支撑 §7 的「墙钟不影响结论」：结论与计数是输入的函数，耗时不是。

## 5. 预算建议

### 5.1 建议值

| 项 | 默认 | 契约硬上限 | 依据 |
| --- | --- | --- | --- |
| `maxStates` | **500,000** | **1,000,000** | 语料分辨率合法最大容量 220,480；500k 留 2.3×；1M 对应约 110 MiB / 0.45 s，超过即拒绝 |
| `timeBudgetMs` | **2,000** | **10,000** | 569k 状态 / 1.7M 边的实测 215 ms；2 s 留约 9×，覆盖慢 CI；10 s 是离线批量审计的上限 |
| `phaseSteps` | 由分辨率规则推导，`≤ maxSpeed·periodMs/xStep` | 同左 | 固定 200 在 90 px/s 下 19/19 退化（§2.2） |
| `xStep` | 2（沿用 P0） | 不建议增大 | 增大 xStep 会降低覆盖，不是性能旋钮 |

补充：

- `maxStates` 与 `timeBudgetMs` 都必须**校验为有限非负整数**。P0 目前对 `maxStates=0` / 负 `timeBudgetMs` 不报错（会立即 IE）；契约应显式拒绝非法值，而不是把「0」解释成「最小预算」。
- 500k 是**状态容量**上限，不是 visited 上限；实测全搜索 visited ≈ 0.98×容量，两者近似相等，用容量做预算更保守。
- 如果 I-01 最终固定 `phaseSteps=200` 且不推导 N，则 `maxStates=250,000` 已足够覆盖当前语料（177,800 × 1.4）；但该配置在默认 90 px/s 下不可用，所以不建议保留「固定 200」这一前提。

### 5.2 应写在契约的哪一层

**写在可玩性机制层的模块常量里，并以只读常量导出；不写进 `GameConfig`、不写进 `FixedRuntimeProfile`、不新增公开参数。**

| 层 | 位置 | 结论 |
| --- | --- | --- |
| 作者输入 | `GameConfig` / schema | **不放**。预算不是关卡作者能自选的属性；写进 config 会让「作者调大预算」绕过审计 |
| Runtime 剖面 | `packages/contracts/src/playability/profile.ts` | **不放**。`FixedRuntimeProfile` 是碰撞几何 / lag / solid motion 等 Runtime 事实，不是搜索资源 |
| 机制层 | `packages/contracts/src/playability/mechanic.ts`（或 I-01 新建的 temporal 模块） | **放这里**。与 [`completion.ts:68,70`](../../../packages/contracts/src/playability/completion.ts) 的 `MAX_COLLECTIBLES` / `EDGE_BUDGET` 同一模式：模块级冻结常量 + 注释说明「超限 ⇒ IE，不是超时/随机失败」 |
| 供测试/证据读取 | 同模块 `export const MOVING_HAZARD_LIMITS = {...}` | 与 [`mechanic.ts:281-284`](../../../packages/contracts/src/playability/mechanic.ts) 的 `MECHANIC_LIMITS` 同模式，便于证据脚本读取而不落盘 |
| 内部分析器输入 | P0 的 `options.limits` | 保留为**测试/证据 seam**，不是生产公共契约；生产 `auditPlayability(config, manifest, profile?)` 不加参数 |

理由：预算超限的语义是「这一层看得不够全」，属于层内证据强度，不是关卡属性，也不是 Runtime 事实。放在机制层模块常量里，才能同时满足「可审计」「不可被调用方静默放宽」「与既有 `EDGE_BUDGET` 一致」。

## 6. 超限策略

### 6.1 逐层降级，不是整体降级

| 方案 | 结论 | 理由 |
| --- | --- | --- |
| 整体降级（整关 IE） | 不采用 | 会丢弃 spatial / completion 已经确定的结果；预算只影响移动 hazard 搜索 |
| **逐层降级（推荐）** | **采用** | 只把移动 hazard 这一检查层降为 `INSUFFICIENT_EVIDENCE / search-budget-exhausted`；其他层保持各自 verdict；聚合按 [`api.ts:87-92`](../../../packages/contracts/src/playability/api.ts) 的「任一层 IE ⇒ 整关 IE」落 IE |
| 逐路径部分结果 | 不采用 | 部分 BFS 既不能产 witness，也不能产 proof（见下）；放行只会污染证据 |

### 6.2 coverage 与部分结果

- 预算耗尽时，受影响层的 `coverage` 必须是 **`partial`**，不能留 `checked`。否则调用方会把「IE + checked」读成「看全了、没找到阻断」——正是 I00-01 已记录的 `partial` 不参与聚合的缺口。是否把 mechanic 层拆成「静止 hazard / 移动 hazard」两个子 coverage，由 I00-01 / R1 裁。
- **不允许部分结果进入 evidence**：`witness` / `proof` 必须缺席。理由：
  - `PROVEN_UNPLAYABLE` 只允许来自永久封锁门，而该证明在搜索之前、O(1)、不读预算（§7 已实测）；部分 BFS 永远没有资格判不可玩。
  - `NO_PROVEN_BLOCKER` 需要一条到达 goal 的 witness；部分 BFS 没有到达 goal，也就没有 witness。
  - 因此「部分结果」在语义上只能是 `INSUFFICIENT_EVIDENCE`，附带 `stats` 作诊断（visited / edges / 耗尽原因），但不是证据。
- 预算耗尽是**单向降级**：`SAFE → IE`。它不可能把 `UNPLAYABLE` 变成 `IE`，也不可能把 `IE` 变成 `SAFE`。

## 7. 墙钟的边界：「墙钟不影响结论」的验证

### 7.1 结构证据（E1）

[`temporal-model.mjs`](../../level-playability-v1.1-p0/prototype/temporal-model.mjs) 中 `Date.now()` 的全部出现位置：

| 行 | 函数 | 用途 |
| --- | --- | --- |
| 320 | `reconstruct` | `witness.elapsedMs`（展示字段） |
| 329 | `analyze` | `startedAt` |
| 355 / 388 / 412 / 449 | `analyze` | 写入 `stats.elapsedMs` |
| 431 | `analyze` | 预算检查：`Date.now() - startedAt > limits.timeBudgetMs` |

- **没有** `Date.now()` / `performance.now()` / `Math.random()` 出现在 `trianglePosition`、`segmentCollides`、`positiveInterval`、`pointCollides`、`hazardPositionRange`、`provePermanentGate`。
- 探针 `meta.json` 的 `wall-clock-only-budget-or-reporting` 检查通过；`noRandomness` 通过。

### 7.2 行为证据（E3）

同一输入只改预算：

| 输入 | 预算 | 结果 |
| --- | --- | --- |
| safe A | `timeBudgetMs = 0 / 1` | `INSUFFICIENT_EVIDENCE / search-budget-exhausted` |
| safe A | `timeBudgetMs = 2 / 5 / 10 / 25 / 100 / 250 / 1000 / 5000` | `NO_PROVEN_BLOCKER / witness-found` |
| gate B（永久封锁门） | `timeBudgetMs = 0 / 1 / 1000` | **`PROVEN_UNPLAYABLE / permanent-gate`（不变）** |
| gate B | `maxStates = 0 / 1 / 200000` | **`PROVEN_UNPLAYABLE / permanent-gate`（不变）** |
| safe A | `maxStates = 0 / 1 / 100 / 1000 / 4096` | `INSUFFICIENT_EVIDENCE / search-budget-exhausted` |
| safe A | `maxStates = 5000 / 200000` | `NO_PROVEN_BLOCKER / witness-found` |
| 全搜索 W=2880 | `timeBudgetMs = 1` | `INSUFFICIENT_EVIDENCE / search-budget-exhausted` |
| 全搜索 W=2880 | `timeBudgetMs = 1000 / 60000` | `INSUFFICIENT_EVIDENCE / no-witness-found` |

### 7.3 两个必须写进 I-01 测试的不变量

1. **静态**：几何/碰撞/证明函数不得出现 `Date.now` / `performance.now` / `Math.random`；`Date.now` 只允许在 `analyze` 的预算检查、`elapsedMs` 写入与 `reconstruct` 的展示字段。
2. **动态**：对任意非门输入，`timeBudgetMs ∈ {0,1}` 与 `maxStates ∈ {0,1}` 下的 verdict ∈ `{SAFE, INSUFFICIENT_EVIDENCE}`，且绝不为 `PROVEN_UNPLAYABLE`；对永久封锁门输入，所有极端预算下 verdict 恒为 `PROVEN_UNPLAYABLE`。

### 7.4 预算检查的粒度

P0 只在 `statesVisited & 1023 == 0` 时检查时间（行 431）。因此：

- 时间预算的最坏超时 ≈ 1,024 states × `edges/state`；在 25 edges/state 的最粗网格下 ≈ 26k edges ≈ **3.3 ms**（0.126 µs/edge）。远小于 2 s 默认预算。
- 小预算不可作为语义边界：本机两次运行中 safe A 的翻转点在 `2 ms` 与 `5 ms` 之间漂移。**`timeBudgetMs` 是看门狗，`maxStates` 才是确定性的预算边界。** 这也意味着契约不应把「刚好在预算内找到 witness」当作可复现证据；证据必须记录 `budgetExceeded=false` 与 counts。

## 8. 与 P0 `4096 / 12288 / 7–19 ms` 的关系

- 该样本是 P0 案例 A 的**首条 witness** 路径：`xPositions=689`、`phaseSteps=200`、`maxStepPx=3.2`，只访问了 4,096 个状态就到达 goal。本机复现为 2–4 ms，说明它是「快的路径」，不是「最坏路径」。
- 同一个 W=1440 的**全搜索**（goal 不可达）是 137,090 visited / 411,070 edges / 48–50 ms，约为该单点的 **33× 状态、33× 边、12–25× 时间**。
- 因此预算必须按 `stateCapacity` 与 `totalEdges` 推导（§3.1），不能按 P0 的单点样本；P0 的 `maxStates=200,000 / timeBudgetMs=5,000` 作为原型默认值可以保留，但生产契约应采用 §5 的值与分辨率规则。

## 9. 限制与未覆盖

- 单机测量（Apple M4 / Node 22.23.2）；CI 机器可能慢 2–5×，§5 的 2 s 默认已按约 9× 余量预留，但未在 CI 硬件上实测。
- 语料运行是「真实 GameConfig + manifest 几何 → P0 分析器输入」的合成输入，不是 Runtime playtest；耗时不包含 manifest 解析、建图或产物 I/O。
- 合成最坏用例把 goal 永久放在 hazard 覆盖区内但不构成永久封锁门，用于计时全搜索；它不代表真实关卡的 verdict 分布。
- 内存数字是 GC 前置 + 运行后读取的 `heapUsed` 差值，包含未回收垃圾，只能当量级参考（约 115 B/state）。
- 未覆盖多 hazard、y 轴、跳跃/垂直规避、moving platform；这些在 P0 与 I-00 范围内都属于 IE。
- 未验证 `phaseSteps` 变化对**数值正确性**的影响（I00-05 的范围）；本票只测成本与退化阈值。

## 10. 本票未修改声明

- 未修改 `packages/**`、`fixtures/**`、`docs/**`、`.scratch/level-playability-v1.1-p0/**`、其他票或 `map.md`。
- 未修改 `package.json`，未安装依赖，未接入 CI，零付费。
- 仅新增/修改本 effort 的 `scripts/perf-probe.mjs`、`evidence/06-performance.md`、`evidence/06-perf/**`。
