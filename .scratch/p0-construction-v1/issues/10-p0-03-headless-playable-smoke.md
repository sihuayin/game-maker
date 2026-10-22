# 10. P0-03 · 可玩性 headless smoke

Type: task
Status: resolved
Owner: main session · 2026-10-22
Blocked by: 07
Map: ../map.md

## Question

新增**最小** headless 浏览器 smoke：真实启动站点、注入状态感知输入、验证拾取与胜利可达。
对应 `CAP-QA-07`，范围见 `docs/v4/P0-00-p0-scope.md` §3 P0-03。

- 优先复用 W6 的 CDP 脚本思路（系统 Chrome 155 + CDP），**不新增 Playwright / Puppeteer 依赖**；
  若确需新依赖，按 Q5 交逐项清单获批后才动。
- 流程：启动本地静态服务 → 打开站点 → 注入**状态感知**的移动 / 跳跃
  （读 x / y / onFloor / blockedRight / collected，不写死时序）→ 断言至少一个 pickup 被收集 →
  到达 gate → `won=true`。
- 用 fixture pack + config（优先 v7 + 已验收 config）离线运行；零付费。
- 负例：`objective.gate` 指错 / 拿掉一个 pickup / 破坏输入 ⇒ smoke 必须红，并指出失败阶段。
- **票 07 的软锁专项用例**（票 06 §6.3）：「木箱顶起跳 → 空中撞 hazard → 重置」后连续采样 30 帧，
  断言 `body.bottom <= floorY + 1`、`onFloor` 变真、`won` / `collected` 不变；**重复触发两次**脚线相同。
- 命令：新增独立 `pnpm test:playable`（Q8 A）；默认 `pnpm test` 保持无浏览器依赖；
  最终验证票必须跑它。浏览器不可用时**失败并记录**，不得静默跳过成绿。

## 验收

- 正常 fixture：启动、移动、跳跃、至少 1 个 pickup、到达 gate、`won=true`；exit 0。
- 负例三类各自非 0，并指出失败阶段。
- 运行记录：命令、Chrome 版本、站点目录、截图 / 轨迹路径、耗时；零付费。
- 与票 07 的软锁复现共用同一驱动或至少同一状态读取方式。
- `pnpm test` / `pnpm typecheck` 全绿（`test:playable` 单独跑）。

## 边界

- 不做视觉质量 / 风格相似度判断；不做全机制 / 难度 / 多关覆盖；不引入 CI 重构；
  不改变站点运行时行为（只加验收）。
- 状态感知优先，不接受固定 `sleep` 时序；超时 / 重试策略必须在票内写清。
- 不改 v7 包与 `fixtures/`；测试产物写 `.scratch/p0-construction-v1/runs/`；不提交。

## 产出

`## Answer`：脚本位置、`pnpm test:playable` 实际运行结果（含 Chrome 版本与耗时）、
正例 / 负例证据路径、状态读取接口说明。

## Answer

**已收口（施工）** —— 新增最小 headless 可玩性 smoke，真实启动站点、状态感知输入、
拾取 3/3 并到达 gate；三类负例各自非 0 且指出失败阶段；票 07 的软锁专项两次重置均通过，
旧实现负例按预期红。零付费、无新依赖、未改站点运行时、未提交。

### 交付物

- `packages/demo/probe/playable-smoke.mjs`：CDP 驱动 + 静态服务 + 场景与断言（唯一新增代码）。
- 根 `package.json`：新增 `"test:playable": "pnpm build && node packages/demo/probe/playable-smoke.mjs"`。
  默认 `pnpm test` 仍零浏览器依赖（Q8 A）。
- **无 contracts / CLI / MCP / 新依赖变更**；`pnpm-lock.yaml` 未动。
- **未改站点运行时**：状态读取靠 CDP 注入的只读探针；`hazard-legacy` 的旧实现只在页面会话内
  猴子补丁，`packages/demo/src/` 未改。

### 目标与状态读取

- 默认目标：已验收的 v7 包
  `.scratch/asset-integration-v1/runs/2026-10-20f-lurker/ruin-scavenger-extraction-assets/pack/v7/`
  + 配套 `.scratch/asset-integration-v1/runs/2026-10-20e-site/game-config.json`；可用
  `--pack/--config` 或 `PLAYABLE_PACK/PLAYABLE_CONFIG` 覆盖。装配用 `assembleSite`（与 CLI 同一份代码）。
- 状态读取与 W6 的 `play.mjs` / `repro-hazard.mjs` 同一手法：`window.Phaser` setter 上挂 Proxy，
  把游戏实例存进 `window.__gmGame`；`READ_STATE` 读 `player.x/y`、`body.bottom/top/left/right`、
  `vx/vy`、`onFloor`、`blockedRight/touchingRight`、`collected`、`won`、`pickups`、`hazards`、
  `gate`、`solids[]`。输入全由状态决定（被挡 / 脚下没地 / 前方 hazard / 高处 pickup / 卡住 ⇒ 跳；
  抬高面按平台右缘起跳；平台下方 pickup 走下去捡），没有写死的玩法时序。

### 实际运行（2026-10-22）

| 命令 | 退出码 | 结果 |
| --- | --- | --- |
| `pnpm test:playable` | **0** | `playable` 6.6 s：3/3 pickup、`won=true`；`hazard-reset` 10.3 s：两次重置 × 30 帧，脚线 250.00 / 250.00，`collected/won` 不变；`hazard-legacy` 5.4 s：按预期红（`bottom` 379.50 > 251.00、`onFloor` 未变真） |
| `pnpm test:playable --negative gate` | **1** | 装配期 `invalid` 拒绝（`assemble` 阶段），不产站点 |
| `pnpm test:playable --negative pickup` | **1** | 运行时拿掉 1 个 pickup ⇒ 到 gate 但 `won=false`（`win` 阶段，2/3） |
| `pnpm test:playable --negative input` | **1** | 拦截 `ArrowRight` ⇒ x 始终 40.0（`move` 阶段） |
| `pnpm test` | **0** | **1810 passed / 119 files** |
| `pnpm typecheck` | **0** | 全包通过 |
| `pnpm check:deps` | **0** | 依赖图合法（9 个包） |

Chrome **155.0.8059.85** · Node v22.23.2 · 站点 `out/ruin-scavenger-extraction-assets/site/v1/`
（负例各自另装 v2/v3）· 零上游 / 零付费。v7 `manifest.json` sha256
`e620cd7e…38326`、config sha256 `35384eca…0406b`；源包与 `fixtures/` 未改。

### 超时 / 重试（票面要求）

不自动重试，失败即报阶段。`playable` 45 s；`hazard-reset` 每次 30 s、恰好两次；
`pickup` 30 s；`input` 7 s；场景启动 15 s、出生落地 8 s；Chrome 端口 / target 各 15 s；
轮询 35 ms、按键保持 50 ms。浏览器或构建产物缺失 ⇒ 写 `summary-<mode>.json` 后退出 2，
不静默跳过成绿。

### 证据

`.scratch/p0-construction-v1/runs/2026-10-22-ticket-10/`：
`run.md`（命令 / 退出码 / 环境 / 边界）、`playable.txt`、`negative-*.txt`、`negative-*.exit`、
`summary-{positive,gate,pickup,input}.json`、各场景 `result.json`（含轨迹）、
截图（`playable/00-start.png`、`pickup-1/2/3.png`、`won.png`；`hazard-reset/reset-1/2.png`；
`hazard-legacy/reset-1.png`；`negative-pickup/pickup-1/2.png`；`negative-input/fail-timeout.png`）。

### 诚实边界

- 最小核心循环：只证启动 + 移动 + 跳跃 + 拾取 + 胜利；不覆盖视觉质量 / 难度 / 多关 / 全机制。
- 只覆盖横版 `game-config/v1`；塔防归 P2。
- `gate` 负例在装配期被上游校验拒绝，证明「不会被静默放过」，不是运行时 `won` 路径；
  运行时「到 gate 但 collected 不足 ⇒ 不 won」由 `pickup` 负例覆盖。
- `hazard-legacy` 是**测试内**的旧实现补丁，不是对 HEAD 的回滚；它的红证明该专项有判别力。
- 依赖系统 Chrome；无浏览器环境按票面记为失败，不静默跳过。
- `pnpm test` 仍会泄漏 `gm-cli-accept-findings-*`（~89 MB/次，map Notes 既有问题，不在 P0 范围）；
  本次产生的 8 个已清理，票 11 全量跑后仍需看磁盘。
- 本票未提交、未推送；停在等待单独授权状态。
