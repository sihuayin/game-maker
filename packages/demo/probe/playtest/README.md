# Playtest V1 harness（票 07）

这是 Playtest V1 的**观测层**：加载声明式场景契约，驱动无头 Chrome，把状态快照差转成
结构化事件 / 断言三值 / 规范化证据，落 `result.json` 与旁证文件。

⚠️ **本层不做五态归因**（票 08）：`result.json` 里的 `outcome` / `aggregate` 可以缺席；
归因由 08 从证据独立计算。⚠️ **本层不写交付报告**：`delivery.playtest` / 写回由 08 做。
⚠️ **外壳零改动**：只通过 CDP 注入只读探针（`READ_STATE` / `PHASER_HOOK`），不写站点字节。

## 用法

```bash
# 前置：pnpm build
node packages/demo/probe/playtest/playtest.mjs \
  --site <out>/<gameId>/site/v<N> \
  [--pack <out>/<gameId>/pack/v<N>] \
  [--scenario-dir packages/demo/probe/playtest/scenarios/five-state] \
  [--out <目录>] [--repeat 2] [--json]
```

- `--site` 只接受实际 `site/v<N>` 目录；pack 从 `site.json` 的 `pack` 解析，config 用 site 里的那份。
- `--repeat 2` 会跑两个 attempt，比较**规范化投影**（断言三值 / 离散终态 / 场景声明可比较的事件计数）；
  位置、时间戳、事件顺序、截图不参与比较。
- 退出码：`0` = 至少一个场景 executed 且（repeat 时）投影一致；`1` = 未执行或不一致；
  `4` = 没有可执行场景（版本/绑定拒绝，见 `rejections.json`）。

## 产物

每次运行写 `attempt-v<K>/`：

- `result.json` —— `playtest-report/v1`：身份绑定、逐场景执行/断言/终态/事件计数、运行配置。
- `events.jsonl` —— 11 类闭事件；`source` 为 `poll`（状态差）或 `cdp`（harness 捕获的错误）。
- `trace.jsonl` —— 状态快照；不是输入轨迹。
- `input.jsonl` —— 实际发出的按键（`type/key/code/t/seq/source`）；只作诊断。
- `console.json` / `exceptions.json` / `setup.json` / `chrome.log`。
- `strategy.json` —— **非契约 sidecar**：停止原因 / 阈值 / 最后观测，以及 `pickup-unreachable` 等策略注解；
  不扩 `events.jsonl` 的 11 类闭事件、不改报告 schema。
- `site-integrity.json` —— 运行前后站点字节哈希；用于证明外壳零改动。
- `determinism.json` / `summary.json` / `exit.json`（在 out 根）。

## 场景契约

`scenarios/five-state/` 是票 02 的首版五场景（一态一个）。契约是 `playtest-scenario/v1` 的 JSON：
版本绑定（目标 site 版本）、语义动作、断言三值、终止条件、时限、可比较事件。
`success-basic` 是交付必需场景；`failure-missing-pickup` / `limitation-wide-patrol` 是覆盖/诊断场景
（`required:false`，故意注入失败/限制，不进交付命令的必需场景集）；`env-no-chrome` / `timeout-hang`
是 harness 条件场景（同样 `required:false`）。

⚠️ **执行策略会"等"**（FA-02，2026-10-28）：`move_to` / `reach_goal` 不只是"按住右键直到到达"——
前方有横向巡逻危险物时，策略会在巡逻带外沿**松开右键等待**安全相位，再按实时几何/相位起跳越过；
等待/恢复都走同一按键通道，记在 `input.jsonl`。场景协议不变；物理量取自被验收游戏自己的
`player.move`，危险物盒足迹由只读 `READ_STATE` 提供。

⚠️ **三类危险形态（04，2026-10-28）**：横向巡逻沿用 FA-02；**纵向巡逻**（`axis:"y"`）按危险物的
**完整扫掠范围**判相关性（不是当前帧），在「盒底高于玩家头顶」的窗口 ≥ 穿越时间 + 150ms 时才前进，
**不要求起跳**；**定时喷发**按 `t % (periodMs + activeMs)` 推演，`periodMs` 是安全窗口、`activeMs`
是喷发窗口，安全余量 150ms，观测到 `state:"active"` 时绝不进入；多个喷发物逐一路径推演。
字段缺失时：纵向保守带外等待、喷发退化为 state-only（观测到 idle 才进）、连 state 都没有则不穿越；
注解 `vertical-window-unknown` / `danger-window-unknown` 只落 `strategy.json` 的 `notes`
（非契约 sidecar，不进 11 类闭事件，不扩 schema）。等待同样受 120 步 `wait-limit` 约束。
`READ_STATE` 对 `dangers` 只读暴露打击盒足迹 + `periodMs` / `activeMs` / `t`。

⚠️ **有限终止（票 05）**：策略不会无限等/无限跳。连续 **300** 观测步无复合进展
（`maxX` / `collected` / `chestsOpened` / `gateReached` / `won` 任一严格增加即进展）、累计 **5** 次重置、
连续 **120** 步 `advance:false`、或跳跃被证明无效（3 步内未离地连续 3 次 ⇒ 降级；累计 5 次且跳跃是唯一
推进手段）时，执行器**主动停止**：`terminationReached=false`，`result.json` 的场景记
`stop: { reason, atStep }`（`no-progress` / `reset-exhaustion` / `wait-limit` / `jump-exhaustion`），
归因判 `AGENT_LIMITATION` —— **不是游戏失败，也不是场景超时**。被中断动作仍记 `outcome:"timeout"`，
由 `stop.reason` 消歧。`atStep` 是 `trace.jsonl` 的累计观测步；最后观测见 `strategy.json`。
harness 条件场景（`hang` / `input-blocked`）不套用这套规则。

⚠️ **拾取物可达性（票 05）**：`pickupAbove` 只在「单跳包络 + 平台几何」证明可达时起跳；不可达时跳过但
在 `strategy.json` 记 `pickup-unreachable`（拾取物下标 + 缺失几何），不静默。所有起跳前都做
`jumpPredictionSafe`。必需目标不可达时如实归因（`AGENT_LIMITATION` / `TIMEOUT`），不判游戏失败。

## 不在本目录

- 五态归因器（`attribute` / `InsufficientEvidence` 决策表）→ 票 08。
- `delivery.playtest` 写回、`game-maker playtest` CLI、smoke 退役与
  `hazard-legacy` / `gate` / `pickup` / `input` 负例迁移 → 票 08。
- 基线比较与真实产物验收 → 票 09。

## 自测（票 10）

`self-test.mjs` 是 harness 自测，**不进五态交付场景集**：`gate`（装配期拒绝）· `pickup`（初始态 pickup 缺失）·
`input`（按键阻断走不动）· `hazard-legacy`（旧 `hitHazard` 猴子补丁仍被 reset-floor 抓住）。
它复用 `probe-harness.mjs` 的 CDP/Chrome，不复制第三套浏览器基础设施。

```bash
pnpm test:playtest   # 自测 + 离线五态/写回/基线测试
```
