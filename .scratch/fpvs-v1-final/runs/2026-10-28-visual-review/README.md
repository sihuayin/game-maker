# 2026-10-28 · FA-04 视觉人工审核（材料包）

**状态：已收口（人类六项全部通过）** —— P0-06 审核结论 **`pass`**，已写回工作区
`run/v1/qa-report.json`：`visual-review=pass`，六项检查全 pass，`delivery.verdict=pass`。
本票是 HITL：材料由我准备，视觉好坏由人类判断；逐项记录见 `review-record.json`。

## 0. 审核对象（与 FA-01 冻结同一份字节）

| 项 | 值 |
|---|---|
| 游戏 / 包 | `wasteland-scavenger-recipe` · `pack/v1` |
| 站点 / shell | `site/v1` · shell `2` · `site.json` = pack `v1` / config `game-config.json` |
| 配置 | `site/v1/game-config.json`（= run 的 `game-config.json`） |
| manifest | `sha256:a162942de2a65a549be6958f0739f900df0625e0fa957872425bd9a53aa7feb3` |
| config | `sha256:455d9c7fc982e4d4c3c5b32ff4a94f1dd99f5e85b8adcb0f59af521f3b757dcd` |
| 只读快照 | `artifacts/wasteland-scavenger-recipe/`（66 文件，`chmod -R a-w`） |
| 截图来源 | `work/wasteland-scavenger-recipe/site/v1`（site/pack/config 与快照逐字节一致） |
| 材料索引 | `materials.json`（17 源材料 + 27 生成材料，逐文件 sha256；源材料对快照 `frozen match`） |

`qa-report.json` 的 work 版只比快照多 FA-02 的 `delivery` 写回；QA 层（含视觉相关
`failures` / `observations`）与快照字节一致 —— `materials.json → existingVisualQa.qaReportBinding`。

## 1. 材料清单

| 类别 | 文件 | 说明 |
|---|---|---|
| 原始风格参考图 | `../../work/.../run/v1/reference.png`（= `style.png`，同 sha256） | 480×270；本页/HTML 里按 2× 显示 |
| 交付资源 · 角色 | `assets/character-frames.png` | 10 帧（idle 4 / run 4 / jump 2）· 24×32 · 8× |
| 交付资源 · 危险物 | `assets/patroller-frames.png` | 6 帧（idle 2 / walk 4）· 24×32 · 8× |
| 交付资源 · 物件/HUD | `assets/objects-frames.png` | chest 32×32 / platform 32×32 / scraps 16×16 / hud-panel 64×64 / hud-icon 16×16 |
| 交付资源 · 背景层 | `assets/background-frames.png` | sky / ruins / wall / railway · 480×270 · 1× |
| 实际运行画面 | `shots/01-startup.png` | 启动（出生点、HUD、背景） |
| | `shots/02-movement.png` | 移动（已收集 1 件） |
| | `shots/03-jump.png` | 跳跃（空中） |
| | `shots/04-pickup.png` | 收集后 |
| | `shots/06-hazard-wait.png` | 危险物 · 巡逻带外沿等待 |
| | `shots/07-hazard-cross.png` | 危险物 · 空中越过巡逻怪 |
| | `shots/05-chest-open.png` | 宝箱开启后（收集 3 件） |
| | `shots/08-goal.png` | 到达目标（`won=true`） |
| 运行证据 | `capture.json` · `events.jsonl` · `trace.jsonl` · `input.jsonl` · `console.json` · `exceptions.json` | 真实按键 · 通关 · 0 reset · 0 runtime-error · 站点字节未改 |
| 已有 Visual QA | `materials.json → existingVisualQa` | QA 视觉观察通道 `unavailable`；两条尺寸 warning（不阻断） |
| 设计意图 | `../../work/.../run/v1/visual-world.json` · `stylespec.json` | “低到中等密度、干净水平分层”的 flat pixel art |

一次运行概览（`capture.json → run`）：`won=true` · `collected=6` · `chestsOpened=2` ·
`resets=0` · `runtimeErrors=0` · `siteIntegrity.unchanged=true`。

## 2. 怎么看

- 浏览器打开 `review.html`（相对路径已接好；图片按 1×/2×/8× 标注）。
- 或直接看 `assets/` 与 `shots/` 下的 PNG。
- 注意：截图视口 1000×457；游戏 480×270 以 zoom 2 渲染为 960×540，上下被视口裁切
  （不是游戏裁切，是浏览器视口）。

## 3. 审核结果（人类 · 2026-10-28）

审核者：**人（本次会话用户）** · 方式：本会话逐项判断（HITL）· 全部材料绑定上述版本。

| # | 检查项 | 结论 | 理由 / 证据 |
|---|---|---|---|
| 1 | 整体风格 | **pass** | 审核者逐项确认通过；未提出具体问题。证据：reference.png、reference-vs-gameplay.png、01/08 截图 |
| 2 | 色彩与明暗 | **pass** | 审核者逐项确认通过；未提出具体问题。证据：reference.png、background-frames.png、reference-vs-gameplay.png |
| 3 | 角色 | **pass** | 审核者逐项确认通过；未提出具体问题。证据：character-frames.png、player-in-game.png |
| 4 | 场景 | **pass** | 审核者逐项确认通过；未提出具体问题。证据：background-frames.png、01/05 截图 |
| 5 | 关键物件 | **pass** | 审核者逐项确认通过；未提出具体问题。证据：patroller-frames.png、objects-frames.png、05/06 截图 |
| 6 | 实际运行效果 | **pass** | 审核者逐项确认通过；未提出具体问题。注：截图上下边缘是 Chrome 视口裁切（480×270 · zoom 2 → 960×540），不是游戏内裁切。证据：01/03/07/08 截图、player-in-game.png |

**总体：pass** · 已发现问题：无 · 缺材料项：无 · 版本不匹配：无 · 历史 PASS 未继承。

逐项机器可读记录：`review-record.json`。

## 4. 写回记录

`packages/cli review-verdict --verdict pass` 已写回工作区 `run/v1/qa-report.json`
（`writeVisualReviewToReport` 只动视觉评审三处）：

| 项 | 写回后 |
|---|---|
| `delivery.visualReview` | `{ status: "pass", reviewer: "人（本次会话用户）", reviewedAt: "2026-10-28T08:12:51.004Z", note: "P0-06 六项人工对照通过…" }` |
| `delivery.checks` | asset-pack / config / qa / site / playable-smoke（SUCCESS）/ visual-review **全 pass** |
| `delivery.verdict` | **pass** |
| 快照 / site / pack / config 字节 | **零写入**（快照 66 条哈希不变；work 仅 `run/v1/qa-report.json` 变） |

## 5. 复核材料

### 原始问题（FR-04 表）

| # | 检查项 | 判断问题 |
|---|---|---|
| 1 | 整体风格 | 游戏画面的整体美术表达是否与参考图一致 |
| 2 | 色彩与明暗 | 主色调、对比关系及明暗分布是否存在明显偏差 |
| 3 | 角色 | 玩家角色的外观、轮廓和视觉表达是否符合预期 |
| 4 | 场景 | 背景、地形及环境元素是否符合参考图风格 |
| 5 | 关键物件 | 宝箱、收集物、危险物等关键资源是否符合游戏意图 |
| 6 | 实际运行效果 | 资源在游戏中是否出现明显裁切、比例异常、错位或其他影响体验的问题 |

每项填 `pass` / `fail` / `无法确认` + 理由 + 证据。总体结论规则：
全部通过 ⇒ `pass`；任一明确不通过 ⇒ `fail`；材料不完整/版本不匹配/无法可靠判断 ⇒ `incomplete`。
**不允许先 PASS 后补图；历史 PASS 不替代本轮审核。**

## 6. 附：写回命令（已完成，供复核）

用现有 CLI（只动工作区 `qa-report.json` 的视觉评审三处；快照零写入）：

```bash
pnpm build
node packages/cli/dist/cli.mjs review-verdict \
  .scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/run/v1 \
  --verdict <pass|fail> --reviewer "<审核者>" --note "<理由/问题摘要>" \
  --out .scratch/fpvs-v1-final/work
```

`incomplete`（无法确认）不写 `visualReview`（保持 `pending`），在最终报告里保留未完成状态。
写回后 `visual-review` 检查项与 `delivery.verdict` 由 `buildDeliveryReport` 重算；
若视觉 `pass` 且其余检查已 pass ⇒ `delivery.verdict = pass`；若 `fail` ⇒ `fail`。

复跑材料（只读、零付费；需 `pnpm build`）：

```bash
node .scratch/fpvs-v1-final/runs/2026-10-28-visual-review/capture.mjs
node .scratch/fpvs-v1-final/runs/2026-10-28-visual-review/build-materials.mjs
```

`capture.mjs` 会重拍全部截图（真实按键、通关、站点字节未改）；`build-materials.mjs` 重建哈希索引。
