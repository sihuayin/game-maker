# Asset Integration V1：把最终资源包集成进可玩站点，并收敛已知瑕疵

Labels: wayfinder:map
Tracker: local-markdown
Effort: asset-integration-v1

> **本图 2026-10-20 开。**输入是 style-migration-v1 的最终包
> `runs/2026-10-19l-salvage-standby3/ruin-scavenger-extraction-assets/pack/v1/`
> （`verifyPack` ok · 19 资源 · 61 帧 · 已入库）与它的完成报告。
> ✅ **2026-10-20 · 03 已收口 → 策展包 v6**（34 色 + 地面线清理；`verifyPack` ok · 61 动画帧 · 0 上游）。
> ⚠️ **本图承载施工**（不是纯决策图）；任何付费生图 / 文本调用仍须**逐次**报告 + 逐字点头。

## Destination

最终资源包被集成进一个**可启动、可查看的本地站点**；
已知内容瑕疵（潜伏者语义 / 地面线 / 色板）被收敛到可接受，或被明确裁定接受；
未来跑批的模型路线有结论。

## Notes

- **最终包**：`runs/2026-10-19l-salvage-standby3/ruin-scavenger-extraction-assets/pack/v1/`
- **最终包（03 定稿）**：`.scratch/asset-integration-v1/runs/2026-10-20d-groundline/ruin-scavenger-extraction-assets/pack/v6/`
  （34 色 = 32 提取 + 2 橄榄槽；地面线已清；`verifyPack` ok · 61 动画帧 · 0 上游）。
- **原始设计**（与包同源）：`runs/2026-10-18d/ruin-scavenger-extraction-assets/run/v1/game-design.json`
- **付费闸**：生图 / 文本上游都算付费动作；先出书面预算报告 + 逐字点头，一笔都不能自行发。
- **零付费工具**：`reuseFrom` + `minLargestShare` 让「patch 一帧 → 复用重建」不花钱；
  `verifyPack` / `inspect` 本地免费。
- **建议顺序**：04 色板裁定 → 03 地面线（**已完成**，v6）→ 02 潜伏者（付费）→ 01 站点集成；
  05 模型迁移可并行。01 可以直接用 v6 做一次，看看真实外壳里的观感。
- **已知瑕疵**：潜伏者倒挂/站立语义混用；~~多帧地面线 / 细虚线~~（03 已修，见 v6）；绿外套量化成棕。

## Decisions so far

- **来源**：[style-migration-v1 完成](../style-migration-v1/map.md) —— 整包可交付、`verifyPack` ok；
  逐帧生成 + 零付费抢救是已走通的路线。
- **待办 intake（2026-10-20）**：把潜伏者语义、地面线、色板、模型迁移、站点集成
  整理为 01–05 五张票；玩法类（开宝箱）不在本图。
- [03. 地面线 / 细虚线清理](issues/03-ground-line-cleanup.md)：**已收口** —— 零付费后处理；
  61 张动画 raw 里 30 张有线（贴脚、线高 5px），新判据「行覆盖突然跳高 + 薄」，脚部结构性保护。
  `pack/v6`（34 色）`verifyPack` ok · 61 动画帧 · 0 上游。裁定保留 v6 的紧裁框：
  瑕疵不参与裁框，idle / enemy 与 run / jump 统一填满目标框。

## Not yet specified

- **站点集成要不要新 config**：`compile-runtime` 会走文本上游（可能 1–3 发）；有没有现成
  `game-config` 可复用，先免费找。
- **色板若调整**：是只改 DNA / 角色色板，还是重跑 32 色提取本身？影响哪些 image 资源。
- **2.5 停服后的路线**：Interactions + JPEG 解码 / 换模型 / 换 provider / 冻结 2.5 产物；
  需要先research 再裁。

## Out of scope

- **开宝箱 / 外壳交互**：属玩法 / 运行时 effort；本图只记录，不立票。
- **玩法扩展**（攻击 / 受伤 / 死亡 / 多关卡索引）。
- **跨游戏视觉记忆**。
