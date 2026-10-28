# 04 危险形态通用化（横向 / 纵向 / 定时喷发）

Type: task
Status: resolved
Assignee: claude
Blocked by: 03

## Question

按 03 的裁定实现三类危险形态的通用策略，并用确定性 fixture 验证「状态驱动」而非「坐标脚本」。

范围：

- `packages/demo/probe/playtest/policy.mjs`：危险物模型（横向 / 纵向）、定时喷发决策、保守回落。
- `packages/demo/probe/probe-harness.mjs`：`READ_STATE` 对 `dangers` 只读暴露盒足迹 + `periodMs` + `activeMs` + `t`（Q7(b)）；复用 FA-02 对 `hazards` 的几何定义，不产生第二套。
- `packages/demo/probe/playtest/tests/policy.test.mjs`（或同目录新增测试）：周期边界、活动窗口、状态切换、纵向巡逻、字段缺失/非法周期的保守回落。
- 现有 `tests/{policy,observe,scenarios}.test.mjs` 与 `pnpm test:playtest` 保持绿。

硬边界：

- 不改游戏 Runtime、`GameConfig`、站点字节、`SHELL_VERSION`、游戏契约。
- 不写死本关坐标 / hazard id / 固定时间；物理量取自被验收游戏自己的 `player.move`。
- `t` 的使用必须基于审计过的语义（场景启动毫秒、命中不复位、重载归零）；不能可靠解释时退回 `state` 决策。
- 不改 `avoid-danger` probe，也不把它当周期证据。

## 03 裁定（已锁定，2026-10-28）

- **纵向巡逻**：复用三角波相位模型；相关性按**完整扫掠范围**判定（不得沿用只看当前帧的 `verticalOverlap`）；「盒底高于玩家头顶」的垂直安全窗口 ≥ 穿越时间 + 余量才过；整周期无窗口 → 等待，超 120 步 → `wait-limit`；通过纵向危险**不要求起跳**。
- **定时喷发**：用 `t + periodMs + activeMs + d.box` 推演；安全余量 ≥ 2×(poll+step) ≈ 150ms；`state==="active"` 绝不进；多个 danger 逐一路径推演。
- **回落阶梯**：缺 `box`/`t`/`periodMs`/`activeMs` 或非法 → 只用观测到的 `state`（idle 才进），trace 记 `danger-window-unknown`；缺 `state` → 不穿越 + 等待上限。该标记**不得**加入 `events.jsonl` 的 11 类闭集，也不得扩契约。
- 本票关闭 01 的 gap 1/2 与测试 gap 12；不得改站点/Runtime/GameConfig/`SHELL_VERSION`。
- 验收测试：纵向相关性/窗口/无窗口/字段缺失回落；danger 窗口/active 禁入/回落/多 danger；现有 policy/observe/scenarios 与 `pnpm test:playtest` 保持绿。详见 [03 的 Answer](03-gap-triage-and-strategy-ruling.md#answer)。

## Answer

**2026-10-28 已收口。** 按 03 锁定的判据实施三类危险形态；零付费、不改 Runtime / 站点字节 / `GameConfig` / `SHELL_VERSION` / contracts schema，不删测试、不降阈值，不改 `avoid-danger` probe。

### 一、只读观测（Q7(b)）

- `packages/demo/probe/probe-harness.mjs` 的 `READ_STATE` 对 `dangers` 新增只读字段：
  `left/right/top/bottom/width/height`（来自游戏自己的打击盒 `d.box`，不是精灵 body）、
  `periodMs`、`activeMs`、`t`；原有 `state` / `hits` / `x` / `y` 保留。
- `hazards` 的几何定义未改，仍复用 FA-02 的 READ_STATE 盒足迹；没有第二套观测通道。
- 语义按审计结果使用：`t` 是场景启动后的毫秒累计（`scene.ts` `d.t += delta`；命中复位不重置、重载归零）；
  `periodMs` 是安全窗口、`activeMs` 是喷发窗口，完整周期 = 两者之和。

### 二、策略（`packages/demo/probe/playtest/policy.mjs`）

- **纵向巡逻（03 Q2）**：`hazardModel` 现接受 `axis:"x"|"y"`；锚点语义横向 = 精灵中心 x、纵向 = 盒底（资源锚点 `{0.5,1}`），由 `start = 观测锚点 - k·distance` 反推起点与相位。
  - 相关性用 `verticalSweepOverlap` 的**完整扫掠范围**（`sweepTop`/`sweepBottom`），不沿用只看当前帧的 `verticalOverlap`。
  - 穿越窗口：`kMax = (玩家头顶 - 锚点起点) / 行程`；三角波头尾各一个安全窗，窗口 ≥ 穿越时间 + `SAFETY_MARGIN_MS`（150ms）才前进；通过纵向危险**不要求起跳**。
  - 整周期无窗口 ⇒ 等待；等待受 120 步 `wait-limit` 约束。
  - 缺 `distance`/`periodMs`/`t0`/几何 ⇒ 保守带外等待，不猜窗口；`vertical-window-unknown` 只落 `strategy.json` 的 `notes`（非契约，一次性）。
- **定时喷发（03 Q3）**：`dangerModel` 用打击盒足迹；`dangerIdleThroughout` 按 `t % (periodMs + activeMs)` 推演，安全区 = 每周期 `[0, periodMs)`，穿越区间两端各留 150ms；`dangerPathSafe` 从当前位置按玩家速度**逐一路径推演**多个 danger，任一不满足即等待。
  - `state === "active"` 时绝不进入（观测优先于推演）；缺 `box`/`t`/`periodMs`/`activeMs` ⇒ 退化为 state-only（观测到 `idle` 才进）+ `danger-window-unknown`；连 `state` 都没有 ⇒ 不穿越。
- **共存**：三类形态分别决策后取「全部允许前进才前进」；纵向/喷发在场时不跳（跳跃不是这两类形态的规避手段）。横向分支保持 FA-02 原逻辑不变。
- `a` 类注解（`vertical-window-unknown` / `danger-window-unknown`）只进 `strategy.json` 的 `notes`，**不进** `events.jsonl` 的 11 类闭集，不扩报告 schema。

### 三、验收对照（03 的 04 清单）

| 项 | 证据 |
|---|---|
| `hazardModel` 接受 `axis:"y"`、拒绝缺字段；由观测反推锚点/相位 | `tests/danger-forms.test.mjs`（1 条） |
| `READ_STATE` 端到端暴露 dangers 盒足迹 + 周期相位；hazards 几何未变 | 同上（2 条，直接求值 READ_STATE） |
| 扫掠范围相关性（当前在高处、但会扫到玩家高度 ⇒ 相关） | 同上（1 条） |
| 纵向可行窗口 ⇒ 前进；不要求起跳 | 同上（2 条，含速度缩放） |
| 纵向无窗口 ⇒ 等待；等待 120 步 ⇒ `wait-limit` | 同上（2 条） |
| 纵向缺字段 ⇒ 保守等待 + `vertical-window-unknown`（一次性） | 同上（1 条） |
| danger 窗口 ≥ 穿越 + 150ms ⇒ 进；余量不足 ⇒ 等 | 同上（2 条） |
| 推演落入 active / 观测 active ⇒ 绝不进 | 同上（2 条） |
| 缺字段 ⇒ state-only + `danger-window-unknown`；缺 state ⇒ 不穿越 | 同上（2 条） |
| 多 danger 逐一路径推演（任一不满足即等待；都能过则前进） | 同上（2 条） |
| 现有 policy/observe/scenarios/termination 与 `pnpm test:playtest` 保持绿 | 见下 |

**回归**：`pnpm test` **147 files / 2207 tests passed，exit 0**；`pnpm typecheck` **exit 0**；
`pnpm test:playtest` **exit 0**（self-test 4/4：gate / pickup / input / hazard-legacy + 10 files / 143 tests）。
证据：`.scratch/generic-playtest-v1/evidence/04-regression.json`（含 5 个改动文件 sha256）。
自测运行后已 `git restore` tracked 自测产物并删除本次生成的两个 `strategy.json`；历史产物零改动。

### 四、给 06 的事实

- 冻结 wasteland Demo 的配置只含 `axis:"x"` 巡逻物（`patroller-1` 340/100/3000、`patroller-2` 720/120/3500），
  **没有 `axis:"y"` 与 `danger` 实体** ⇒ 本轮对真实 Demo 的决策路径等价于 FA-02（纵向/喷发分支不会命中）。
- `jumpPredictionSafe` 的「附近危险物」过滤改为按完整扫掠带（横向）与扫掠范围（纵向），比旧版更保守；
  对上述两只地面巡逻物，其旧当前帧 ±220 过滤与扫掠带覆盖范围重叠，预期不改变真实通关路径。
- harness/rules 仍为 v2（本票未改版本）；06 的继承比对继续按 v1 基线不可比披露。
- 若 06 真实运行需要纵向/喷发证据，本票只提供 E2 fixture；报告必须按 03 的口径披露「纵向/喷发仅 fixture」。

### 五、限制

- 纵向/喷发路径只有确定性 fixture 证据（E2），真实浏览器样本由 06 覆盖；本轮按 Q9(a) 只跑冻结 Demo 一次真实试玩（06）。
- 纵向窗口按三角波连续解 + 150ms 余量估算，轮询抖动已含在余量里；未做逐帧真实物理闭环。
