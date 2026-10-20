# 01 · 把最终资源包集成进本地可玩站点（2026-10-20）

零付费施工。**0 张生图 · 0 次文本上游 · 0 条 ledger。**
输入包：`runs/2026-10-20d-groundline/ruin-scavenger-extraction-assets/pack/v6/`（03 定稿）。

## 路线：手写 config（零上游）

- 票面允许两条路：`compile-runtime`（文本上游 1–3 发，需预算 + 逐字点头）或**手写 config（零上游）**。
- 本票**没有**文本上游授权，因此走手写：按原始设计 `runs/2026-10-18d/.../game-design.json`
  的 level-01 意图（向右推进 / 跳跃 / 拾取 / 抵达撤离点）摆了一关。
- ⚠️ 一关一份 config（`game-config/v1` 的定义）⇒ 本次只装配 **level-01 风格的集成关**；
  level-02 / 03 不在本票（需要的资源已在同一包里）。

## 产物

| 东西 | 路径 |
| --- | --- |
| 关卡配置（起点视角） | `runs/2026-10-20e-site/game-config.json` |
| 关卡配置（中后段视角，只改 `player.at`） | `runs/2026-10-20e-site/game-config-mid.json` |
| 站点 v1 | `runs/2026-10-20e-site/out/ruin-scavenger-extraction-assets/site/v1/` |
| 站点 v2 | `runs/2026-10-20e-site/out/ruin-scavenger-extraction-assets/site/v2/` |
| 站点根（HTTP server 的根） | `runs/2026-10-20e-site/out/ruin-scavenger-extraction-assets/` |
| 包副本 | 同目录 `pack/v6/`（`laySite` 拷入；89MB，**out/ 被 .gitignore 忽略**） |

装配命令：

```bash
node packages/cli/dist/cli.mjs site \
  .scratch/asset-integration-v1/runs/2026-10-20d-groundline/ruin-scavenger-extraction-assets/pack/v6 \
  --config .scratch/asset-integration-v1/runs/2026-10-20e-site/game-config.json \
  --out .scratch/asset-integration-v1/runs/2026-10-20e-site/out
```

起服务（本次实测）：

```bash
python3 -m http.server 8765 --directory .scratch/asset-integration-v1/runs/2026-10-20e-site/out/ruin-scavenger-extraction-assets
```

- URL：`http://127.0.0.1:8765/site/v1/index.html`（起点）/ `.../site/v2/index.html`（中后段）
- 装配校验：三族 + 几何 + HUD 屏幕空间**全过**；包 `verifyPack` ok（19 资源 / 61 动画帧 / 34 色）。

## 资源可见性（19 / 19 都进了场景）

| 资源 | 在关卡里 | 证据 |
| --- | --- | --- |
| `scavenger-actor` | 玩家；`idle` 起始、`run` / `jump` 由键盘驱动 | `cdp-a/b`（idle 两帧差 7130px）· `cdp-run.png` · `cdp-jump.png` |
| `wasteland-enemy` | 中段 `patrol` 危险物（周期运动） | `screenshot-v2.png` |
| `ceiling-lurker` | 三只悬挂 decor：`hang` / `lunge` / `retreat` | `screenshot-v1/v2.png` 顶部 |
| `scrap-resource` | 两件 pickup（`idle`）；`cdp-run` 里第一件已拾取 | `screenshot-v1/v2.png` · `cdp-run.png` |
| `clean-water` | pickup（`idle`） | `screenshot-v1/v2.png` |
| `hazard-terrain` | 中段 hazard | `screenshot-v1/v2.png` |
| `collapsed-floor` | 右侧浮空 solid | `screenshot-v2.png` |
| `extraction-point` | 终点 goal（`active`） | `screenshot-v2.png` 右侧 |
| `tile-floor` | 左侧浮空 decor | `screenshot-v1.png` |
| `metal-platform` | 中段 solid | `screenshot-v1/v2.png` |
| `vent-duct` | 左侧悬挂 decor | `screenshot-v1.png` |
| `concrete-step` | 左侧台阶 solid | `screenshot-v1.png` |
| `wooden-crate` | 中段 solid | `screenshot-v1/v2.png` |
| `office-debris` | 起点 decor | `screenshot-v1.png` |
| `broken-wall` | 终点前 decor | `screenshot-v2.png` |
| `ruined-city-backdrop` | 三层背景（skyline / blocks / street） | 全部截图 |
| `hud-panel` | 左上 HUD 面板 | 全部截图 |
| `scrap-icon` | HUD pip（拾取前隐藏；`cdp-run` 拾到第一件后点亮） | `cdp-run.png` |
| `health-icon` | 净水上方的 decor | `screenshot-v1/v2.png` 左侧 |

**未播放的动画 clip**：`wasteland-enemy.charge/halt`、`extraction-point.standby` ——
配置的一个实体只选一个 `anim`；本次选了 `patrol` / `active`。帧都在包里（61 帧不变），
要展示另一路就改那一格的 `anim` 再装配一次（零上游）。

## 运行时观察

- 页面加载：Phaser v3.90.0（**Canvas** 渲染器，headless Chrome 没有 WebGL），
  `[shell] v2 · 视口 480×270 · 世界 640×270 · 4 张图集`。
- 唯一 404：`/favicon.ico`（站点没有 favicon；不是资源）。
- 一条预期警告：`hud.panel` 在 Canvas 下不支持九宫格，面板退回普通拉伸 —— **面板可见**，
  这是外壳里写明的 Canvas 回退（`scene.ts` 的 `canNine` 分支）。
- 动画在跑：`cdp-a.png` 与 `cdp-b.png` 相隔 900ms，**7130 个像素不同**（idle / 巡逻 /
  悬挂 / 撤离点动画）。
- 键盘驱动：CDP 发 `ArrowRight` / `Space`，玩家进入 `run` / `jump`，相机跟随，
  拾取后 HUD pip 点亮（`cdp-run.png` / `cdp-jump.png`）。

## 证据

- `screenshot-v1.png` —— 起点视角（480×270 世界，2× 放大）。
- `screenshot-v2.png` —— 中后段视角（同一关，`game-config-mid.json` 把玩家起点挪到 x=560）。
- `cdp-a.png` / `cdp-b.png` —— 无输入、相隔 900ms 的两帧（动画证据）。
- `cdp-run.png` / `cdp-jump.png` —— 键盘驱动的跑 / 跳；HUD pip 已点亮。
- `console.txt` / `network-failures.txt` —— 控制台与失败请求。
- `drive-cdp.mjs` —— 驱动与截图的 CDP 脚本（Chrome `--remote-debugging-port=9222`）。
- `harness.html` 在 `out/` 里（被忽略）；事件注入没生效，最终证据用 CDP。

## 边界 / 未做

- 未改 `game-maker.local.json`；未改包内容；未跑生图；未发任何文本上游。
- 未装配 level-02 / 03；未跑 `compile-runtime`（它要付费文本上游，本票不预授权）。
- 站点产物在 `out/`（.gitignore 忽略）；配置、截图、报告在 run 目录入库。
