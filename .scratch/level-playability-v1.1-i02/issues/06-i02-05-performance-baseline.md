# I02-05 性能与预算基线采集

Type: task
Status: resolved
Owner: claude (wayfinder session 2026-11-11)
Blocked by: 02
Map: ../map.md
Class: I-02 / EVIDENCE

## Question

在现有语料上采集 I-02 算法形态的性能基线，为预算终值与停止条件提供证据；**不得把 scratch 结果表述为生产验收。**

### 必须完成

1. 复用 `.scratch/level-playability-v1/corpus/inventory.json`（21 configs / 19 moving）与 I-00 的 `perf-probe.mjs` 口径。
2. 明确被测算法：若 I-02 的连续时间模型尚未实现，用 P0 模型 + 明确的差异注记；不得把 P0 数字冒充 I-02 数字。
3. 采集：
   - 状态容量 `xPositions × phaseSteps` 的 p50 / max；
   - visited / edges / elapsed 的分布；
   - 合成最坏用例（W=1440 / 5760，goal 永久被覆盖但非永久封锁门）。
4. 与 I-00 建议值 `maxStates=500_000`、`timeBudgetMs=2_000`（硬上限 1M / 10s）比较；给出「够 / 不够 / 需要缩范围」的判断依据。
5. 重复运行与墙钟方差；区分确定性状态预算与墙钟超时。
6. 记录环境、命令、输入 SHA、是否修改产品目录（必须为否）。

### 输出

- `experiments/05-performance/`：脚本、原始 JSON、摘要。
- `evidence/05-performance.md`：命令、环境、结果、限制、对预算的建议（不是裁定）。

### 下游

I02-D5。

## Answer

**结论：P0 代理的基线已采集。** 12/12 条断言通过（退出码 0）。**所有数字是 P0 冻结模型的代理，不是 I-02 实现。**

### 1. 语料（I-00 口径）

21 个唯一 config、31 个 hazard、16 个含运动、**19 个 x 轴运动 hazard**、0 个非 x 轴。状态容量（`xPositions × 200`，`xStep=2`）：**p50 `137,800`，max `177,800`**（min 54,600）。

有效性：18 个可用行 × 2 档速度 = 36 次运行；4 次在输入门返回（永久门 + 未声明垂直规避），18 次在配置速度下网格不可移动（`maxStepPx < xStep`，visited=200），**14 次有效**（0.16 px/ms）。有效样本：wall p50 `32.8ms` / max `42.3ms`；visited p50 `86,400` / max `119,130`；edges p50 `259,000` / max `357,190`。

### 2. 合成最坏用例

| 用例 | 容量 | visited | edges | wallMs |
| --- | --- | --- | --- | --- |
| E1440 | 140,200 | 137,090 | 411,070 | 50.7 |
| E5760 | **572,200** | 569,090 | 1,707,070 | 216.7 |

### 3. 与预算比较（判断依据）

- 建议 `500k / 2s`：语料**够**（容量 2.81×、墙钟 9.23× 余量）；E1440 够；**E5760 状态预算不够**（572,200 > 500k，1.14×）。
- 硬上限 `1M / 10s`：E5760 够（0.57×）；墙钟 46× 余量。
- **绑定约束是状态数，不是墙钟**。若支持 `W≈5760`，默认 `maxStates` 至少要 ~600k；若选择“超宽世界直接 IE”，`500k` 可保留，但授权包须写清适用范围。

### 4. 重复、方差、两类停止

- 状态计数确定：E1440 五次 `visited=137,090 / edges=411,070`；E5760 五次 `visited=569,090 / edges=1,707,070`；跨进程状态签名一致（`1e2e2dd8…`）。
- 墙钟方差：E1440 sd ≈ 1.9ms；E5760 sd ≈ 0.8ms（同机同进程）。
- 状态预算停止：`maxStates=500k` ⇒ `visited=499,801`，`budgetExceeded=true`，`reason=search-budget-exhausted`。
- 墙钟停止：`timeBudgetMs=5` ⇒ `visited=9,216–15,360`（3 个不同值，sd ≈ 2,670），**同一个 reason**。
- ⇒ P0 把两类预算耗尽合并成一个 reason；I-02 的降级口径必须能区分（D5/D9）。

### 5. 二级代理：移动图脚点 × 相位（D3 未定）

11/16 个含运动 config 能建图（5 个旧 schema/manifest 失败）。容量 `standable×200`：p50 `288,200`、max `384,200`（约 x 网格的 2 倍）。现有语料仍 < 500k（0.77×），但 `W=5760` 平地图外推 `5761×200 = 1,152,200`，**超过 1M 硬上限**。若 D3 选图形态，预算与搜索空间必须一起裁定。

### 6. 事实输入（供 D5，不构成裁定）

- F1 语料容量 p50/max：137,800 / 177,800。
- F2 `500k` 覆盖语料与 E1440，不覆盖 E5760；`1M` 覆盖。
- F3 `2s` 墙钟有 ~9× 余量；状态数是绑定约束。
- F4 状态计数确定；墙钟超时的 visited 不稳定。
- F5 两类预算停止目前同一 reason，I-02 需可区分口径。
- F6 图形态容量约 2×，`W=5760` 外推 ≈1.15M，`1M` 不够。
- F7 备选：`500k` + 超宽 IE；按宽度缩放 `maxStates`；或相位上限与 `maxStates` 联定。

### 产出

[`experiments/05-performance/`](../experiments/05-performance/)（`core.mjs`、`build-inputs.mjs`、`run.mjs`、`inputs/cases.json`、`outputs/run.json`、`outputs/stdout.txt`）；
证据 [`evidence/05-performance.md`](../evidence/05-performance.md)（`inputs/cases.json` `sha256:bd4333e1…`，状态签名 `1e2e2dd8…`）。

### 限制

P0 代理，无 I-02 连续时间单边代价 / 两档 lag / Witness / hop 搜索；固定 `xStep=2`、`phaseSteps=200`（未用 I-00 §6.5 自适应 N）；4 次输入门返回、18 次退化不计入搜索成本；图形态只覆盖 11/16 config；墙钟为 Apple M4 单机数据；未改任何产品文件。
