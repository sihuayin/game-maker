# Asset Integration V1：把最终资源包集成进可玩站点，并收敛已知瑕疵

Labels: wayfinder:map
Tracker: local-markdown
Effort: asset-integration-v1

> **本图 2026-10-20 开。**输入是 style-migration-v1 的最终包
> `runs/2026-10-19l-salvage-standby3/ruin-scavenger-extraction-assets/pack/v1/`
> （`verifyPack` ok · 19 资源 · 61 帧 · 已入库）与它的完成报告。
> ✅ **2026-10-20 · 06 已产出策展包 v4**（34 色 = 32 提取 + 2 策展；`verifyPack` ok · 61 帧 · 0 上游）。
> ✅ **2026-10-20 · 03 已收口 → 策展包 v6**（v4 的 34 色 + 地面线清理；`verifyPack` ok · 61 动画帧 · 0 上游）。
> ✅ **2026-10-20 · 02 已收口 → pack v7**（lurker hang/lunge/retreat 语义修复；2 张付费新帧 + 4 张零付费旋转）。
> ⚠️ **本图承载施工**（不是纯决策图）；任何付费生图 / 文本调用仍须**逐次**报告 + 逐字点头。

## Destination

最终资源包被集成进一个**可启动、可查看的本地站点**；
已知内容瑕疵（潜伏者语义 / 地面线 / 色板）被收敛到可接受，或被明确裁定接受；
未来跑批的模型路线有结论。

## Notes

- **最终包（源 · 32 色纯提取）**：`runs/2026-10-19l-salvage-standby3/ruin-scavenger-extraction-assets/pack/v1/`
- **最终包（策展 · 06 定稿）**：`.scratch/asset-integration-v1/runs/2026-10-20a-olive-palette/ruin-scavenger-extraction-assets/pack/v4/`
  （34 色 = 32 提取 + 2 策展；记录：同目录 `palette-curation.md`）
  ⚠️ 03 / 02 的后续重建必须用本 run 的 `stylespec.json`（34 色），否则会把橄榄外套退回棕色。
- **最终包（03 定稿）**：`.scratch/asset-integration-v1/runs/2026-10-20d-groundline/ruin-scavenger-extraction-assets/pack/v6/`
  （在 v4 上做地面线清理；34 色；`verifyPack` ok · 61 动画帧 · 0 上游）。
- **最终包（02 定稿 · 当前集成起点）**：`.scratch/asset-integration-v1/runs/2026-10-20f-lurker/ruin-scavenger-extraction-assets/pack/v7/`
  （在 v6 上修 lurker 语义；34 色；`verifyPack` ok · 61 动画帧 · 0 上游）。
- **原始设计**（与包同源）：`runs/2026-10-18d/ruin-scavenger-extraction-assets/run/v1/game-design.json`
- **付费闸**：生图 / 文本上游都算付费动作；先出书面预算报告 + 逐字点头，一笔都不能自行发。
- **零付费工具**：`reuseFrom` + `minLargestShare` 让「patch 一帧 → 复用重建」不花钱；
  `verifyPack` / `inspect` 本地免费。
- **建议顺序**：06 色板（已完成，v4）→ 03 地面线（**已完成**，v6）→ 01 站点集成（**已完成**，零上游）→
  02 潜伏者（**已完成**，v7）；05 模型迁移仍开（research）。
- **站点**：`runs/2026-10-20e-site/out/ruin-scavenger-extraction-assets/`（**site/v3** 消费 v7；v1/v2 是 v6 的历史版本；
  配置与证据在同目录）。
- **已知瑕疵**：~~潜伏者倒挂/站立语义混用~~（02 已修，见 v7）；~~多帧地面线 / 细虚线~~（03 已修，见 v6）；
  ~~绿外套量化成棕~~（06 已修，见 v4）。

## Decisions so far

- **来源**：[style-migration-v1 完成](../style-migration-v1/map.md) —— 整包可交付、`verifyPack` ok；
  逐帧生成 + 零付费抢救是已走通的路线。
- **待办 intake（2026-10-20）**：把潜伏者语义、地面线、色板、模型迁移、站点集成
  整理为 01–05 五张票；玩法类（开宝箱）不在本图。
- [04. 色板 / 绿外套量化成棕](issues/04-palette-coat-review.md)：**Q1=C + Q2=B** ——
  允许以提取色板为底做**有记录、可复现**的人工策展；追加 1–2 个橄榄/卡其槽（取 raw 色、追加末尾），
  从现有 raw **零上游**重建 + QA。重跑提取救不了外套（参考绿不是橄榄色）；施工另立
  [06](issues/06-olive-palette-curation.md)，04 不预授权。
- [06. 追加橄榄/卡其色槽并免费重建](issues/06-olive-palette-curation.md)：**已收口** —— 采用
  `pack/v4`（34 色；`palette:32=#59503b`、`palette:33=#50432b`）。玩家 18.95% 像素变橄榄、
  背囊保持棕；背景只变 2.66%、无整体发绿；61 帧 / 0 上游。QA 记录在同 run 的
  `palette-curation.md`；v2/v3 是保留的被拒变体。
- [03. 地面线 / 细虚线清理](issues/03-ground-line-cleanup.md)：**已收口** —— 零付费后处理；
  61 张动画 raw 里 30 张有线（贴脚、线高 5px），新判据「行覆盖突然跳高 + 薄」，脚部结构性保护。
  `pack/v6`（34 色）`verifyPack` ok · 61 动画帧 · 0 上游。裁定保留 v6 的紧裁框：
  瑕疵不参与裁框，idle / enemy 与 run / jump 统一填满目标框。
- [01. 把最终资源包集成进本地可玩站点](issues/01-site-integration.md)：**已收口** —— 零上游；
  免费搜索无现成 config ⇒ 手写一关 `game-config/v1`（level-01 风格），v6 包 + `site` 装配 v1/v2。
  19 / 19 资源入景；键盘驱动 run / jump、拾取点亮 HUD；0 生图 / 0 文本上游。
  证据：`runs/2026-10-20e-site/site-report.md`。02 收口后用 v7 重装配了 `site/v3`（校验全过）。
- [02. 潜伏者 hang / lunge / retreat 语义修复](issues/02-lurker-pose-semantics.md)：**已收口** ——
  付费 6 帧（7 发 HTTP / 6 张成功，≈$0.20–0.23），`lunge4` / `retreat3` 采用；
  `hang1/2/3` / `retreat2` 被拒后用**原 raw 180° 旋转**零付费补足。`pack/v7` `verifyPack` ok ·
  61 动画帧（4/5/4）· 0 上游；与 v6 只差 lurker 6 帧。证据：`runs/2026-10-20f-lurker/lurker-report.md`。

## Not yet specified

（暂无。02 / 03 已收口；05 模型路线仍是一张 research 票。）

## Out of scope

- **开宝箱 / 外壳交互**：属玩法 / 运行时 effort；本图只记录，不立票。
- **玩法扩展**（攻击 / 受伤 / 死亡 / 多关卡索引）。
- **跨游戏视觉记忆**。
