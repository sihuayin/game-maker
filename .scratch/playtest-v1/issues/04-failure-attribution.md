# 04. 失败归因规则（五态一等）

Type: grilling
Status: resolved
Owner: main session · 2026-10-27
Map: ../map.md
Blocked by: 02, 03

## Question

裁定五种结果的**判定与归因规则**（范围内第 3 条 + 完成条件；方向已定：五态一等、代理限制必须可表达、
不得把代理失败算成游戏失败）。至少定：

1. **五态枚举**：`成功 / 游戏失败 / 环境故障 / 代理限制 / 超时` 各自的确切定义与边界 —— 尤其「环境故障」
   （Chrome 起不来 / 站点加载失败 / 资源 404）vs「游戏失败」（确定性玩法 bug）vs「代理限制」（试玩器跳不过 /
   路径不通）vs「超时」（没跑完、原因未定）。超时是独立一档，还是仍归 `UNKNOWN`/`incomplete`？
2. **归因规则**：从观测（票 03）到五态的**确定性映射** —— 什么证据算「游戏失败实锤」「代理限制实锤」「环境故障实锤」？
   沿用「错了一定不是设计」的判据边界，但代理限制现在**允许产**（fpvs-v1-p1 票 05 的「永不产」在什么条件下解除、
   要什么证据才不提前断定）。
3. **与交付状态映射**：五态 → `DeliveryCheckStatus`（pass/fail/incomplete/blocked/not-required）怎么映射？
   「环境故障」映射成 `blocked` 还是 `fail`？「代理限制」「超时」映射成 `incomplete`？
   最终 `DeliveryVerdict`（fail>blocked>incomplete>pass）在五态下还成立吗？
4. **不误判为通过**：完成条件最后半句「不出现未知状态被错误判为通过」—— 哪些情况必须显式 `incomplete`/`UNKNOWN`，
   不得默认 pass？与 fpvs-v1-p1 的「缺席不默认 pass」纪律如何衔接。
5. **证据分级**：每种五态结果各需哪一级证据（E0–E3）才算「判定成立、证据可复现」？

> **与票 02 的接口（2026-10-27 补）**：票 02 已定——场景的 `expectedOutcome` 是**设计意图**，不是实际结果。
> 本票必须从证据**独立归因**实际五态，**不得用 `expectedOutcome` 预填**；`expectedOutcome` 只用于校验 harness。

HITL：用户逐字裁定。

## Answer（裁定 · 2026-10-27 用户逐字）

**总纲**：归因是**证据独立**的纯函数，只吃运行证据，**不吃** `expectedOutcome`、不吃场景名（票 02 接口）。
三层词汇各管各的：`expectedOutcome`（设计意图，票 02）/ 断言三值（票 03 / 02）/ `PlaytestOutcome`（本票）。
断言 `fail` / 场景 `unknown` 都不能越权替代五态归因。

### Q1 — 结果模型：五态 + `UNKNOWN` + 独立执行状态 ✓

```ts
type PlaytestOutcome =
  | "SUCCESS" | "GAMEPLAY_FAILURE" | "ENVIRONMENT_FAILURE"
  | "AGENT_LIMITATION" | "TIMEOUT" | "UNKNOWN";

type Execution = "executed" | { status: "not-executed"; reason: string };
```

- **五态**回答「有证据时归哪一类」；**`UNKNOWN`** 回答「证据不足以归任何一类」——它是**归因不成立**，
  **不是第六种失败原因**，但必须一等存在，否则只能伪造归因或假绿。
- **`not-executed` 不进 `PlaytestOutcome`**：版本拒绝 / schema 拒绝 / 场景损坏 = 根本没开始，
  与「跑了但没结论」是两件事。它参与交付聚合（Q7），但不参与五态排序。
- 命名：outcome 用大写蛇形（沿用 `GAMEPLAY_FAILURE` / `AGENT_LIMITATION`）；交付层继续小写连字符。

### Q2 — 归因结构与聚合：阶段化决策表 ✓（含修正）

纯函数 `attribute(runEvidence) → PlaytestOutcome`，按阶段顺序求值，**阶段可产出集必须与各结果定义一致**：

| 阶段 | 可产出 |
|---|---|
| `prepare`（场景/site/pack/config 身份、Chrome 启动） | `not-executed`；已在准备执行且有充分证据时 `ENVIRONMENT_FAILURE` |
| `boot`（加载站点、`scene-ready`） | `ENVIRONMENT_FAILURE` / `UNKNOWN` |
| `execute`（语义动作 + 观测） | `GAMEPLAY_FAILURE` / `AGENT_LIMITATION` / `TIMEOUT`（须满足 Q3）/ `UNKNOWN` |
| `evaluate`（断言评估） | `GAMEPLAY_FAILURE` / `UNKNOWN` |

**修正（用户确认）**：`TIMEOUT` **只属于 `execute`**。`boot` 到期仍未 `scene-ready`，不能仅凭超时归因环境故障，
也不能产出 TIMEOUT（`scene-ready` 正是 boot 的完成事件）——只能 `ENVIRONMENT_FAILURE`（有启动日志/证据）或 `UNKNOWN`
（对齐票 03「`scene-ready` 永不 ready ≠ fail」）。

**多场景聚合**（总序不变）：`GAMEPLAY_FAILURE > ENVIRONMENT_FAILURE > TIMEOUT > AGENT_LIMITATION > UNKNOWN > SUCCESS`。
`not-executed` 不参与这条排序（见 Q7）。`env-no-chrome` / `timeout-hang` 等 harness 条件场景按票 02 的层标记
**只做离线覆盖，不进真实游戏交付聚合**。

### Q3 — 超时：独立一等态，边界 ✓（含修正）

- **定义**：场景总时限到期，且已排除环境故障、游戏失败实锤、代理限制实锤——「没跑完、原因未定」。
- **vs `UNKNOWN`**：截止期到达、且**执行仅仅因为时间耗尽而未完成** ⇒ `TIMEOUT`；结构性证据不足导致无法完成或判定
  ⇒ `UNKNOWN`。**两者同时存在且无法证明哪个是主因 ⇒ `UNKNOWN`**，同时保留截止期事实作为证据。
  （修正：不再「同时成立归 TIMEOUT」——那会与票 02 的 `fail > unknown > pass` 产生两个矛盾主结论。）
- **vs `AGENT_LIMITATION`**：光超时不算限制；限制要正面证据（Q5）。
- **vs `ENVIRONMENT_FAILURE`**：`TIMEOUT` 要求环境已证明健康（`scene-ready` 观测到、轮询连续）。
- 语义：`TIMEOUT` 表示**已明确归因于截止期**的未完成；`UNKNOWN` 表示归因或判定证据不足。

### Q4 — 游戏失败实锤：断言 fail ≠ `GAMEPLAY_FAILURE` ✓（含修正）

**必要不充分**。`GAMEPLAY_FAILURE` 需下列任一正面证据（闭集，对齐现有 smoke 的 `floor/win/runtime`）：

1. **运行时错误**：harness 实际捕获到页面异常 / `console.error`（`runtime-error`）。
2. **与代理动作无关的不变量被违反**：掉穿地面并持续、`won=true` 但 `collected < expected`、初始状态与关卡契约矛盾。
3. **动作已成功执行但游戏无响应**：轨迹证明 agent 实际到达/完成操作，对应状态变化却未发生。

**修正（用户确认）：三类实锤统一加环境健康前置门**——① 环境健康已充分证明；② 证据可归因到**游戏逻辑或游戏配置**；
③ 已排除 harness 注入错误、资源加载失败、站点装配问题。无法排除环境原因 ⇒ `ENVIRONMENT_FAILURE` 或 `UNKNOWN`，
不得直接判 `GAMEPLAY_FAILURE`。尤其 `runtime-error`：**捕获到错误不等于玩法缺陷**，必须做来源与严重性判定；
仅有 `console.error` 不够。

**不构成实锤**：没走到目标、收集数不足、时限内没通关。

**对票 02 场景设计的硬要求**：`failure-missing-pickup` 的断言必须落在**初始态 pickup 缺失**（第 2 类），
而不是「`collected==4`」——后者证明不了游戏失败。

### Q5 — 代理限制：解除「永不产」的实锤门槛 ✓

`AGENT_LIMITATION` 需**正面、可复现的能力边界证据**，并排除矛盾证据（无 runtime error、无第 2 类不变量违反、环境健康）：

1. **动作级失败带原因与轨迹**：语义动作以「目标不可达 / 所需能力超出代理能力」结束，轨迹显示反复尝试、卡在具体几何位置。
2. **能力参数 vs 关卡几何的可计算矛盾**：如「跳跃 66px < 巡逻带 100px」，并有多次尝试轨迹佐证
   （现有 `navigate` 案例的实锤版本；现状 `playable-smoke.ts:61-63` 只有推测措辞）。
3. **探索耗尽**：场景声明的全部可行探索动作执行完仍无进展，每一步都有观测证据。

**不构成**：单纯超时、单次没捡到、场景作者没写某动作。后者是 **harness 能力缺口**，记 `not-executed` / `UNKNOWN`
并进已知限制，不能冒充「这次运行中代理受限」。
**代理限制永不映射 `fail`，也永不映射 `pass`**。

### Q6 — 不误判为通过 ✓（含修正 + 锁定决定）

`SUCCESS` 的充分必要条件：

- 场景**执行到底**、全部断言 `pass`、**零** `unknown` 断言、无未归因的 `runtime-error`、证据产物齐备；
- **修正（用户确认）**：至少一条**实质性断言被实际求值且为 `pass`**，且**场景声明的终止条件已达成**。
  「全部通过」在空集上为真 ⇒ 没有断言的场景**永不到 `SUCCESS`**；非游戏试玩场景由适用性规则明确记 `not-executed`。

其余纪律：

- 缺证据 / 部分证据 / 中途崩溃 ⇒ `UNKNOWN` 或 `TIMEOUT`，**永不** `SUCCESS`；`not-executed` 必须显式。
- 每条非 `SUCCESS` 结果至少挂一条证据引用；交付检查项标 `pass` 却无证据引用，写前即拒。
- 交付聚合：任一必需场景非 `SUCCESS` ⇒ 检查项不得为 `pass`。

**锁定决定（用户 2026-10-27）**：**已知且可复现的代理限制会阻止交付检查项自动变 `pass`**。
不得用 `knownLimitations` 偷换成成功，不得用 `not-required` 绕过必需验收。
若未来引入人工豁免，必须是单独、显式、可审计的流程（审批人、目标版本、接受的限制、证据），
**不得静默改变自动验收结果**。

### Q7 — 五态 → 交付状态映射 ✓

| Playtest 结果 | `DeliveryCheckStatus` | 依据 |
|---|---|---|
| `SUCCESS` | `pass` | 真实执行且验收条件全部满足 |
| `GAMEPLAY_FAILURE` | `fail` | 已证明游戏不满足契约 |
| `ENVIRONMENT_FAILURE` | `blocked` | 环境问题阻止对游戏作出有效判断 |
| `TIMEOUT` | `incomplete` | 执行未完成，原因已明确归于截止期 |
| `AGENT_LIMITATION` | `incomplete` | 代理能力边界已知，但不能据此判游戏通过 |
| `UNKNOWN` | `incomplete` | 证据不足以作出确定结论 |
| `not-executed` | `blocked` | 检查未执行，不能声称验收通过 |

两条必须锁定的边界：

1. **`ENVIRONMENT_FAILURE` 与 `not-executed` 都映射 `blocked`，但语义必须保留**：前者是执行期间确认环境故障，
   后者是准备阶段拒绝/未启动。**不能只存映射后的状态而丢掉原始原因**。
2. **多场景聚合区分「执行结果」与「执行资格」**：已执行场景按总序聚合；`not-executed` 不参与排序。
   必需场景未执行 ⇒ 整个检查项**不能为 `pass`**；若无更强的已执行结果决定状态，则为 `blocked`；
   **若已有确定的游戏失败证据，不得因另一场景未执行而把 `fail` 降成 `blocked`**。

`DeliveryVerdict` 四值总序（`fail > blocked > incomplete > pass`）不变，**不新增状态**。

### Q8 — 证据分级与最小证据集（E0–E3）✓（含修正）

**归因必须基于本次真实运行的 E3 证据**；E0–E2 可以帮助设计、验证归因器，却不能单独证明某次运行实际发生了什么。

**修正（用户确认）：E3 ≠「有真实产物文件」**。E3 必须是**可追溯到本次执行**的产物与运行证据：命令、退出码、实际路径，
以及必要的场景与产物身份。拿另一轮运行的 `events.jsonl` 配本次 `result.json`，形式有文件、实质无证据链。

| 结果 | 最小证据（缺一不成立） |
|---|---|
| `SUCCESS` | 场景执行完成 + ≥1 实质断言求值 `pass` + 终止条件达成 + `events.jsonl` / `trace` / `result.json` + 场景与产物身份 |
| `GAMEPLAY_FAILURE` | 三类实锤之一 + 环境健康证明 + 错误来源与严重性判定（仅 `console.error` 不够） |
| `ENVIRONMENT_FAILURE` | 失败阶段的环境证据 + 进程退出码 + 执行阶段记录；未进入游戏须明记，**进入后才故障须记实际阶段**，不得伪造「未进入」 |
| `AGENT_LIMITATION` | 动作尝试轨迹 + 受阻位置 + 能力参数 vs 关卡几何的可计算证据 + 可复现尝试记录（单纯超时不够） |
| `TIMEOUT` | 时限配置 + 存活轨迹 + 环境健康证明 + 「结构性不可判不是主因」的判定记录 |
| `UNKNOWN` | **结构化证据不足记录**（见下），必须引用票 03 Q6 的可判性规则；不能只写「没有数据」 |
| `not-executed` | 准备阶段拒绝原因 + 命令 + 退出码 + 路径（是执行状态，不是第六种归因结果） |

**`UNKNOWN` 的结构化缺口记录（必填，缺失则 schema 拒绝）**：

```ts
type InsufficientEvidence = {
  ruleId: string;                 // 票 03 Q6 的可判性规则
  missingObservation: string;     // 缺失的观测量/证据类型
  affectedAssertionIds: string[]; // 受影响的断言；场景级不可判须能明确表达，不伪造断言 ID
  explanation: string;            // 为什么该缺口阻止确定结论
};
```

具体字段是否全部必填可在实施票细化，但**结构化缺口记录本身必须存在**。

**复现性身份绑定**：场景格式版本、实际 site/pack/config/shell 身份、harness 版本都必须进报告。
「同一绑定下重跑判定一致」= **相同证据输入与版本绑定下归因结果确定一致**，不要求真实游戏每次原始轨迹逐字相同。

### Q9 — 报告字段与消费者重算接口 ✓（含修正）

**架构边界**：

- Harness：执行场景、记录证据、生成归因结果。
- `mapPlaytest(report | undefined)`：**纯映射**，把试玩结果转成交付检查项（`{status, detail}`）。
- `buildDeliveryReport`：继续重算最终 `DeliveryVerdict`。
- **Harness 不写交付 `status` / `verdict`**，避免两套结论来源。

**报告**落 `run/v<N>/playtest/`：`result.json`（摘要 + 逐场景结果 + 聚合 + 执行状态 + 身份绑定）、`events.jsonl`、
`trace`、证据引用。报告可以保存归因结果，但**不能当作不可验证的最终交付结论**。

**缺席 vs 不足**：没有试玩报告 ⇒ `blocked`；报告存在但证据不足 ⇒ `incomplete`。**两者不能混为一谈**。

**写前一致性校验（用户补齐，归票 06 落地）**——`pass ↔ SUCCESS` 只是必要条件，完整不变量：

- `status: "pass"` 必须有完整、有效的 `SUCCESS` 证据链；
- `status: "pass"` 时，所有必需场景都已执行并满足成功条件；
- 必需场景 `not-executed` 时，整体不得为 `pass`；
- 非 `SUCCESS` 项不得映射为 `pass`；
- 非 `pass` 项必须有证据引用；`UNKNOWN` 还必须有结构化证据不足记录；
- `fail` 必须有支持确定失败的证据——**不得把环境故障或代理限制直接写成 `fail`**。

这些不变量由**交付 schema 与纯映射函数共同维护**。

**`knownLimitations` 不得改变状态**：只补充说明，不覆盖正式归因；`AGENT_LIMITATION` → `incomplete`；
不得用 `not-required` 绕过；未来人工豁免须单独、显式、可审计（见 Q6）。

**留给票 06**：检查项键名（`playable-smoke` vs 新增 `playtest`）、schema 条件校验、兼容迁移与命令改名。
**票 04 不再扩展这些实现问题。**

### 收口结论

1. **归因与交付状态分离**：harness 判定运行结果，contracts 映射交付状态。
2. **证据与结论绑定**：每个结果都必须有符合该结果要求的证据；`UNKNOWN` 必须解释为什么不可判。
3. **自动验收不假绿**：代理限制、缺失证据、未执行必需场景都不能变成自动 `pass`。

### 对下游的接口

- **票 05**：Q8 的「同一证据输入 + 同一版本绑定 ⇒ 归因确定一致」是回归基线比较的前提；基线身份应复用同一组绑定。
- **票 06**：消费 Q7 的映射表、Q9 的 `mapPlaytest` / 重算纪律与写前不变量；键名、schema、迁移由 06 裁定。
- **Harness 实现（雾）**：归因决策表、五态枚举、`InsufficientEvidence`、证据最小集已可照此实现。
- **CONTEXT.md 词条**：按地图约定仍与票 06 一起落地（本票不单独改词汇表）。
