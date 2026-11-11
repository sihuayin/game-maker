# I02-D5 预算、确定性与降级裁定

Type: grilling
Status: resolved
Owner: claude + user (wayfinder grilling session 2026-11-11)
Blocked by: 06
Map: ../map.md
Class: I-02 / DECISION

## Question

冻结搜索预算、确定性与降级边界。I-02 需求 I02-05 同时要求「墙钟时间必须受限」与「相同输入、相同配置必须产生确定性结果」；两者需要一套不互相拆台的规则。

### 必须裁定

1. **状态计量**：什么算一个 state / edge / check；状态去重键；网格与相位的计数口径。
2. **墙钟 vs 确定性**：
   - 墙钟超时是否只允许单向 `SAFE → IE`；
   - 是否设置确定性检查点（每 N 个状态检查一次墙钟）；
   - 确定性测试在什么条件下进行（关闭墙钟 / 使用状态预算）；
   - 墙钟超时是否记录为降级原因。
3. **预算终值**：`maxStates` / `timeBudgetMs` 默认值与硬上限；是否维持 I-00 的 500k / 2s（硬 1M / 10s）；依据 05 的语料证据。
4. **禁止**：静默扩大预算、自动重试、切换算法绕过硬上限；部分结果不得提升。
5. **降级优先级**：非法 lag > 信任链失败 > 模型外输入 > 网格不可行 > 预算超限 > 无 witness；两档不一致的位置。
6. **网格约束**：`N ≥ 2`、`N ≤ floor(maxSpeed × periodMs / xStep)`；不满足 ⇒ IE，不静默截断。
7. **确定性实现纪律**：稳定排序、去重、浮点比较、hop 取整、BFS 顺序。
8. **诊断字段**：预算超限、网格不可行、无 witness 的内部原因码（不新增公共 code）。

### 产出

票内 `## Answer`：预算表、确定性规则、降级矩阵。

### 下游

I02-D6、I02-D7、I02-D9、I02-AUTH。

## 相关证据

- [I02-03 连续时间求交可行性实验](../evidence/03-continuous-intersection.md)：求交代价为 O(切点数)，切点数 `≈ 2·span/periodMs`（F1）；解析求交的确定性已在同进程/跨进程复跑中验证（`run.json` SHA 一致）。预算的最终数值仍由本票裁定。

## 相关证据

- [I02-05 性能与预算基线采集](../evidence/05-performance.md)：语料容量 p50/max、`500k / 2s` 的余量与缺口（E5760 超 500k）、状态预算与墙钟超时的可区分性、图形态容量的 2× 耦合。最终数值仍由本票裁定。

## Answer

用户 2026-11-11 逐题裁定。Q1、Q2、Q4、Q6、Q8、Q9 接受；**Q3、Q5、Q7、Q10 接受主体方案，并按用户修正补齐预算语义**。**修改产品目录：否**（仅本票、地图、`CONTEXT.md`、冲突登记、下游票尾）。

> **本轮最重要的修正**：当前只有 `maxCutsPerCheck`（单次求交上限），没有**累计 cut 预算**；这会与 Q1「工作预算是唯一语义预算」冲突。新增 `maxCutsPerBranch`（U2 每档 lag 累计，U9 / W 共用），其默认值与硬上限由独立 scratch 基准票 [I02-D5B](21-i02-d5b-cut-budget-benchmark.md) 确定。
> 在该值冻结前：U1 可以验收单次 `maxCutsPerCheck`；**U2 不得声称已有完整的确定性工作预算**；D9 / AUTH 不得签署 U1–U2 的完整预算验收。

### 0. 裁定总览

| 题 | 裁定 | 冻结要点 |
| --- | --- | --- |
| Q1 | A | 工作预算是唯一语义预算；墙钟 abort-only；`wallClockMs` 不进 `determinismSignature`。 |
| Q2 | A + 补充 | U9 工作计入 NB 共用计数器；区分 `statesEnqueued` / `statesVisited`；U2/U4 独立。 |
| Q3 | 有条件接受 | 保留 500k/2s、1M/10s；新增 `maxCutsPerBranch`（数值待 D5B）；`maxEdges` 防溢出。 |
| Q4 | A | `N = min(N_max, floor(maxStates/xPositions))`；`N≥2`；`stateCapacity` 是完整空间上界。 |
| Q5 | A + 修正 | 检查点改为 `timeBudgetCheckpointWork = 1024` 工作单元；总上界 8s / 40s。 |
| Q6 | A | 禁止扩预算 / 重试 / 换算法绕限；U9 失败不给 W 新预算。 |
| Q7 | A + 修正 | 双档「不完整」与「不一致」分开；发布门不覆盖内部结果。 |
| Q8 | A | `xStep=1`；容量约束；禁止静默降级 xStep/N。 |
| Q9 | A + 补充 | 所有影响策略选择的遍历/候选顺序都必须确定性排序。 |
| Q10 | A + 补充 | 增加 `cutsTotal`、`workUnitsSinceLastCheckpoint`；基准证据清单。 |

### 1. 预算主从关系与确定性承诺（Q1）

- **工作预算是唯一语义预算**：状态、边、切段、Witness 体积。
- 墙钟只作 **abort-only** 安全网；触发时返回 `INSUFFICIENT_EVIDENCE` + `wall-clock-abort`，不得产出更强结论，也不得改变证明方向。
- 确定性承诺准确写法：

  > 对相同输入、相同模块级预算配置，在**工作预算内完成**的运行，必须产生相同的语义结果及确定性签名。墙钟 abort 属于环境相关的中止，不在确定性承诺范围内，但只能降级为 IE，不得改变证明方向或产生更强结论。

- `wallClockMs` 可保留在诊断中，但**必须排除**在 `determinismSignature` 之外。
- 跨进程确定性测试关闭墙钟，比较序列化签名，不比较墙钟字段。

### 2. 计量口径（Q2）

| 计量 | 定义 / 规则 |
| --- | --- |
| state | U9：每个被处理的 `(spawnFootX, k)` 相位状态计入；W：每个唯一入队 `(footX, k)` 计入 |
| `statesEnqueued` | 唯一入队状态数量 |
| `statesVisited` | 实际出队处理状态数量 |
| edge | 每次考虑的 `wait` / `move` 转移计 1，包括验证后拒绝的转移 |
| check | 每次实际执行连续时间求交计 1 |
| cut | 每次 check 内按折返点切出的子区间累计计数 |
| witness transition | 最终策略表中的验证记录，只用于 Witness 体积预算，不替代探索计数 |
| cell / hop sample | U4 图节点 / hop 弧采样点，分别计数；不与 U2 的 state 混用 |

- **U2（NB）一个预算**：U9 与 Winning Set 共用 `maxStates` / `maxEdges` / `maxCutsPerBranch` 与全部计数器。
- U9 失败后，W 只能使用 NB 分支**剩余预算**，不得重新获得一份完整预算。
- **U3（门区）**闭式 O(1)，无搜索工作预算；只受墙钟安全网约束。
- **U4（PU 图割）独立预算**；与 U2 不共享。
- **每档 lag 独立预算**；两档不共享、不拼接。
- 不得把 `statesEnqueued` 与 `statesVisited` 合并成模糊的 `statesChecked`。

### 3. 预算终值（Q3）

| 预算 | 默认 | 硬上限 | 作用域 | 状态 |
| --- | ---: | ---: | --- | --- |
| `maxStates` | `500,000` | `1,000,000` | U2 NB 分支 / 每档 lag，U9+W 共用 | 冻结 |
| `maxEdges` | 派生 `maxStates × maxBranching` | 派生 | U2，安全上限 | 冻结，须防溢出 |
| `timeBudgetMs` | `2,000` | `10,000` | 每分支 / 每档 lag（abort-only） | 冻结 |
| `maxCutsPerCheck` | `1,000,000` | `1,000,000` | U1 单次连续求交 | 冻结 |
| `maxCutsPerBranch` | **待定** | **待定** | U2 每档 lag 累计，U9+W 共用 | **DEFERRED → D5B** |
| `maxWitnessTransitions` | `1,000,000` | `1,000,000` | U2 Witness 体积 | 冻结 |
| `maxWitnessBytes` | `64 MiB` | `64 MiB` | U2 Witness 体积 | 暂定，D7 实测确认 |
| `maxHopSamples` | `240 / arc` | `240 / arc` | U4 双档采样 | 冻结 |
| `timeBudgetCheckpointWork` | `1024` work units | `1024` | 墙钟检查粒度 | 冻结（替代 state 口径） |

#### 3.1 累计 cut 预算（新增）

```text
每次 check：cuts ≤ maxCutsPerCheck ∧ cuts ≤ 剩余 maxCutsPerBranch
```

- `maxCutsPerBranch` 是 U2 每档 lag 的累计硬预算；U9 与 W 共用。
- 触发时：IE `cut-budget-exhausted`（累计）或 `cut-budget-exhausted`（单次，附 `budgetKind` 区分）。
- 具体默认值与硬上限**不在本轮指定**，交 [I02-D5B](21-i02-d5b-cut-budget-benchmark.md) 用 scratch 基准确定。
- 在该值冻结前：U1 可验收 `maxCutsPerCheck`；**U2 不得声称已有完整确定性工作预算**；D9 / AUTH 不得签署 U1–U2 完整预算验收。
- U4 当前没有连续求交；**不创建无意义的累计 cut 计数器**。若未来加入，必须消费自己的累计 cut 预算。

#### 3.2 `maxEdges` 派生与溢出

```text
maxBranching = 2·floor(maxSpeed·periodMs / (N·xStep)) + 2
maxEdges     = maxStates × maxBranching
```

- `maxBranching` 是**安全上界**，不是实际平均分支数。
- 必须检查中间值与最终值为有限、安全整数；若超出可表示范围 ⇒ IE `budget-bound-overflow`，不得静默截断，不得变成无穷大预算。

#### 3.3 模块级常量

- 这些是模块级常量，不进 `GameConfig` / profile / 公开 API（I-00 §12）。
- 生产用默认值；硬上限是内部允许的最大值，不是调用方可随意指定的参数。
- 测试只能通过内部注入钩子使用受控预算。

### 4. 相位网格、容量与健全性（Q4、Q8）

```text
N_max       = floor(maxSpeed · periodMs / xStep)
N           = min(N_max, floor(maxStates / xPositions))
stateCapacity = xPositions · N
```

- `xStep = 1`（D3 / D10 冻结）。
- `N ≥ 2`，否则 IE `grid-resolution-infeasible`。
- `stateCapacity` 是**完整状态空间的上界**，不是声称搜索一定访问全部状态；实际访问量由 `statesEnqueued` / `statesVisited` 记录。
- `phaseGridCapped` 只表示相位分辨率受容量约束，是**诊断**，不是降级 Verdict。
- **健全性前提**：粗化相位格只有在残差等待对整个格内 Hazard 位姿范围做保守验证时才成立；不能用粗化后的格点采样替代整格覆盖。
- 禁止：静默改变 `xStep`、把 N 截断到 2 以下、忽略容量约束、把部分相位覆盖描述成完整覆盖。
- 记录：`gridN`、`N_max`、`xStep`、`xPositions`、`stateCapacity`、`phaseGridCapped`、`phaseCapReason`。

### 5. 预算作用域、总上界与检查点（Q5）

#### 5.1 作用域

- U2：NB 分支，每档 lag 一份；U9 与 W 共用。
- U3：闭式 O(1)，无搜索工作预算。
- U4：PU 图割分支，每档 lag 独立预算。
- U2 与 U4 不共享预算。
- 两档 lag 不共享预算。

#### 5.2 墙钟总上界

| 阶段 | 默认总上界 | 硬上限总上界 |
| --- | ---: | ---: |
| U2 两档 lag | 4 秒 | 20 秒 |
| U4 两档 lag | 4 秒 | 20 秒 |
| 合计 | 8 秒 | 40 秒 |

- 不包括输入解析。
- 不意味着每个分支都必须跑满预算。

#### 5.3 检查点按工作单元

```text
timeBudgetCheckpointWork = 1024
```

- 检查点由**确定性工作计数**触发，而不是只由 state 触发。
- 工作单元至少覆盖：state 处理、edge 验证、cut 求交、Witness 验证、U4 图节点与 hop sample 处理。
- 记录 `workUnitsSinceLastCheckpoint`。
- 检查点粒度不改变语义预算；墙钟仍然只 abort-only。

#### 5.4 非法预算

- 非有限、`timeBudgetMs ≤ 0`、`maxStates < 1`、派生上界溢出 ⇒ IE `invalid-budget` / `budget-bound-overflow`。
- 不得回退到默认值后继续；必须显式降级。

### 6. 禁止动作与硬上限执行（Q6）

- 不得静默扩大预算。
- 不得失败后自动重试。
- 不得切换算法绕过硬上限。
- 调用方不得按关卡设置预算。
- 测试只能通过内部注入钩子使用受控配置。
- 超过硬上限或预算配置非法，必须 IE。
- U9 与 W 共用 NB 预算；**不能因为 U9 找不到 Witness 就给 W 重新发放一份 `maxStates`**。

### 7. 降级优先级与发布门（Q7）

#### 7.1 顺序（先命中者为准）

1. 输入及模型合法性检查（`lag-invalid` / `trusted-input-invalid` / `model-out-*`）；
2. 几何、spawn、goal 检查（`geometry-*` / `spawn-*` / `goal-*`）；
3. 网格可行性检查（`grid-resolution-infeasible`）；
4. 预算配置合法性检查（`invalid-budget` / `budget-bound-overflow`）；
5. 工作预算耗尽（`state-budget-exhausted` / `edge-budget-exhausted` / `cut-budget-exhausted` / `witness-volume-exceeded`）；
6. 墙钟 abort（`wall-clock-abort`）；
7. 搜索完整失败（`no-witness-found` / `winning-set-failed` / `graph-cut-not-proven`）；
8. 双档 lag 一致性包装；
9. 公共能力发布门（`public-capability-blocked`）。

- `phaseGridCapped` 是诊断，不是降级。
- `degradationReason` 记录主因；`secondaryReasons` 记录次因。

#### 7.2 双档「不完整」与「不一致」分开

- 只有两档**都完成**且产生可比较的内部结果，才判断 `two-lag-disagreement`。
- 若一档因预算或墙钟而 IE，**不得**把它伪装成结论不一致；保留各档原始原因，合并结果降为 IE。
- 两档合并结果记录 `perLagResults`，不只记录最终 IE。

#### 7.3 发布门不覆盖内部结果

保留四个层次：

```text
internalResult
modelConditional
publicCapability
publicResult
```

- 内部已得到模型条件性 NB / PU 时，内部结果仍可审计；公共输出被发布门阻断。
- 不得为了发布门把内部证明结果改写成普通搜索失败。
- `public-capability-blocked` 是发布门，不是搜索降级。

### 8. 确定性实现纪律（Q9）

- 状态键 `(footX, k)`，整数表示；不用浮点键。
- BFS FIFO。
- 邻居固定顺序：先 `wait`，再按目标 `footX` 升序的 `move`。
- 策略 tie-break：同 rank 后继按最小 `footX`，再最小 `k`。
- **所有影响策略选择的遍历与候选生成顺序都必须确定性排序**；只规定 BFS FIFO 不够。
- 字符串排序用码点比较；新代码不用 `localeCompare`。
- 语义层不依赖 `Set` / `Map` 迭代顺序。
- 不使用随机数与日期。
- hop 采样按既定 `Math.round` 规则。
- 跨进程比较 `determinismSignature`，不比较墙钟字段。
- 确定性测试关闭墙钟。
- 既有 `temporalScope` 不在本票改动范围内，除非另有白名单审批。

### 9. 诊断字段与基准证据（Q10）

#### 9.1 D9 字段

`budgetProfile`、`budgetStatus`、`budgetKind`、`statesEnqueued`、`statesVisited`、`edgesChecked`、`cutsChecked`、`cutsTotal`、`hopSamplesChecked`、`witnessTransitions`、`witnessBytes`、`wallClockMs`、`timeBudgetCheckpointWork`、`workUnitsSinceLastCheckpoint`、`gridN`、`N_max`、`xStep`、`xPositions`、`stateCapacity`、`phaseGridCapped`、`phaseCapReason`、`maxBranching`、`determinismSignature`、`degradationReason`、`secondaryReasons`、`internalResult`、`modelConditional`、`publicCapability`、`publicResult`。

- `budgetKind` 至少区分：`state-budget`、`edge-budget`、`cut-budget`、`witness-volume`、`wall-clock-abort`、`hop-sample-budget`。
- 原因码是内部枚举，不新增公共 `ConfigIssue.code`。
- `wallClockMs` 不进入 `determinismSignature`。

#### 9.2 基准证据清单

D7 的基准必须记录：

- 命令、退出码；
- 语料范围与样本数量；
- p50/max 状态数；
- p50/max edge、cut 数；
- p50/max 墙钟；
- 跨进程签名；
- 预算是否触顶；
- `phaseGridCapped` 的样本数及实际 N 分布。

scratch 基准只能证明预算配置有实测依据，不能表述为生产验收。

### 10. 延迟数值与 I02-D5B

`maxCutsPerBranch` 的默认值与硬上限交 [I02-D5B 累计 cut 预算基准](21-i02-d5b-cut-budget-benchmark.md)（task · AFK）。该票产出：

- 每条 edge 的 cut 数分布与 U2 每档 lag 的累计 cut 分布；
- `maxCutsPerBranch` 的建议默认值与硬上限；
- `maxWitnessBytes` / `maxWitnessTransitions` 的实测复核；
- 命令、输入 SHA、原始输出、复现方法。

在 D5B 完成前：

- U1 可验收单次 `maxCutsPerCheck`；
- **U2 不得声称已有完整确定性工作预算**；
- D9 / AUTH 不得签署 U1–U2 的完整预算验收；
- 授权包必须把 `maxCutsPerBranch` 标为 `DEFERRED`，并引用 D5B 作为前置。

### 11. 对下游的影响

- **D6**：白名单/模块布局必须容纳预算接口；预算常量不进入公共 API。
- **D7**：测试矩阵必须覆盖工作预算、墙钟 abort、`phaseGridCapped`、非法预算、双档不完整 vs 不一致、确定性复跑、累计 cut；基准证据按 §9.2。
- **D9**：按 §9.1 字段集冻结；`budgetKind` 枚举；`wallClockMs` 排除出签名；内部/公共结果分层。
- **AUTH**：原样引用确定性承诺、预算表、降级顺序、发布门分层；`maxCutsPerBranch` 标 `DEFERRED`，D5B 为前置；不得签署 U1–U2 完整预算验收。
- **D8**：预算接口是 U1 前置；D5B 是 U2 完整预算验收的前置。

### 12. 边界与仍开放的风险

- 本票未修改任何产品文件；未新增 fixture pack；未运行生产测试。
- `maxCutsPerBranch` 与 `maxWitnessBytes` 的最终值未冻结；前者由 D5B，后者由 D7 实测确认。
- 墙钟 abort 不在确定性承诺范围内；它是 IE-only 的环境中止。
- `phaseGridCapped` 是诊断，不是降级；粗化相位必须配合整格残差验证。
- 本票不产生任何生产验收声明；`NO_PROVEN_BLOCKER` 仍不等于可玩。
