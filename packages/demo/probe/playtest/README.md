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
- `site-integrity.json` —— 运行前后站点字节哈希；用于证明外壳零改动。
- `determinism.json` / `summary.json` / `exit.json`（在 out 根）。

## 场景契约

`scenarios/five-state/` 是票 02 的首版五场景（一态一个）。契约是 `playtest-scenario/v1` 的 JSON：
版本绑定（目标 site 版本）、语义动作、断言三值、终止条件、时限、可比较事件。
`success-basic` 是交付必需场景；`failure-missing-pickup` / `limitation-wide-patrol` 是覆盖/诊断场景
（`required:false`，故意注入失败/限制，不进交付命令的必需场景集）；`env-no-chrome` / `timeout-hang`
是 harness 条件场景（同样 `required:false`）。

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
