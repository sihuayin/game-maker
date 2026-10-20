# 01. 把最终资源包集成进本地可玩站点

Type: task
Status: resolved
Owner: claude (2026-10-20 认领 · 已施工、已关)
Blocked by: —
Map: ../map.md
> 派生自 style-migration-v1 的最终包。
> ⚠️ 本票只批准**免费搜索 / 本地装配**；`compile-runtime` 若走文本上游，须先出预算 + 逐字点头。

## Question

用最终包 + 原始设计，走 `compile-runtime` / `site`，启动一个本地站点，确认资源在真实外壳里可见。

- 先**免费**找现成的 `game-config`（原 run / `out/` / 旧站点），能复用就不发文本上游。
- 若必须 `compile-runtime`：它需要 `ANTHROPIC_BASE_URL` / `AUTH_TOKEN` 与**一次文本调用**
  （可能 1–3 发，0 张图）；先出书面预算报告 + 逐字点头，再发。
- 站点根目录按 CLI 警告：HTTP server 的根必须是 `<out>/<gameId>/`，不是 `site/` 内部。

## 验收

- 本地站点能打开；资源（动画 / 精灵 / 背景 / UI）在场景中可见，或明确说明为什么不可见。
- 截图 / URL / 使用的 config 路径落盘。
- 0 张生图；文本调用（若有）逐笔记账。

## 边界

- 不改 `game-maker.local.json`；不改包内容；不跑生图。
- 文本上游的付费动作须单独点头；本票不预授权。

## Comments

### 2026-10-20 · 免费搜索：没有现成 config

- 扫了 `out/` 与 `.scratch/` 下的 `game-config*.json`：找到的都属于 `last-train` / probe 等，
  **没有**与 `runs/2026-10-18d/ruin-scavenger-extraction-assets/run/v1/game-design.json`
  （残城拾荒）或最终包匹配的 `game-config`。
- ⇒ 站点集成要么走 `compile-runtime`（文本上游 1–3 发、0 张图，需书面预算 + 逐字点头），
  要么手写一份 config（零上游，但要按最终包的 19 个资源逐项对）。
- 本票仍 **未发任何上游请求**。

### 2026-10-20 · 06 收口后的包指针

- 站点集成应使用 **策展包 v4**：
  `.scratch/asset-integration-v1/runs/2026-10-20a-olive-palette/ruin-scavenger-extraction-assets/pack/v4/`
  （34 色 = 32 提取 + 2 策展；v1 仅作对照）。
- 票 01 的免费搜索结果不变：仍没有现成 `game-config`。


### 2026-10-20 · 03 收口后的包指针

- 03 已收口；站点集成改用 **v6**：
  `runs/2026-10-20d-groundline/ruin-scavenger-extraction-assets/pack/v6/`
  （v4 的 34 色 + 地面线清理；`verifyPack` ok · 61 动画帧 · 0 上游）。
- v5 是 03 的中间候选（差 idle4 一个像素），不在站点里用。

## Answer（2026-10-20 · 施工完成）

**路线：手写 `game-config/v1`（零上游）**。`compile-runtime` 要文本上游（1–3 发，需预算 + 逐字点头），
本票没有那份授权；免费搜索也没有现成 config。⇒ 按原始设计的 level-01 意图手写一关，
用 v6 包跑 `site`。

### 产物

- 配置：`runs/2026-10-20e-site/game-config.json`（起点视角）与
  `game-config-mid.json`（同关；只把玩家起点挪到 x=560，用于让右半段资源进画面）。
- 站点：`runs/2026-10-20e-site/out/ruin-scavenger-extraction-assets/site/v1/` 与 `site/v2/`；
  **HTTP server 的根** = `runs/2026-10-20e-site/out/ruin-scavenger-extraction-assets/`。
- URL（本次实测）：`http://127.0.0.1:8765/site/v1/index.html` / `.../site/v2/index.html`。
- 装配：三族 + 几何 + HUD 屏幕空间**全过**；包 v6 `verifyPack` ok（19 资源 / 61 动画帧 / 34 色）。

### 验收读数

- **19 / 19 资源都进了场景**：玩家（idle/run/jump）、巡逻敌人、三只潜伏者（hang/lunge/retreat）、
  两件废料 + 净水、危险地形、塌落楼板、撤离终端（active）、7 张导入精灵、三层背景、HUD 面板、
  废料 pip、生命图标。逐项清单见报告。
- 动画在跑：无输入相隔 900ms 的两帧差 **7130 像素**；CDP 键盘驱动下玩家进入 run / jump，
  拾取后 HUD pip 点亮（`cdp-run.png` / `cdp-jump.png`）。
- 页面只有一条预期警告（Canvas 下 HUD 九宫格回退，面板可见）与一个 `/favicon.ico` 404；
  **没有资源 404**。
- **0 张生图 · 0 次文本上游 · 0 条 ledger**；未改 `game-maker.local.json`、未改包内容。

### 未做 / 边界

- 只装配 level-01 风格的集成关；level-02 / 03 未装配（一关一份 config）。
- 未跑 `compile-runtime`（付费文本上游，未授权）。
- 未播放的 clip：`wasteland-enemy.charge/halt`、`extraction-point.standby`（见报告；帧都在包里）。

完整报告与证据：[`runs/2026-10-20e-site/site-report.md`](../runs/2026-10-20e-site/site-report.md)。

### 2026-10-20 · 02 收口后的站点版本

- 02 收口后包到 **v7**（lurker 语义修复）；已用同一份 `game-config.json` 零上游重装配为
  `runs/2026-10-20e-site/out/ruin-scavenger-extraction-assets/site/v3/`（消费 pack/v7）。
- 装配校验三族 + 几何 + HUD 全过；v1/v2 保留为 v6 的历史站点。
