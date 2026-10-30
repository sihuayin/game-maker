# hazard 真实正向断言：事件、场景与契约

Type: grilling
Status: resolved
Blocked by: （无）

## Question

HITL：`hazard-contact` 当前既无 probe、也无运行时命中事件；`hitHazard()` 只把玩家复位，不计数、不发事件（`packages/demo/src/shell/scene.ts:352-359`）。Playtest 事件闭集有 `danger-hit / danger-erupt / reset`，没有 `hazard-hit`（`packages/contracts/src/playtest.ts:69-75`）。请裁定：

1. **正向断言的落点**
   - (a) 新增 `hazard-hit` 事件 + 运行时命中计数；场景断言 `hazard-hit >= 1` 且 `reset >= 1`。属于 Playtest 事件闭集扩展。
   - (b) 不扩事件闭集；用现有 `reset` 事件 + 只含 hazard 的场景做归因断言 `reset >= 1`。语义弱一档，但零契约变更。
   - (c) 只加浏览器 probe `hazard-contact`，用 probe 的样本证明复位；Playtest 不加正向断言。
   - (d) (a) + (c)：事件与 probe 都补。
2. **场景形态**：新增一个**独立诊断场景**（`required:false`，在阶段 A 证据运行中显式执行），还是把 hazard 断言并入默认必需场景？后者会让默认 playtest 依赖一次刻意碰撞。
3. **契约批准**：若选 (a)/(d)，是否批准 Playtest 事件闭集新增 `hazard-hit`（并同步 `runner.mjs`、`observe.mjs`、证据一致性检查）？

已知事实：冻结 wasteland config 有 2 个 hazard（`patroller-1/2`）、0 个 danger；设计未声明 `hazard-contact`；现有 `self-test.mjs` 的 hazard-legacy 是猴子补丁旧实现，不是当前实现的正向用例。

建议（待裁定）：**1(a) + 2 独立诊断场景 + 3 批准**。理由：用户要求「真实、明确」；`hazard-hit` 把「碰到」与「被复位」分开，避免 `reset` 被 danger 或环境因素混淆；诊断场景不污染默认 happy path。

产物：票内 Answer + 追加裁定；未裁定前不写生产代码。

## Answer

**2026-10-29 HITL 收口。** 逐字裁定见 [rulings-2026-10-29.md 第 5 节](../rulings-2026-10-29.md)。

### 已定契约

| 项 | 决定 |
|---|---|
| 断言落点 | **probe-only**：只加浏览器 probe `hazard-contact`；不扩 Playtest 事件闭集、不新增诊断场景、Playtest 暂不加 `hazard-hit` 正向断言 |
| 运行时 | `packages/demo/src/shell/scene.ts` 给 hazard 条目加命中计数，overlap 时递增；`probe-harness.mjs` 的 `READ_STATE` 暴露 `hazards[*].hits` |
| probe | `mechanic-probe.mjs` 新增 `hazard-contact`；`QA_PROBED_MECHANICS` 同步加入，保持 probe 清单与闭集一致 |
| 合成 config | 玩家 spawn x=40、静止 hazard x=160、无 danger；按住右键走进 hazard |
| 断言 | ① `hazards[0].hits >= 1`；② 命中后某采样帧 `x` 回到首帧 `x` 的 ±5px（证明复位）；③ 无 console.error / 未捕获异常；命中次数用 `>=1`，不要求恰好一次 |
| 冻结 Demo E3 | effort-local 脚本（`.scratch/p0-02-second-demo-v2/tools/`，复用 `probe-harness.mjs`），以**只读快照**为 pack/config 输入，装配与运行产物写本 effort `runs/` |
| 冻结触发 | 原样使用冻结 config：按住右键至进入巡逻带（x≈360–380）或已命中，松开后等待一个 3s 周期；命中后应复位到 spawn（x≈40）。只有实测相位不可控时才允许诊断变体，且必须在证据中标记偏离原因 |
| E3 记录 | 生产 probe 全量/`--only hazard-contact` + 冻结脚本的命令、退出码、路径、Chrome/shell/pack 身份；快照运行前后逐文件 sha256 复核；诊断碰撞**不进**正式交付证据清单 |
| 批准例外（Q5 边界内） | ① scene hazard 命中计数；② READ_STATE 暴露 hits；③ `hazard-contact` probe；④ `QA_PROBED_MECHANICS` 增加 `hazard-contact`。不改 Playtest 事件闭集、场景 schema、证据完整性规则、MCP |

### 实现义务（已回写下游票）

- [hazard 断言实施](../issues/09-hazard-assertion-implementation.md)：先红测试、命中计数、READ_STATE、probe、闭集、冻结脚本、E2/E3 证据。
