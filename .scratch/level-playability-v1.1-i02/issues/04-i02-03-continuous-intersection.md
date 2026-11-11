# I02-03 连续时间求交可行性实验

Type: task
Status: resolved
Owner: claude (wayfinder session 2026-11-11)
Blocked by: 02
Map: ../map.md
Class: I-02 / EVIDENCE

## Question

用 scratch 原型验证「三角波运动 + AABB 连续时间解析求交」的数学与数值稳定性，产出可复核证据。**不写生产代码，不做生产验收声明。**

### 必须完成

1. 形式化三角波：`t=0` 在 `at`；`periodMs` 为往返整周期；折返点 `periodMs/2`；两端不停留；位置与速度的分段表达。
2. 解析求交：玩家线段（线性）对运动 Hazard 盒（分段线性）；在折返点切段；用 `overlapsStrict` 语义（贴着不算撞）；给出闭式区间判定。
3. 边界用例：严格重叠、边界相切、零面积接触、周期起点/终点、折返点、负时间、非有限数值、速度相同或接近、极短安全窗口、极短通道、临界门宽。
4. `epsilon` 用 I-00 冻结值 `ε = max(1e-9, 1e-9 × (xMax − xMin))`；报告中说明容差如何影响判定。
5. 采样陷阱反例：端点采样安全、区间内碰撞；证明解析判定能抓到。
6. 重复运行确定性：同一输入多次运行，结果一致。
7. 与 P0 `temporal-model.mjs` 的 `segmentCollides` 做差异复核：P0 是 1D x-only；I-02 需要 AABB + y 区间。

### 输出

- `experiments/03-continuous-intersection/`：脚本、输入、原始输出。
- `evidence/03-continuous-intersection.md`：命令、环境、输入 SHA、结果摘要、限制、复现方法。

### 下游

I02-D1、I02-D3。

## Answer

**结论：连续时间解析求交可行。** scratch 原型在 123/123 条断言上给出确定结果（退出码 0），
覆盖严格重叠、相切、零面积、周期/折返点、负时间、非有限值、同速/近零相对速度、极短碰撞窗口、
极短安全窗口、极短通道与临界门宽。

### 产出

- 原型：[`experiments/03-continuous-intersection/core.mjs`](../experiments/03-continuous-intersection/core.mjs)
- 输入（确定性生成）：[`inputs/cases.json`](../experiments/03-continuous-intersection/inputs/cases.json)（`sha256:e1e922ba…`）
- 原始输出：[`outputs/run.json`](../experiments/03-continuous-intersection/outputs/run.json)（`sha256:34ac2d55…`）、`outputs/stdout.txt`
- 证据：[`evidence/03-continuous-intersection.md`](../evidence/03-continuous-intersection.md)

### 形式化结果

1. **三角波**：`p(t) = at + distance·k(((t mod P)+P) mod P / P)`，`k(u)=2u`（`u<1/2`）、`2−2u`（`u≥1/2`）；速度 `±2·distance/P`；`p(−t)=p(t)`；`t=0` 在 `at`，折返点 `P/2`，两端不停留。
2. **解析求交**：在 `{t0,t1} ∪ {kP/2}` 切段；每段内两个线性不等式 `c0 + c1·u > 0` 求开区间并求交；`c1 === 0` 用精确判定，不设绝对斜率容差。单段内碰撞集是一个开区间，跨折返点需合并。
3. **边界语义**：贴边/角接触/零面积/折返点相切全部不撞；`1e-12` 正面积重叠算撞；同速同向相切不撞；折返点两侧都撞但该点相切时，安全“窗口”宽度为 0（可表示）。
4. **极短窗口**：`2e-10 ms` 的碰撞窗口被解析解找到；`1.005e-6 ms` 的安全窗口被保留。
5. **采样陷阱**：5ms 窗口在 2/6/11 点采样下全漏；`2e-10 ms` 窗口在 16.67ms 帧采样下全漏。
6. **ε**：`ε = max(1e-9, 1e-9·span)` 实测为 `1e-9 / 2e-7 / 2e-6 / 1`（span `1/200/2000/1e9`）。ε 用作**门宽**阈值不改变碰撞语义；用作**碰撞区间宽度**阈值会改变语义（短窗口被判安全）。同一门宽在世界 span 10× 时判定翻转。
7. **确定性**：同进程重复、两个独立进程重复，`run.json` SHA-256 完全一致（`34ac2d55…`），stdout 逐字节相同。

### 与 P0 的差异（已量化，可复现）

P0 与精确语义在 2000 例常规随机参数上 **0 分歧**；差异集中在 6 处近临界行为：
`y` 判据 `±EPS` 收缩（X2）、`|c1|<1e-9` 绝对钳位（X3）、`hi−lo>1e-9` 区间阈值（X1）、
端点附近跳过切点（`:191`）、`dt=0` 分支与区间分支谓词不一致（X4）、lag 对称 pad 是保守超集（X5）。
用这 6 个开关复现 P0，2000/2000 一致。**I-02 不能“照抄 P0 再加 y”**。

### 对下游的事实输入（裁定仍归 D2/D3/D6）

- F1 闭式解存在，代价 O(切点数)，无迭代/采样/搜索。
- F2 严格相切语义可在连续时间上精确表达。
- F3 单段碰撞集是一个开区间；跨折返点必须合并。
- F4 任意小的正安全窗口与零测度安全点都可表示。
- F5 ε 的“门宽”用法与“区间宽度”用法语义不同，须显式二选一。
- F6 `lagMs` 的 ∃δ 语义是方向性的；P0 对称 pad 是保守超集；精确 ∃δ 的连续求解需要额外切点/交点，本原型只提供逐点可达区间。
- F7 `|x| ~ 1e9` 时 `1e-9` 重叠不可表示；实现应在局部坐标帧计算。
- F8 P0 的 6 处差异必须逐条处理。

### 限制

单 Hazard、x 轴、y 固定；只验证几何谓词，不产生 Verdict；不涉及 Atlas/hitbox 信任链；
`lagMode:"exact"` 未接入连续求解器；未新增 fixture pack；未修改任何产品文件
（`git status --porcelain` 与开工前一致）。
