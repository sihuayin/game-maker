# I02-D7 测试矩阵与证据口径裁定

Type: grilling
Status: resolved
Owner: amber
Blocked by: 09, 10, 11
Map: ../map.md
Class: I-02 / DECISION

## Question

冻结 I-02 的测试矩阵、夹具、命令、性能与回归口径，使授权包中的验收条件可执行、可复核。

### 必须裁定

1. **核心场景矩阵**：I-02 §6.1 的 A–J 逐项落成测试意图、输入、预期结论。
2. **数值与边界测试**：严格重叠、相切、零面积接触、ε 两侧、方向切换、周期起终点/折返点、同速/近速、极短窗口、极短通道、临界门宽、负时间、无效周期、非有限数值、网格约束、预算刚好达上限。
3. **证明健全性反例**：网格细化、hop 加倍、部分路径、局部封锁、采样漏检。
4. **双档 lag 测试**：16.67ms / 200ms 分别完整分析；一致/不一致；不允许只保留乐观档。
5. **夹具策略**：内存合成 config / manifest / atlas vs 新 fixture pack；复用现有测试 helper；不得删除或放宽既有断言。
6. **命令**：`pnpm test`、定向 vitest、scratch 复现命令；CI 落位（若授权包不接 CI，写明）。
7. **性能口径**：语料、阈值、环境；区分「证据」与「验收」；P0 数字不得当预算。
8. **回归口径**：既有 vitest 全绿；LP-06/07 scratch 复跑一致；不转 vitest 的已知限制。
9. **AC 映射**：I-02 §9 的 AC-01～AC-13 逐条对应测试证据。
10. **证据格式**：E1/E2/E3；不落盘生产证据链。

### 产出

票内 `## Answer`：测试矩阵表 + 命令清单 + AC 映射。

### 下游

I02-AUTH。

## 上游裁定（D8，2026-11-11）

测试矩阵按 R1–R4 逐项映射；每道复核门必须有可执行命令、退出码与逐项 PASS/FAIL；R2 PASS 不等于 U3/U4 授权；R4 PASS 不等于公共 NB/PU 能力授权。


## 上游裁定（D5，2026-11-11）

测试矩阵必须覆盖：工作预算触顶、墙钟 abort、`phaseGridCapped`、非法预算 / 派生上界溢出、双档「不完整」与「不一致」分开、确定性复跑（关闭墙钟）、累计 cut、Witness 体积。基准证据按 [I02-D5](11-i02-d5-budget-determinism.md) §9.2 记录；`maxCutsPerBranch` 由 [I02-D5B](21-i02-d5b-cut-budget-benchmark.md) 提供。

## 上游裁定（D6，2026-11-11）

- 测试文件：新增 `packages/contracts/tests/playability-temporal*.test.ts`，**只新增**；可拆成 `playability-temporal-motion.test.ts` / `-witness.test.ts` 等，便于 R1–R4 逐单元定位；不得修改 `playability-temporal-input.test.ts`（含 T-55～T-65 与 I-01 矩阵）。
- 夹具内存优先；需真包时只读复用 `fixtures/packs/last-train/v2`；不新增 `fixtures/packs/**`（需单独 HITL）。
- 三角波 cross-check 可在测试中用 `node:fs` 只读 `packages/demo/src/hazard.ts` 文本。
- I-02 不接生产：测试直接调用内部 analyzer，`ops.ts` / T-57 / T-58 / T-61 原样。
- 新模块须避开文本扫描陷阱：不得出现 `analyze:` 属性标签（T-58）、不得调用 `auditPlayabilityTemporal(`（T-57）、不得出现 `Symbol(`（T-64）、不得导出 `TEMPORAL_LAG_*` 同名常量（T-62）。

## Answer

用户 2026-11-11 逐题裁定。Q1–Q8 **全部采纳推荐方案**，并追加三处收紧：Q2 的 D7↔D9 对齐规则、Q3 的具名 helper 白名单增量、Q5 的时钟注入边界。

**修改产品目录：否**（仅本票、D6 / D9 / AUTH 票尾、地图；未触碰 `packages/**`、Runtime、CLI、MCP、公共 Contract、I-00 / I-02 原文）。

> 本票只冻结**测试矩阵与证据口径**，不扩大生产能力或公共接口，也不构成 U2–U5 的实施授权。

### 0. 裁定总表

| 问题 | 裁定 | 冻结要点 |
| --- | --- | --- |
| Q1 测试文件拆分 | **A：按单元 + 矩阵** | 六个 `playability-temporal*.test.ts`；AC 映射放 `reports/` |
| Q2 A–J 断言层级 | **A：断言内部证明结果** | 不断言公共 Verdict；字段名由 D9 绑定 |
| Q3 夹具 | **A：具名内存 helper** | 新增 `playability-temporal-fixtures.ts`，由 D7/AUTH 显式增补白名单 |
| Q4 确定性 | **A：进程内重复 + 稳定序列化** | 跨进程签名只进 scratch 基准 |
| Q5 墙钟 abort | **A：预算 + 时钟注入** | `now` 仅测试专用，不进公共面 |
| Q6 性能 | **A：证据，不做 vitest 门禁** | 语义预算由工作计数验收 |
| Q7 回归 | **A：LP-06/07 只在 U5 与最终审计跑** | 基差异 = STOP / 根因分析 |
| Q8 AC 映射 | **A：分派到单元与复核门** | 逐项 PASS / FAIL / NOT_RUN |

### 1. 测试文件布局（Q1）

| 文件 | 单元 / 门 | 内容 |
| --- | --- | --- |
| `packages/contracts/tests/playability-temporal-motion.test.ts` | U1 / R1 | 三角波、AABB、连续求交、ε、数值稳定性、反例 |
| `packages/contracts/tests/playability-temporal-budget.test.ts` | U1 预算前置 + U5 硬化 | 预算接口、工作计数、墙钟 abort、降级、确定性 |
| `packages/contracts/tests/playability-temporal-witness.test.ts` | U2 / R2 | Witness 构造 / 验证、D3 §11 反例、U9 / W |
| `packages/contracts/tests/playability-temporal-gate.test.ts` | U3 / R3 | 门区闭式、全相位覆盖、临界门宽 |
| `packages/contracts/tests/playability-temporal-evasion.test.ts` | U4 / R4 | 图割、hop 双档、N1/N2 反例 |
| `packages/contracts/tests/playability-temporal.test.ts` | A–J 矩阵 | §6.1 A–J + 跨单元组合 |

- 六个文件都匹配 D6 的 `playability-temporal*.test.ts` 通配，**不需要再改测试文件白名单**。
- `playability-temporal-budget.test.ts` 同时承载 U1 预算前置与 U5 硬化测试；**报告必须区分阶段**，不得因为文件归属 U1 就把 U5 验收提前算作通过。
- AC 映射表放 `reports/`，不放进测试源码。
- 共享构造器放 D7 显式授权的 `playability-temporal-fixtures.ts`（见 §7）；不得把 helper 当成 `playability-temporal*.test.ts` 通配的一部分。

### 2. A–J 语义断言矩阵（Q2）

I-02 不发布公共 NB / PU。下表冻结的是**语义断言**；具体字段名由 D9 绑定。

| 编号 | 场景 | 必须成立的语义断言 | AC | 门 |
| --- | --- | --- | --- | --- |
| A | 存在安全等待窗口，玩家可以通过 | 内部 NB 证书完整成立；`publicCapability = BLOCKED` | AC-03 | R2 |
| B | 门区永久封锁且无垂直规避 | 门证明 + 图割证书完整；**仍不得输出公共 PU**；`publicCapability = BLOCKED` | AC-05/06 | R3/R4 |
| C | 几何 / 时序 / 规避证据不足 | IE；诊断原因覆盖具体缺口 | AC-11 | 各门 |
| D | 折返点临界碰撞 | 折返点切段后按连续时间语义判定；相切不算撞、正面积严格重叠算撞 | AC-01/02 | R1 |
| E | 等待阶段存在碰撞 | Witness 验证失败（S2 / 残差等待）；不得产生 NB 证书 | AC-03/04 | R2 |
| F | 周期内存在短暂安全窗口 | 门证明不成立；不得 PU | AC-05 | R3 |
| G | 存在垂直规避路径 | 图割证书不成立；不得 PU | AC-06/07 | R4 |
| H | 搜索预算超限 | IE；`budgetKind` 对应触发原因 | AC-08 | 全门 |
| I | 两档 lag 结果不一致 | IE + `lag-disagreement`；不得只保留乐观档 | AC-09 | 全门 |
| J | 相同输入重复运行 | `determinismSignature` 与剔除 `wallClockMs` 的稳定序列化一致 | AC-10 | 全门 |

**D7 ↔ D9 强制对齐规则**（用户追加）：

1. D9 必须为 D7 每条语义断言提供明确字段落点。
2. AUTH 必须逐条核对 A–J 与 D9 的映射。
3. 若字段无法表达某项语义，回 D9 修订，**不得在 AUTH 中弱化 D7**。
4. 不允许以内部字段名的实现便利性改变预期结论。
5. 内部 NB 证书成立 ≠ 公共 `NO_PROVEN_BLOCKER`；内部 PU 证据成立 ≠ 公共 `PROVEN_UNPLAYABLE`。

### 3. 数值与边界测试（§6.2）

| 类别 | 必须覆盖 | 预期口径 |
| --- | --- | --- |
| AABB | 严格重叠 / 边界相切 / 零面积接触 | `overlapsStrict`：相切、角接触、零面积不算撞；正面积严格重叠算撞（I02-06） |
| ε | 门宽判定两侧、区间阈值两侧 | ε 只用于门宽 / 显式区间阈值，**不进入碰撞谓词** |
| 方向 | 正向 / 反向 / 折返点切段 | 折返点不定义速度；单段不得跨折返点 |
| 周期 | `t=0`、`P/2`、`P`、负时间、多周期 | `p(−t)=p(t)`；周期起终点一致 |
| 速度 | 同速 / 近速 | `c1 === 0` 精确分支；不得用绝对容差把非零速度差归零 |
| 窗口 | 极短安全窗口（如 `1.005e-6 ms`） | 必须保留；不得被 `hi−lo > 1e-9` 吞掉 |
| 通道 | 极短通道 / 临界门宽 | `w−d>ε`；临界两侧分别成立 / 不成立 |
| 非法值 | 无效周期、非有限数值 | IE；不得静默修复 |
| 网格 | `N≥2`、`N_max`、容量与派生上界 | `N<2` ⇒ IE `grid-resolution-infeasible`；溢出 ⇒ IE `budget-bound-overflow` |
| 预算 | 刚好达上限 / 刚好超限 | 达上限不算超限；超限 ⇒ IE；不得静默扩预算 |

### 4. 证明健全性反例

必须全部覆盖，且**必须失败 / 必须 IE**：

- I-02 §6.3 五条：网格细化、hop 加倍、部分路径、局部封锁、采样漏检。
- D3 §11 十三条：墙穿越的 `move`、非整数 spawn、Goal Rect 未内缩、残差等待只查端点、wait 区间内碰撞、预算耗尽仍输出 NB、无终止 rank 的循环、跨 lag 拼接、`startCells()` 替代 spawn、目标在走廊外、Goal Rect 退化、只查端点静态 `standable`、把整格保守覆盖写成具体轨迹已验证。
- D4：N1（上方绕行）、N2（下方坑道）、`midAirHits=0` 不得作为不可达正面证据。
- D10：全 N 个半开相位格覆盖、残差等待整格保守验证、策略严格递减 rank / 有限轨迹；phase 0 BFS 不构成全相位证明。

### 5. 双档 lag 测试（§6.4）

- `16.67ms` 与 `200ms` **分别完整执行**内部分析，每档独立预算、独立证据。
- 不允许跨档共享或拼接转移记录 / Witness / 证明。
- 两档结论一致 ⇒ 按冻结规则处理；不一致 ⇒ IE + `lag-disagreement`。
- 不允许只保留较乐观或较确定的一档结果。
- `resolveTwoLagResults` 的既有行为不变（I-01 测试不改）；I-02 测试只验证内部输入在两档下的独立性与降级规则。

### 6. 预算与确定性测试（D5 对齐）

| 测试意图 | 预期 |
| --- | --- |
| 工作预算触顶 | IE + `budgetKind` 对应；不得提升部分结果 |
| 墙钟 abort | 通过注入时钟确定性触发 `wall-clock-abort`；不得靠真实耗时 |
| `phaseGridCapped` | 诊断字段；不是降级 Verdict |
| 非法预算 | IE `invalid-budget`；不得回退默认值继续 |
| 派生上界溢出 | IE `budget-bound-overflow`；不得截断成无穷预算 |
| 双档「不完整」与「不一致」 | 分开的降级原因，不合并 |
| 累计 cut | U2 按 D5 §3.1；`maxCutsPerBranch` 在 D5B 前为 `DEFERRED` |
| Witness 体积 | `maxWitnessTransitions` / `maxWitnessBytes` 触发 IE `witness-volume` |
| 确定性 | 进程内连跑 ≥2 次：`determinismSignature` 与剔除 `wallClockMs` 后的稳定序列化一致；不只比较最终状态；不得用排序掩盖不确定顺序 |

跨进程签名只在 scratch 基准中记录，不作为 CI 子进程门禁。

#### 6.1 时钟注入边界（Q5 收紧）

内部测试上下文可以接受：

```text
{ budget?: InternalBudget, now?: () => number }
```

冻结规则：

- `now` **只**用于 wall-clock abort 判定。
- `now` 不参与相位、移动、碰撞、Witness、图割或策略选择。
- 生产调用不暴露 `now` 注入能力，使用模块级默认时钟。
- 不加入公共函数签名、公共 Contract、配置字段或任何 barrel export。
- 测试通过内部调用入口注入受控时钟；`wallClockMs` 仍不进入 `determinismSignature`。
- 测试钩子不得成为生产调用方绕过预算常量或放宽预算上限的入口。
- 区分两件事：**测试可以控制时钟，生产不能；测试可以注入受控预算，生产不能借该接口扩预算**。

### 7. 夹具策略（Q3）

新增一个具名 helper，并**显式修订 D6 白名单**：

```text
packages/contracts/tests/playability-temporal-fixtures.ts
```

允许内容仅限：

- `GameConfig` / manifest 内存构造器；
- 公共测试断言辅助；
- 边界值与反例构造辅助。

禁止：

- 产品算法或生产逻辑；
- 被 `src/**` 引用；
- 注册测试或产生测试副作用；
- 文件系统读写；
- 新增 pack fixture。

标记 `TEST_ONLY`；在 diff 审计中单独检查。该文件**不是** `playability-temporal*.test.ts` 通配的一部分，必须由 D7 / AUTH 显式列入白名单增量。

其余夹具规则：

- 内存构造优先；需要真包时只读复用 `fixtures/packs/last-train/v2`。
- 不新增任何 `fixtures/packs/**`。
- 不新增 JSON fixture 文件；边界值构造逻辑必须可读、可复用。

### 8. 命令清单

| 场景 | 命令 |
| --- | --- |
| 全量测试（每单元 PR / R 门） | `pnpm build && pnpm test` |
| 定向单文件 | `pnpm exec vitest run packages/contracts/tests/playability-temporal-<unit>.test.ts` |
| 类型检查 | `pnpm typecheck` |
| U5 / AUTH 前 LP-06 语料 | `pnpm build && node .scratch/level-playability-v1-p1/acceptance-corpus.mjs` |
| U5 / AUTH 前 LP-06 矩阵 | `pnpm build && node .scratch/level-playability-v1-p1/acceptance-matrix.mjs` |
| 性能基准（证据） | `pnpm build && node .scratch/level-playability-v1.1-i02/scripts/bench-temporal.mjs` |

- CI 已在 PR 上跑 `pnpm build && pnpm test`；新测试自动纳入，**不修改 workflow**。
- scratch 基准与 LP-06/07 不在 CI 门禁内。

### 9. 性能证据规范（Q6）

- 性质：**证据**，不是 vitest 墙钟门禁；CI 墙钟阈值不得作为通过条件。
- 脚本：`.scratch/level-playability-v1.1-i02/scripts/bench-temporal.mjs`（实现期创建；路径冻结）。
- 语料：`.scratch/level-playability-v1/corpus/inventory.json`，每次记录 SHA-256。
- 输出：p50 / max `states`、`edges`、`cuts`；`wallMs`；`phaseGridCapped` 分布与实际 `N` 分布；跨进程确定性签名；Node 版本、OS、CPU。
- 禁止：把 P0 代理数值冒充 I-02 生产预算；用重跑、扩预算或切换算法掩盖失败。
- 语义预算上限仍由工作计数在 vitest 中确定性验收；AC-13 的性能证据完整性由报告检查。

### 10. 回归口径（Q7）

| 阶段 | 必须执行 |
| --- | --- |
| 每个 U 单元 PR | `pnpm build && pnpm test` |
| R1–R4 | 对应单元定向 vitest + 全量 `pnpm test` |
| U5 | 全量测试 + LP-06 / LP-07 两个 acceptance 脚本 |
| AUTH 前 | 重跑 LP-06/07，与冻结基线逐项比较 |

- LP-06/07 仍是既有非 vitest 回归；**不迁移、不改造、不包装成 I-02 新测试**。
- 任何基线差异 ⇒ STOP 并分析根因（I-02 不接生产，本不应改变这些结果）。
- 已知限制：LP-06/07 无 vitest；I-02 不接生产；runtime hitbox equality 未证；19 关语料不进入 I-02 vitest 验收。

### 11. AC 映射（Q8）

| AC | 主责 | 复核位置 | 证据 |
| --- | --- | --- | --- |
| AC-01 / AC-02 | U1 | R1 | E2 + E3（03 证据复跑） |
| AC-03 / AC-04 | U2 | R2 | E2（D3 §11 反例全覆盖） |
| AC-05 / AC-06 | U3 | R3 | E2（门区闭式、全相位覆盖） |
| AC-07 | U2 网格细化 / U4 hop 加倍 | R2 / R4 | E2 + E3 |
| AC-08 / AC-09 / AC-10 | U5 | 全门 | E2（预算、双档、确定性） |
| AC-11 | U1–U4 | 各门 | E2（模型外 IE） |
| AC-12 | 范围与白名单审计 | AUDIT | E1（`git diff` 白名单核对） |
| AC-13 | U5 + AUTH | 最终审计 | E2 + E3（核心测试 + 回归 + 性能证据） |

测试标题必须带编号，例如：

```text
[I02-01][AC-01] 折返点切段
```

### 12. 证据格式

每项证据记录：测试名称、执行命令、退出码、原始输出摘要或 hash、对应 AC、复核门。

- E1：源码 / 契约 `file:line`。
- E2：测试名 + 断言 + 退出码。
- E3：scratch 复跑（命令、路径、计数、原始输出摘要）。
- 报告位置：`.scratch/level-playability-v1.1-i02/reports/R1-review.md` … `R4-review.md`。
- 逐项 `PASS` / `FAIL` / `NOT_RUN`；总通过率不能替代逐项结论；未运行项不得因其他测试通过而推定通过。
- 不落盘生产证据链；scratch 结果不构成生产验收。

### 13. 修订责任与授权边界

| 文档 | 必须处理 |
| --- | --- |
| D6 | 增补 `playability-temporal-fixtures.ts`；确认测试文件白名单；记录内部时钟注入不构成公共接口 |
| D7 | 本票：六文件布局、A–J 语义断言、时钟测试、性能证据、LP 回归、AC 映射 |
| D9 | 冻结内部结果字段，确保 A–J 每项都有可断言的字段落点 |
| AUTH | 对齐 D6 文件白名单、D7 测试语义、D9 字段；确认 `now` 注入边界 |

本轮不扩大实施授权：

- U1 仍是唯一已授权单元；U2–U5 仍需前序复核与增量签署。
- 新增 helper 必须完成 D6 / AUTH 白名单增量。
- `now` 是内部测试专用注入，不是公共 API。
- `graph.ts` 仍受独立增量审批约束。
- `ops.ts` stub、T-57 / T-58 / T-61 保持不变。
- `PUBLIC_NB`、`PUBLIC_PU` 继续 `BLOCKED`。
