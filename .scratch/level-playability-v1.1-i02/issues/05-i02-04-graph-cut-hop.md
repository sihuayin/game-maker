# I02-04 图割与 hop 加倍可行性实验

Type: task
Status: resolved
Owner: claude (wayfinder session 2026-11-11)
Blocked by: 02
Map: ../map.md
Class: I-02 / EVIDENCE

## Question

在**不改产品代码**的前提下，验证 V1 移动图上的 `forbiddenBoxes` 语义、门区注入、以及 `hopSamples` 取整导致的假 PU 风险，量化 hop 加倍不变性。

### 必须完成

1. 用代表性 config 构建 `buildMovementGraph`；按玩家盒外扩门区矩形，经 `forbiddenBoxes` 注入。
2. 核对 `forbidden` 在 `reach.ts` 与 `hopSamples` 路径上的语义：不可穿越、不提供支撑；世界外按自由空间处理。
3. 复现负例：
   - N1 门上方有可站立平台，玩家可踩平台绕过；
   - N2 门下方有坑，玩家可下落绕行；
   - N7 `hopSamples` 取整导致图断开，加倍采样后连通。
4. 量化 `hopSamples` 的 `n` 加倍对连通性的影响：哪些 config / 几何会改变结论；给出具体数据。
5. 评估参数化选项：在不改 `graph.ts` 的前提下能否在 scratch 中模拟「可选 `hopSamples` 上限」；若必须改 `graph.ts`，写出最小加法式改动与授权影响（只提议，不改）。
6. 记录门区判侧、起点/终点脚点、地形与边界条件。

### 输出

- `experiments/04-graph-cut/`：脚本、输入、原始输出。
- `evidence/04-graph-cut-hop.md`：命令、环境、结果、限制、复现方法。

### 下游

I02-D4、I02-D8。

## Answer

**结论：图割与 hop 加倍实验可行。** 35/35 条断言通过（退出码 0）。

### 1. `forbiddenBoxes` 语义（成立）

门区 `{700,210,40,60}` 的外扩矩形实测 `{x0:685,x1:755,y0:211,y1:270}`，与 `graph.ts:127-135` 手算一致：

- `freeAt(700,250)=false`、`forbidden=1`、`blocked=0` ⇒ **不可穿越、不提供支撑**；
- hazard 顶 `standableAt(700,210)=false`；
- `movementNeighbors(684,250)` 无进入 685 的边；
- `hopSamples(690,250→750,250)=null`（弧线穿禁区）；
- 世界外：栅格 `freeAt(-1,50)=false`；抛物线采样跳过界外点（小世界探针 17 个界外点，边仍接受；若把界外当禁区则拒绝），与 `reach.ts:199` 一致。

### 2. 垂直绕过（N1 / N2）

- **N1 门上方平台**：平坦地形目标不可达；加平台（顶 `y=210`）后目标可达（60/120Hz 一致）。水平门区**不是** PU 的充分条件。
- **N2 门下坑道**：平坦地形不可达；加坑（底 `y=260`，与门底 `y=212` 严格相切）后目标可达（60/120Hz 一致）。

⇒ PU 必须证明**整图割**，不能只看地面走廊。

### 3. hop 采样加倍（量化）

`n = max(6, min(120, ceil(t·60)))`；本世界 `t ≤ 0.78s` ⇒ `n ≤ 47`，**120 上限从不触发**。旋钮必须是采样率（60→120Hz），不是上限。

- **边级**（100,000 次定向扫描）：95 次 forward（粗接受→密拒绝），**4 次 reverse**（粗拒绝→密接受）。
- **图级**（4,000 同高 + 4,000 变高）：
  - forward（连通→断连）5 + 32 = **37**；
  - reverse（断连→连通）= **0**；
  - 其余为两档同结论。
- **N7b 图级正向翻转（真实图 + 完整 BFS）**：60Hz 跨沟边 4 条、右侧 161 格、目标可达；120Hz 跨沟边 0 条、右侧 0 格、目标不可达；无禁区对照两档均 792 格可达。
- **N7a 边级反向翻转**：`(620,250)→(673,231)` 60Hz 拒绝、120Hz 接受；但图级仍有 21–22 条其它跨沟边，目标两档都可达 ⇒ **单边翻转不必然转化为图翻转**，这是图级 reverse 为 0 的原因（冗余弧）。

### 4. 对 I-00 §7.2 的事实输入

方向不对称：更密采样以删边为主（图级 37/8,000），加边罕见（边级 4/100,000，图级 0/8,000）。因此“hop 加倍不变性”是**单向护栏**：必须两档都跑并比较；只跑密档会高估不可达（N7b 即反例），只跑粗档会高估可达。PU 应在更粗采样上成立，Witness 应在更密采样上验证——是否把这条不对称性写成规则，归 D4/D8。

### 5. 参数化（只提议，未改代码）

- **不改产品即可执行检查**：scratch `hopSamplesN` 默认 `{hz:60,maxSamples:120}` 与产品逐点一致（基线 1,441 格完全相同），可模拟任意倍率。
- **若进产品**：给 `hopSamples` / `hopEdges` / `hopTargets` 加向后兼容的尾参 `HopSampling = {hz?, maxSamples?}`，默认保持现行为。但 `graph.ts` 的 hop 参数化在 I-00 “需单独裁定”名单，且导出函数签名触及“公共接口”审批边界 ⇒ 授权形态由 **D4/D6** 裁定。
- **备选**：I-02 自建证明专用采样器；代价是复制跳跃弧（`graph.ts:229-231` 明确警告漂移），且 `reach.ts:155` 的 mid-air 扫描也硬编码 60Hz。

### 6. 事实输入（供 D4 / D8）

- F1 `forbiddenBoxes` 语义成立；世界外只在采样/覆盖扫描中自由。
- F2 水平门区可被上方平台或下方坑道绕过；PU 需整图割。
- F3 hop 加倍可改变图级连通性；实测以“连通→断连”为主，图级反向 0/8,000。
- F4 不变性检查必须两档比较，不能只跑一档。
- F5 当前世界的采样上限从不触发；参数化旋钮应是采样率。
- F6 外部模拟可行且与产品逐点一致。

### 产出

[`experiments/04-graph-cut/`](../experiments/04-graph-cut/)（`core.mjs`、`build-inputs.mjs`、`run.mjs`、`inputs/cases.json`、`outputs/run.json`、`outputs/stdout.txt`）；
证据 [`evidence/04-graph-cut-hop.md`](../evidence/04-graph-cut-hop.md)（`inputs/cases.json` `sha256:6937b847…`，`outputs/run.json` `sha256:591c40a3…`）。

### 限制

单夹具玩家/移动参数；只测 60→120Hz；图级扫描用“任一跨沟 hop 接受”代理（两个具体翻转已用完整 BFS 复核）；未覆盖真实 moving hazard 时序；未改任何产品文件（`git status --porcelain` 与开工前一致）。
