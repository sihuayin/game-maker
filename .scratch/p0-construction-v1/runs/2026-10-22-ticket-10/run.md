# 票 10 · P0-03 可玩性 headless smoke —— 运行记录（2026-10-22）

零付费。**0 次生图 / 0 次文本上游 / 0 次视觉模型 / 0 条 ledger。**
只读使用已验收的 v7 包与配套 config；站点装配产物写本目录 `out/`（`out/` 被 .gitignore 忽略）。

## 输入（只读）

| 东西 | 路径 / 哈希 |
| --- | --- |
| 资源包 | `.scratch/asset-integration-v1/runs/2026-10-20f-lurker/ruin-scavenger-extraction-assets/pack/v7/` |
| `manifest.json` sha256 | `e620cd7eed22dda5b2316a70db006b0a84a1b6d58853f4733f1abaeeffd38326` |
| config | `.scratch/asset-integration-v1/runs/2026-10-20e-site/game-config.json` |
| `game-config.json` sha256 | `35384eca2e3cc0c88d0b07b7a68f4ff70514826db864228f37927e28cbdd406b` |
| 外壳 | `packages/demo/dist/shell.js`（`pnpm build` 产出，外壳 v2） |

> 本票没有改 v7 包、没有改 `fixtures/`、没有改 `game-maker.local.json`。
> `assembleSite` 把包**拷入** `out/ruin-scavenger-extraction-assets/pack/v7/`，源包不动。

## 环境

| 项 | 值 |
| --- | --- |
| Chrome | Google Chrome **155.0.8059.85**（`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`） |
| Node | v22.23.2（内置 `fetch` / `WebSocket`，**不新增依赖**） |
| 站点 | `out/ruin-scavenger-extraction-assets/site/v1/`（正例；负例各自另装 v2/v3） |
| HTTP server 根 | `out/ruin-scavenger-extraction-assets/`（`/site/v1/index.html`） |

## 命令与退出码

| 命令 | 退出码 | 结果 |
| --- | --- | --- |
| `pnpm test:playable --out <本目录>` | **0** | 正例 + 软锁专项 + 旧实现负例全绿 |
| `pnpm test:playable --negative gate --out <本目录>` | **1** | 按预期在 `assemble` 阶段失败 |
| `pnpm test:playable --negative pickup --out <本目录>` | **1** | 按预期在 `win` 阶段失败 |
| `pnpm test:playable --negative input --out <本目录>` | **1** | 按预期在 `move` 阶段失败 |
| `pnpm test` | **0** | 119 files / **1810 passed** |
| `pnpm typecheck` | **0** | 全包通过 |
| `pnpm check:deps` | **0** | 依赖图合法（9 个包） |

日志：`playable.txt`、`negative-{gate,pickup,input}.txt`、`pnpm-test.txt`、`pnpm-typecheck.txt`、`pnpm-check-deps.txt`（提交副本；原始 `.log` 被 `.gitignore` 的 `*.log` 忽略，`chrome.log` 同）。
退出码另存：`negative-{gate,pickup,input}.exit`。

## 正例 / 专项明细

| 场景 | 耗时 | 结果 |
| --- | --- | --- |
| `playable` | 6.6 s | 启动 → 向右移动 → 跳跃 → **3/3 pickup** → 到 gate → `won=true`（x=545.0） |
| `hazard-reset` | 10.3 s | 「木箱顶起跳 → 空中撞 hazard → 重置」**连续两次**；每次重置后连续采样 **30 帧**：`body.bottom ≤ floorY+1`、`onFloor` 变真、`collected/won` 不变；两次静止脚线均为 **250.00**（不累积下沉） |
| `hazard-legacy` | 5.4 s | 把 `hitHazard` 在**本次页面会话**里换回旧实现（`setPosition` + `setVelocity(0,0)`）⇒ 30 帧检查按预期红：`body.bottom` 最大 **379.50 > 251.00**、`onFloor` 未变真 |

正例汇总：`summary-positive.json`（含完整轨迹）。截图：`playable/00-start.png`、`pickup-1/2/3.png`、`won.png`；专项：`hazard-reset/reset-1.png`、`reset-2.png`、`hazard-legacy/reset-1.png`。

## 负例明细

| 负例 | 注入方式 | 阶段 | 证据 |
| --- | --- | --- | --- |
| gate 指错 | config 的 `objective.gate` 改成不存在的 id ⇒ 装配期 `auditGameConfig` 拒绝（`invalid`），不产站点 | `assemble` | `summary-gate.json`、`negative-gate/result.json` |
| 拿掉 pickup | **运行时**在页面里 `destroy()` 首个 pickup（不改 config，避免连 `pickupCount` 一起变小）⇒ 拾取 2/3，到 gate 也不 `won` | `win` | `summary-pickup.json`、`negative-pickup/result.json`、`pickup-1/2.png` |
| 破坏输入 | `Page.addScriptToEvaluateOnNewDocument` 注入捕获阶段 keydown 拦截 `ArrowRight` ⇒ x 始终 40.0 | `move` | `summary-input.json`、`negative-input/result.json`、`fail-timeout.png` |

## 状态读取接口

不改进站点运行时。驱动用 CDP 在页面里注入一个**只读探针**：

1. `Page.addScriptToEvaluateOnNewDocument` 在 `window.Phaser` 的 setter 上挂 Proxy（与 W6 的
   `play.mjs` / `repro-hazard.mjs` 同一手法），构造游戏时把实例存进 `window.__gmGame`；
2. 每次读状态执行 `READ_STATE`，从 `__gmGame.scene.getScene('shell')` 读：
   `player.x/y`、`body.bottom/top/left/right/width/height`、`vx/vy`、`onFloor(blocked.down)`、
   `blockedRight/touchingRight`、`collected`、`won`、`pickups[]`、`hazards[]`、`gate`、
   `solids[]`（静态组每个 body 的 x/y/w/h）、`cameras.main.scrollX`。
3. 输入全部是状态感知：被挡 / 脚下没地 / 前方 hazard / 高处 pickup / 原地卡住 ⇒ 跳；
   抬高面上按**平台右缘**起跳；平台下方有 pickup 时走下去捡；平台自身范围内的 hazard 提前跳。
   **没有写死的玩法时序**（只有 35 ms 轮询、50 ms 按键保持两个小常数）。

## 超时 / 重试策略（票面要求写清）

- **不自动重试**。每个场景跑一次；失败即报阶段与原因，由证据保留现场。
- `playable`：总预算 **45 s**；场景启动 **15 s**；出生落地稳定 **8 s**；按键轮询 35 ms。
- `hazard-reset`：每次触发重置 **30 s**；恰好触发两次；重置后 30 帧（`requestAnimationFrame`，50 ms 兜底）。
- 负例 `pickup`：30 s；负例 `input`：7 s（故意短，走不动应在 `move` 阶段尽快红）。
- Chrome：DevTools 端口 15 s、页面 target 15 s；拿不到即**失败并记录**（不跳过成绿）。
- 浏览器缺失 / 构建产物缺失 / 包或 config 缺失：写 `summary-<mode>.json` 后退出 **2**。

## 既有问题（不在本票）

- `pnpm test` 的 CLI `accept` 负例仍会 `mkdtempSync` 一个 ~89 MB 的
  `gm-cli-accept-findings-*` 目录且不清理（map Notes 已登记，票 07 也记录过；测试卫生不在 P0 范围）。
  本次 `pnpm test` 产生的 **8 个**泄漏目录已按票 07 同样方式清理；全量测试后仍需看磁盘。

## 诚实边界

- 这是**最小核心循环** smoke：只证「启动 + 移动 + 跳跃 + 拾取 + 胜利」；
  不覆盖视觉质量、风格相似度、难度、多关、全机制。
- 只覆盖横版 `game-config/v1`；塔防（`td-config/v1`）归 P2。
- 默认目标绑定已验收的 v7 包 + 配套 config（票面「优先 v7 + 已验收 config」），
  可用 `--pack/--config` 或 `PLAYABLE_PACK/PLAYABLE_CONFIG` 覆盖；不覆盖本目录外的站点。
- `gate` 负例在**装配期**就被上游校验拒绝，因此它证明的是「不会被静默放过」，不是运行时 `won` 路径；
  运行时「到 gate 但 collected 不足 ⇒ 不 won」由 `pickup` 负例覆盖。
- `hazard-legacy` 的旧实现只在 CDP 会话内猴子补丁，站点产物与运行时源码都没有改动。
- 依赖系统 Chrome；无浏览器环境按票面记为失败，不静默跳过。
- 本票**不提交、不推送**；证据停在等待单独授权状态。
