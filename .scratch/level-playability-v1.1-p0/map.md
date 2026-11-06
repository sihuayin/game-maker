# Level Playability V1.1 P0：移动 Hazard 时序可达性预研

Labels: wayfinder:map
Tracker: local-markdown
Effort: level-playability-v1.1-p0
Baseline: `wayfinder/level-playability-v1` @ `34db62b20a8fdc5dbe9bd25a05b20cfa67296040`；PRD `docs/v7.8/可玩1.md` @ `sha256:37bab0a85739b22069b22a6927df9d917d8fd78fa2c4d14fb4f6edac0628ad72`
Status: open · 2026-11-06 开图
Predecessor: [Level Playability V1 P1](../level-playability-v1-p1/map.md)（已收口）

> **2026-11-06 开图。** 授权来源：[`docs/v7.8/可玩1.md`](../../docs/v7.8/可玩1.md)（Level Playability V1.1 — P0）。
> 本图按 Notes「执行覆盖」**承载执行**：不是只做决策，而是实际完成 P0-01～P0-03 的研究、原型、测试与三案例对照，产出结论包。
> 终点由最后一张 HITL 票裁定；裁定前不得关图，也不得启动正式集成。

## Destination

完成 P0-01～P0-03，并交付一份**可信的技术可行性结论包**：

1. 移动 Hazard 的 Runtime 时序语义增量报告（已确认 / 未确认两栏）；
2. 针对单个移动 Hazard 的最小时序算法原型及独立单元测试；
3. A/B/C 三案例的配置、真实 Runtime 运行记录与判断对照报告；
4. 回答 PRD §6 六个问题的总结，并提出 **GO / CONDITIONAL GO / NO-GO** 建议；
5. 由用户在最后一张 HITL 票作出最终裁定。

终点是「时序可达性是否值得做、能做到什么程度」的证据化结论，**不是**更多生产代码，**不是**正式集成方案。

## Notes

### 执行覆盖（本图承载执行）

- Wayfinder 默认「只做决策、不做交付」；本图按用户 2026-11-06 裁定覆盖为**承载执行**，沿用 `level-playability-v1-p1` 先例。
- 本图**只**做 `docs/v7.8/可玩1.md` 授权的 P0-01～P0-03；任何越界（Runtime / 公开契约 / CLI / MCP / Pipeline / Publish Gate）即停止。
- 每张执行票的 `## Answer` 必须记录：命令、退出码、产物路径、commit SHA、回退点。
- 复核票只产出裁定记录，不产生产品代码 commit；复核未通过时，后续票保持 blocked。

### 权威与冻结输入

- **PRD（只读冻结）**：[`docs/v7.8/可玩1.md`](../../docs/v7.8/可玩1.md)，`sha256:37bab0a8…`。
- **前序图**：[Level Playability V1](../level-playability-v1/map.md)（已关闭）、[P1 实施](../level-playability-v1-p1/map.md)（已收口）。
- **Runtime 语义基线**：[LP-00 报告](../level-playability-v1-p1/research/01-runtime-semantics.md) —— **只作为冻结基线引用**；移动 Hazard 特有语义必须逐条核验当前代码，LP-00 没有明确回答的不得写成已确认。
- **现有机制判据**：`packages/contracts/src/playability/mechanic.ts:119` 把所有带 `motion` 的 hazard 落 `moving-hazard-phase` gap → `INSUFFICIENT_EVIDENCE`；本图不得修改该生产路径。
- **试玩 harness**：`packages/demo/probe/playtest/`（无头 Chrome / CDP 只读探针 / 11 类事件 / trace / input）；`READ_STATE` 已暴露 hazard 的 `x/y/t0/hits` 与真实碰撞盒。
- **领域词汇**：`CONTEXT.md` 是唯一权威；本图不新增同义词。

### 开图裁定（用户，2026-11-06）

本图经两轮 grilling，Q1–Q8 全部按推荐方案裁定：

1. **Q1 终点**：(a) 执行承载图；必须实际完成研究、原型、测试和三案例对照。
2. **Q2 GO 后续**：不继续集成规划；GO 只给推荐范围与前置条件，随后关图。
3. **Q3 P0-01**：增量核验；LP-00 作为冻结基线，只核验移动 Hazard 特有语义。
4. **Q4 Runtime 对照**：(c) 两者都要；A/B 以无头 Chrome + 真实 Phaser Runtime 为主证据，纯函数模拟器只服务算法单测；C 不强制跑 Runtime。
5. **Q5 effort 与分支**：`wayfinder/level-playability-v1.1`；slug `level-playability-v1.1-p0`；执行分支 `p1/level-playability-v1.1-p0`；产物落 `.scratch/level-playability-v1.1-p0/`。
6. **Q6 复核门槛**：三张独立 HITL 复核票（P0-01R / P0-02R / P0-03R），硬阻断，不通过则后续票保持 blocked。
7. **Q7 案例夹具**：(a) 受控合成夹具 + 既有语料 sanity；A/B/C 使用独立合成夹具；6 份既有移动 hazard config 只作附加验证，不作验收门槛。
8. **Q8 原型形态**：(a) `.mjs` + Node 22 `node:test`，JSDoc 标注类型；不进入 `pnpm test`、不改 `package.json`。

补充锁定：

- A/B/C 合成夹具放在本 effort 目录；使用 `fixtures/packs/last-train` 生成 scratch 站点；**不得修改**既有 fixture 或历史配置。
- P0-03 复用现有 playtest harness，**不新增站点观察字段**；若现有 trace 无法提供必要证据，停止并提交 P0-03R 裁定，不得静默扩展。
- 模拟器不能宣称与真实 Runtime 等价。

### 复核门槛

- `P0-01 → P0-01R → P0-02 → P0-02R → P0-03 → P0-03R → P0-04`
- 复核票只产出裁定记录；未通过、要求补证或暂停时，后续执行票不得启动。
- 不得用 agent 自评代替人工批准；最后一张票由用户裁定 GO / CONDITIONAL GO / NO-GO。

### 分支与产物

- 图与票：`wayfinder/level-playability-v1.1`（本分支）。
- 执行：`p1/level-playability-v1.1-p0`（由 P0-00 从本图 tip 切出）。
- 产物：`.scratch/level-playability-v1.1-p0/`，至少包含 `map.md`、`issues/`、`evidence/`、`prototype/`、`cases/`。
- 不混入已经关闭的 `level-playability-v1` effort；不修改 `run/**`、`pack/**`、`site/**`、`fixtures/**` 与既有验收证据。

### 证据与验收

- **E1**：源码 / 契约 `file:line`。
- **E2**：单元测试名 + 断言 + 退出码。
- **E3**：零付费真实 Runtime 运行或合成夹具复跑（命令、路径、计数、trace / events）。
- A/B 的主证据来自真实 Phaser Runtime；B 的「不可玩」结论必须由算法证明支撑，有限时间试玩失败**不能单独**证明不可玩。
- C 必须明确落 `INSUFFICIENT_EVIDENCE`，不得把模型边界误判为不可玩。
- 不改现有三态语义；超时 / 状态耗尽不得解释为 `PROVEN_UNPLAYABLE`。

### 停止线与硬边界

- **零付费**：不调用模型、不生图、不重建付费站点、不产生新付费 Demo。
- **Runtime 只读**：不改 `packages/demo/**` 行为；不新增 EntityKind / Motion / 机制 / 斜坡碰撞。
- **不接生产**：不改 `packages/contracts` 生产判据、不接 Pipeline / Publish Gate、不改 CLI / MCP 参数、不新增持久化 schema、不新增第三方依赖。
- **不放宽测试**：LP-02～LP-07 既有测试不得放宽。
- **不推送、不合并、不绕过 PR 审查**。
- 原型与模拟器不进生产包、不进现有 CI；`.mjs` + `node:test` 只在 scratch 内运行。

### 票流

1. [P0-00 Effort 初始化](issues/01-p0-00-effort-init.md)（task，AFK）— **resolved**
2. [P0-01 移动 Hazard Runtime 增量语义核验](issues/02-p0-01-moving-hazard-semantics.md)（research，AFK）— open · **frontier**
3. [P0-01R 语义证据复核](issues/03-p0-01r-semantics-review.md)（grilling，HITL）— open · blocked by 02
4. [P0-02 最小时序模型与独立原型](issues/04-p0-02-temporal-model-prototype.md)（prototype，HITL）— open · blocked by 03
5. [P0-02R 模型健全性复核](issues/05-p0-02r-model-review.md)（grilling，HITL）— open · blocked by 04
6. [P0-03a 合成案例与 scratch 站点](issues/06-p0-03a-case-fixtures.md)（task，AFK）— open · unblocked（frontier，位列 02 之后）
7. [P0-03 A/B/C 三案例验证与真实 Runtime 对照](issues/07-p0-03-case-validation.md)（task，AFK）— open · blocked by 05, 06
8. [P0-03R 案例证据复核](issues/08-p0-03r-evidence-review.md)（grilling，HITL）— open · blocked by 07
9. [P0-04 结论包与 HITL 裁定](issues/09-p0-04-verdict.md)（grilling，HITL）— open · blocked by 08

## Decisions so far

- [P0-00 Effort 初始化](issues/01-p0-00-effort-init.md): 执行分支 `p1/level-playability-v1.1-p0` 自图 tip `a82165c` 切出；冻结输入与边界见 [`evidence/00-baseline.md`](evidence/00-baseline.md)。

## Not yet specified

- **最小时间状态模型的精确形态**：等待边、时间离散化 / 区间表示、证明义务的精确写法。依赖 P0-01R 冻结「可采信的 Runtime 语义集合」后才能定。
- **A/B 在现有 playtest harness 下能否完整取证**：尤其 B 的「始终封锁」必须由算法证明，试玩失败不算；依赖 P0-03a 的站点与场景构造结果。
- **若结论为 GO / CONDITIONAL GO，正式集成的推荐范围与前置条件如何表述**：依赖 P0-03R 的三案例证据；本图只写推荐，不产出集成方案。

## Out of scope

- **Moving Platform、多移动 Hazard 联合、多 Danger 联合、Hazard 与目标的复杂组合判定**：PRD §4 明确不做。
- **Gameplay QA 改造、Pipeline / Publish Gate 集成、CLI / MCP 参数或公开契约修改**：PRD §4 / §7 明确不做；本图只做独立预研。
- **Runtime 行为修改、新增 EntityKind / Motion / 机制 / 斜坡碰撞**：Runtime 只读。
- **修改现有三态语义、放宽 LP-02～LP-07 测试**：PRD §5 硬约束。
- **修改历史 run / pack / site / fixtures / 冻结证据**：只读。
- **新增第三方依赖、任何付费调用**：零付费、零新依赖。
- **正式集成方案与集成代码**：用户 Q2 裁定；GO 也只给推荐范围与前置条件，集成另开 effort。
