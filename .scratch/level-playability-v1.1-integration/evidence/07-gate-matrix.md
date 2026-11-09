# I00-07 七项硬门槛验证矩阵

| 项 | 值 |
| --- | --- |
| 日期 | 2026-11-09 |
| 票 | [I00-07](../issues/09-i00-07-hard-gate-matrix.md) |
| 输入 | I00-01 / 02 / 03 / 04 / 06 的证据 + I00-05 / I00-10 的裁定 |
| 分支 / HEAD | `wayfinder/level-playability-v1.1-integration` / `578fa15` |
| 修改产品目录 | **否** |

状态词：**SATISFIABLE**（现有架构可满足，待实施）· **NEEDS-RULING**（契约语义未定，须 R1 裁）· **BLOCKED**（现有架构不可满足，须授权改动或缩范围）。

## 0. 结论速览

| 门槛 | 状态 | 阻塞点 | 解锁条件 |
| --- | --- | --- | --- |
| G-01 Hitbox 来源可信 | **BLOCKED** | manifest 无逐帧几何；acceptance 无生产消费者；anchor 比对条件式 | R1 选路径 + R2 授权 |
| G-02 Lag 来源明确 | **BLOCKED** | auditor 无任何可达 lag 输入 | R1 选路径 + R2 授权 |
| G-03 时间行为确定 | **NEEDS-RULING** | 「相位未知 ⇒ IE」与「T_arr 相位不可确定」的映射 | R1 裁语义 |
| G-04 垂直规避证据 | **NEEDS-RULING** | 图割可行，但依赖 G-01 的几何可信度 | R1 裁语义 + G-01 |
| G-05 运动模型边界 | **SATISFIABLE** | — | I-02 |
| G-06 判定语义受限 | **BLOCKED** | 现有聚合无法表达 partial 约束；全局 `partial ⇒ IE` 不可行 | R1 裁语义 |
| G-07 独立验收 | **SATISFIABLE** | 「可审计证据」无持久化落点 | R1 裁证据格式 + I-04/I-05 |

**三条硬事实**（不是实施细节）：

1. 全局「`coverage = partial` ⇒ IE」**不可行**——`coverage.spatial` 在 39/39 fixture 恒 partial（玩家几何无条件 partial，`profile.ts:113`），执行该规则会让 `NO_PROVEN_BLOCKER` 不可达并推翻 9 个既有用例。
2. G-01 / G-02 的阻塞不是「还没做」，是**现有审计路径里没有这条数据通道**。任何解法都要动公共输入面。
3. G-04 的图割证明以「全部参与判定的几何 `checked`」为前提；G-01 不成立时 G-04 自动不成立 ⇒ `PROVEN_UNPLAYABLE` 不可达。

---

## G-01 Hitbox 来源可信

**判据（PRD）**：碰撞几何必须来自真实 Asset Pack 帧与可信 Manifest；必须验证帧几何与 Manifest 一致；不得只信任调用方的 hitbox / body / 尺寸声明；无法确认 ⇒ `INSUFFICIENT_EVIDENCE`。

**现状**

- `AssetPackManifest`（`assetpack.ts:265`）只有资产级 `size` / `anchor`（`:171-175`）与图集尺寸、帧数（`:257-260`）；逐帧 `frame` / `sourceSize` / 帧级 `anchor` 只在 `atlas-json.ts:35-48`。
- `verifyPack`（`ops.ts:1918-1960`）只证字节 == `files[]`；`manifestChecksumOf`（`publish-gate.ts:30-38`）只钉 manifest 字节。
- 逐帧比对只存在于 pack acceptance（`acceptance.ts:296-358,604-690`），**零生产消费者**。
- **条件式比对**：帧 `anchor` 的比对以「atlas 提供 anchor」为前提（`acceptance.ts:341`）；删除帧 anchor 仍 `verifyPack` PASS + acceptance CLEAN（I00-02 实验 pack-d）。
- acceptance 只证包内自洽：一致重写 atlas + `manifest.asset.size` + `files[]` 可通过（实验 pack-c2）。
- `profile.ts:18-25,92-97` 因此把帧来源几何标 `partial`。

**正例**：pack 通过 `verifyPack` + acceptance，且 manifest/atlas 身份匹配、anchor 存在、验收后未改写、审计与运行时同一对 manifest/atlas ⇒ 帧几何可升级为「已证明事实」。

**负例（全部落 IE）**：缺失帧、帧数不符、`sourceSize` 不符、anchor 不符或**缺失**、trim/rect/PNG 异常、重名帧、pack 未验收、验收后改写、调用方伪造 hitbox/body/尺寸。

**测试落点**：I-01 单测（contracts + assets）；I-04 负向；现成 scratch 探针 `scripts/geometry-provenance-probe.mjs`、`scripts/geometry-mutation-probe.sh` 可复用为夹具设计输入。

**状态**：**BLOCKED** —— 取得帧几何的四条路径（读 atlas / acceptance 证据 / 扩展 manifest / 调用方传入并复验）都需 R1 选型、R2 授权。

---

## G-02 Lag 来源明确

**判据**：`lagMs` 必须显式输入或来自明确、可审计、可信的配置；保留两档敏感性；不得把研究假设当成实测生产延迟；无法建立假设 ⇒ IE。

**现状**

- `phaser@3.90.0` 未漂移；默认 `minFps=5` ⇒ `_min=200ms`（`TimeStep.js:99,174`）⇒ `smoothDelta` 截断（`:576-585`）。
- 200ms 只是**单次 `scene.update` 的 game-time delta 上界**，不是墙钟帧间隔、不是实测延迟。
- auditor **无任何可达 lag 输入**：`FixedRuntimeProfile`（`profile.ts:37-47`）无时间字段、`GameConfig` 无 fps、`auditPlayability` / `auditConfigPipeline` 无参数。
- 代码里唯一帧常量是 `FRAME_MARGIN_MS = 1000/60`（`mechanic.ts:62`，用于 `:226,:245`）——**第二套、不一致的假设**。
- 扩展面：最小 = contracts + 输出（3–4 文件）；全链 = 9–10 文件（contracts / assets / pipeline / cli / mcp）。无需新依赖。

**正例**：显式 `lagMs` + 两档（16.67ms 标称 / 200ms 源码上界）+ 证据记录来源与解释；缺失即 IE。

**负例**：缺 `lagMs`、非正数、单位不明、用 `FRAME_MARGIN_MS` 隐式填充、把 200ms 宣称为实测值 ⇒ IE 或拒绝。

**测试落点**：I-01 单测；I-04 负向；敏感度可用 `scripts/lagms-sensitivity.mjs` 复算。

**状态**：**BLOCKED** —— 无输入通道；R1 决定「必填 / 默认」与两档含义，R2 授权扩展面。

---

## G-03 时间行为确定

**判据**：运动相位与时间模型必须可确定；未知相位、隐藏页面时间行为、无法解释的时间变化不得参与确定性证明；明确支持范围；无法证明 ⇒ IE。

**现状**

- 权威 `t=0` = 场景 `create()`（`scene.ts:161`），每帧 `t0 += delta`（`:272`）；`create` 由异步图集加载回调触发，**比首帧渲染早一帧**。
- 首帧可见相位是 `P(delta₁)`，`delta₁ ∈ [0, 200ms]`——上界可证，具体值不可测（U8 收紧）。
- 相位本身是确定的；**真正缺失的量是玩家抵达时刻 `T_arr`**，它不在 config / pack 里。
- 隐藏期间：无补帧、无跳变（`Game.js:592`、`TimeStep.js:468-514`）；但 RAF 派发次数不可从仓库确认（**U1 未解除**）。
- **U9（新增，未实现）**：只要「存在可达的安全等待格」成立，`T_arr` 相位可取满 `[0, period)`；该前提可由 config + manifest 判定。
- 「拒绝相位不确定的关卡」即今天的行为（`mechanic.ts:119` ⇒ IE）。

**正例**：相位当自由变量 + U9 前提可判定 ⇒ 确定性分析合法；或调用方提供可信 `T_arr`。

**负例**：墙钟相位判据、假设首帧具体相位、依赖隐藏期间行为、相位不可确定且无安全等待格 ⇒ IE。

**测试落点**：I-02 边界测试；I-04 负向。

**状态**：**NEEDS-RULING** —— PRD FR-07 写「运动周期或相位未知 ⇒ IE」，实现语义应映射为「`T_arr` 相位不可确定且无安全等待格 ⇒ IE」。R1 必须裁这条映射，否则实现与 PRD 字面冲突。

---

## G-04 垂直规避必须有真实证据

**判据**：不得相信调用方的 `verticalEvasionImpossible`；必须根据可信几何与受支持的玩家运动模型判断；不能证明不存在 ⇒ 不得 PU；需要精确跳跃/下落/重力时序的场景不支持。

**裁定（I00-10，2026-11-09）**

- 主证明：**V1 图割**——恒覆盖门区作 forbidden region，起点终点不连通 ⇒ 无垂直规避。正当性来自 `graph.ts:26-30` 的「模型往玩家更强那一侧偏」。
- 快速路径：结构化满高门。
- `hop` 只作**可达性上近似**，不消费时间维度。
- 门区按玩家几何外扩、**不带 lag pad**。
- **三条同时成立才 PU**：门区恒覆盖 + 全部参与判定的几何 `checked` + 图割不连通。

**正例**：上述三条同时成立 ⇒ `PROVEN_UNPLAYABLE`。

**负例**：任一几何 `partial` / `unknown`；图仍连通；门非正宽度；存在可达绕行；调用方只给布尔标记 ⇒ IE。

**测试落点**：I-02 单测（图割 + 满高门）；I-04 负向。

**状态**：**NEEDS-RULING**，且**依赖 G-01**——几何可信度门槛不满足时，本门槛无法满足，PU 不可达。

---

## G-05 运动模型边界严格

**判据**：仅支持单个 X 轴移动 Hazard；不支持多 Hazard 联合、移动平台、精确跳跃时序、下落与重力时序、未建模状态转换；模型外输入必须显式降级，不得静默近似。

**现状**：P0 原型 12/12 覆盖了 y 轴、多 hazard、预算耗尽、缺 lag、相位/命中体不确定等边界。

**正例**：单 x 轴、参数合法、输入确定 ⇒ 进入分析。

**负例（全部 IE）**：y 轴、多个移动 hazard、moving platform、danger 联合、非 `cycle` motion、未建模状态转换。

**测试落点**：I-02 单测；I-04 负向。

**状态**：**SATISFIABLE**。

---

## G-06 判定语义受限

**判据**：保留 V1 三态；只有正宽度永久封锁门可作为新增的确定性不可玩证明；瞬时阻塞、短时无法通过、找不到路径 ≠ 永久不可玩；`NO_PROVEN_BLOCKER` ≠ 可玩保证；`INSUFFICIENT_EVIDENCE` 不得被提升。

**现状**

- 三态类型在（`verdict.ts:26-29`）；但 `aggregateLayer` 的 `coverage` 入参**从不被读取**（`verdict.ts:110-114`），顶层只读层 verdict（`api.ts:87-92`）。
- `coverage.spatial` 在 39/39 fixture 恒 `partial`；9 个 NB 用例 9/9 带 partial。
- 真实形状 `pit-chest-with-reset-hazard`：三层全 NB、gaps 全空、spatial+mechanic partial、整关仍 NB。
- 13 个 IE 用例中 11 个整关 `evidence` 为空——降级原因在上层丢失。

**正例**：PU 只来自门；NB 必须携带 coverage，且 coverage 约束**按维度**定义。

**负例**：把 IE 当 PU；把 NB 当可玩保证；**全局 `partial ⇒ IE`**（会推翻 9 个既有用例）；用 coverage 掩盖降级原因。

**测试落点**：I-03 集成测试；I-04 回归。

**状态**：**BLOCKED** —— 契约语义未定；R1 必须设计按维度的 coverage 约束，不能沿用全局规则。

---

## G-07 生产集成独立验收

**判据**：P0 原型不得直接作生产实现；独立测试与代码审查；执行 V1 回归；验证构建、打包、现有审计流程；证明旧静态关卡行为不回退；保留可审计的输入、结果与证据。

**现状**

- 未开始（属 I-01～I-05）。
- LP-06 / LP-07 **只有 scratch 脚本，无 vitest**；「V1 完整回归」的实际覆盖面比名字窄。
- 审计结果不落盘（`api.ts:62`）；issue 映射无 `code`（`api.ts:113-118`）；`ConfigIssue.code` 封闭集合只有 3 值（`game-config.ts:300-317`）。
- 可审计性今天只能落在：内存返回值、测试矩阵、scratch 证据、冻结文档。

**正例**：I-04 提供完整回归证据（既有测试 + 语料复跑 + 负向）；I-05 提供真实关卡 Pipeline 验收。

**负例**：把 P0 原型直接搬进生产；放宽 LP-02～LP-05；无回归证据就宣称「旧行为不变」；用 grep 式断言代替测试。

**测试落点**：I-04（负向 + 回归）；I-05（Pipeline 验收）。

**状态**：**SATISFIABLE**（流程层面），但「可审计证据」的正式落点需 R1 裁定。

---

## 8. 跨门槛依赖

```
G-01 ──→ G-04 ──→ G-06
  └────→ G-03 ──→ G-06
G-02 ──→ G-06
G-05 ──→ G-06
所有 ──→ G-07
```

- **G-04 依赖 G-01**：图割的 soundness 取决于几何是否完整可信。
- **G-06 依赖 G-01/G-02/G-03**：三态的每一态都要能说明它建立在什么可信输入上。
- **G-07 覆盖全部**：任何一条门槛未满足，I-04 的验收都不能通过。

## 9. I-01～I-05 落位

| 阶段 | 承担门槛 |
| --- | --- |
| I-01 可信输入与几何来源 | G-01、G-02、G-03（输入验证 + 降级） |
| I-02 时序判定核心 | G-03、G-04、G-05（模型 + 稳定性） |
| I-03 现有体系集成 | G-01（证据传递）、G-06（语义） |
| I-04 负向与回归 | 全部七项负例 + V1 回归 |
| I-05 Pipeline 验收 | G-07 |

## 10. 不可绕过的执行规则

1. 不得用调用方声明替代证据（G-01 / G-04）。
2. 不得把 BLOCKED 写成「尽量满足」；未解阻塞项只能以「阻塞 / 改 PRD / 缩范围 / 停」结束。
3. 不得放宽 LP-02～LP-05 或 publish-gate 测试来换取集成通过。
4. 不得因「找不到 witness / 预算耗尽 / 采样未撞」输出 `PROVEN_UNPLAYABLE`。
5. 每一项门槛的负例必须在 I-04 有对应用例，且默认期望是 `INSUFFICIENT_EVIDENCE`。

## 11. 证据索引

- [I00-01 审计语义与 coverage 缺口](01-audit-semantics.md)
- [I00-02 AssetPack 几何证据来源](02-geometry-provenance.md)
- [I00-03 相位与时间起点](03-phase-time-origin.md)
- [I00-04 lagMs 来源](04-lagms-source.md)
- [I00-06 性能取证与预算](06-performance.md)
- [I00-05 裁定](../issues/06-i00-05-continuous-tolerance.md)
- [I00-10 裁定](../issues/08-i00-10-vertical-evasion-proof.md)
