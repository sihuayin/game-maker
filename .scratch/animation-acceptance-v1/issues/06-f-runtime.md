# 06. F · 游戏运行时与集成验证路径

Type: task
Status: resolved
Owner: research 子代理 · 2026-10-21
Blocked by: —
Map: ../map.md

## Question

核实 HEAD 的最小运行时验证路径：

`资源版本 → 游戏配置 → 启动命令 → 资源加载 → 动画播放 → 验证证据`

分两半执行：

1. **静态**：读 `packages/demo/src/{site,assemble,world,draw}.ts`、`packages/pipeline/src/*.ts`、
   CLI `create` / `build` / `site`、运行时 shell（`packages/demo/dist/shell.js` 或源）、
   Phaser 的资源加载与动画播放、错误处理、资源路径与打包规则。回答任务书 §4.6 的 10 个问题中
   可由静态证据回答的部分。
2. **运行**：仅使用现有 `site/v3`
   `.scratch/asset-integration-v1/runs/2026-10-20e-site/out/ruin-scavenger-extraction-assets/site/v3/`。
   按 README 要求，以 `pack/` 与 `site/` 的**父目录**为 HTTP 根启动本地静态服务器；
   用 CDP 驱动（参考 `.scratch/asset-integration-v1/runs/2026-10-20e-site/drive-cdp.mjs`）
   加载站点、触发 `scavenger-actor` idle、截图并保存控制台 / 运行时日志，
   证明「动画确实播放」而不只是资源加载成功。
   证据只写 `.scratch/animation-acceptance-v1/runs/2026-10-21-runtime/`。

## 验收

- 最小运行时验证路径逐步状态：已实现并验证 / 已实现未运行验证 / 部分实现 / 尚未实现 /
  因环境限制无法验证。
- 实际命令、退出码、截图 / 日志路径；若站点缺失或跑不起来，记录 `unverified` 的确切原因，
  不得把「没跑」写成「通过」。
- 回答：如何启动最小可玩游戏、资源包如何被加载、是否有固定动画测试场景、
  能否程序触发指定动画、能否确认动画确实播放、是否有自动截图 / 录屏、能否保存运行时错误日志、
  是否覆盖或修改已有产物、是否依赖人工、现有基础设施是否足以承载 Phase 1 集成验证。
- 明确动画播放的关键断链（如 `fps` / `loop` 是否被运行时读取）；W2 / W6 只作线索，在 HEAD 复验。

## 边界

- **只用现有 `site/v3`；不重装站点、不写 `out/`；不重建或覆盖任何已有产物。**
- 不修改 `game-maker.local.json`；零付费；不发起任何生图 / 文本上游。
- 允许起本地 HTTP 服务器与 CDP；结束后必须关闭所有进程。
- 允许读现有 `dist/`；禁止 `pnpm check` / `pnpm build`。
- 不写 `map.md`；只写本票、`research/f-runtime.md` 与 `runs/2026-10-21-runtime/`；不提交。

## 产出

`research/f-runtime.md` + `runs/2026-10-21-runtime/`（截图 / 日志 / 驱动脚本副本）。
完成后在本票追加 `## Answer`（10–20 行摘要），`Status: resolved`。

## Answer

- **一句话**：最小运行时路径在现有 `site/v3` 上真实跑通；**播放本身 `implemented`（已用截图/帧采样/drawImage 三路验证）**，但 `fps`/`loop` 在 manifest→runtime 断链（`missing`），固定动画场景与公开触发入口 `missing`/`partial`，整体基础设施对 Phase 1 为 `partial`。
- **启动**：HTTP 根 = `pack/` 与 `site/` 的父目录；`python3 -m http.server 8791` → `site/v3/index.html` **200**（`README.md:77-84`；`runs/2026-10-21-runtime/run-log.txt`）。Chrome 155 headless + CDP；站点与包资源全 200，唯一 404 是 favicon（`network.json`）。
- **播放证据**：`scavenger-actor.idle` 4 帧按 ~168ms 循环（124 个 20ms 采样，`samples-idle.json`）；玩家局部连拍去重 **4 帧**（`11-idle-player-00..09.png`、`analysis.json`）；Canvas `drawImage` 轨迹 4501 次，帧名全映射，换帧 ~167ms（`draw-trace.json`）。
- **程序触发**：CDP 合成 `ArrowRight`/`Space` 触发 `run`/`jump`（`samples-run.json`、`samples-jump.json`、`20-run-full.png`、`22-jump-full.png`）；但 `entry.ts:75` 丢弃 `new Phaser.Game`，`Phaser.GAMES` 不存在，必须注入 `Phaser.Game.prototype.boot` 才能拿到 scene。
- **关键断链**：manifest 有 `fps`/`loop`（`assetpack.ts:157-162`），`world.ts:138-153` 只带帧名，`scene.ts:140,193` 硬编码 `frameRate:8` / `6|10` 与 `repeat:-1`。实测 `ceiling-lurker.lunge`（manifest 14fps/loop:false）以 ~127ms（8fps）**无限循环**；`jump`（10fps/loop:false）以 ~168ms 循环回第 1 帧。W2-G04 在 HEAD 成立（`runtime-summary.json`）。
- **固定场景**：`missing` —— 只有一个 `shell` scene，无 URL/fixture 选择动画的入口；`site/v3` 只是临时观测场。
- **证据/日志/自动化**：站点不产截图/日志；本轮用 CDP 采集（`console-events.json` 无异常，仅 hud 九宫格 warning）。仓库无 playwright/puppeteer、无 CI；录屏 `missing`，CDP 截图 `partial`，运行时错误落盘 `partial`。
- **非破坏性**：`find site/ pack/ -newermt "2026-10-21"` 为空，mtime 仍 `2026-10-20 14:53:15`；`site/v3/shell.js` 与 `packages/demo/dist/shell.js` 哈希同为 `620adfa5...6860`；server/Chrome 已关（8791/9333 无监听）。
- **Phase 1 判断**：骨架可复用（站点/配置/加载/真实播放），但需补：运行时读 `fps`/`loop`、正式测试入口/固定最小场景、仓库内 CDP 探针、证据 manifest 绑定 site/pack 版本+哈希。详见 `research/f-runtime.md` §7。
