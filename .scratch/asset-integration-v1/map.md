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
> ✅ **2026-10-20 · 05 已收口（research）** → 推荐「冻结 2.5 + `gemini-nano-banana-2.1` + JPEG 解码」；路线定稿见 [07](issues/07-model-route-ratification.md)。
> ✅ **2026-10-20 · 07 已收口（人裁）** → 接受 JPEG / 长期默认 2.1 / 2.5 内部截止 2026-12-31；
> 施工与付费验证立 [JPEG 施工](issues/08-jpeg-decoder.md) / [同动画 smoke](issues/09-two-frame-smoke.md) /
> [fixture 重基线](issues/10-fixture-rebaseline.md) / [共享裁框](issues/11-shared-trimbox.md)
> （JPEG 施工已完成；smoke 已收口；fixture 停止；共享裁框已关闭）。
> ✅ **2026-10-21 · 08 已收口** → JPEG 解码 + Interactions 请求改 JPEG + 测试；全量 1647 条绿；0 上游。
> ✅ **2026-10-21 · 09 已收口（人裁 A）**（2 发 / 2 张 JPEG / ≈$0.067 / 0 重试）—— 技术路径通，
> 但帧间一致性未过：bbox 宽漂移 132px（2.5: 6px）、alpha 差 17.9%（2.5: 0.4%）。
> 裁定：**触发共享裁框；dry-run 仍不可接受则拒绝 2.1 作为动画默认（C）**。
> ✅ **2026-10-21 · 11 dry-run 完成**：并集框把 alpha 差 17.9% → **7.1%**，仍是 2.5 基线 0.4% 的 ~18×；
> 2.1 两帧干净 bbox 宽 650 vs 474（2.5: 455 vs 454）⇒ 剩余是模型绘制方差。**C 已确认**。
> ✅ **2026-10-21 · C 成立（人裁）** → 11 关闭（共享框不施工）；10 停止（fixtures 保留 2.5）；
> JPEG 路径保留；2.1 不作为动画默认；替代动画模型立 [12](issues/12-alternative-animation-model.md)（先定验收标准）。
> ✅ **2026-10-21 · 12 已收口（人裁）** → 动画验收标准与比较计划定稿（绿/黄/红、3+3 样本、盲标 loop、
> 每合格动画成本）；零付费官方资料研究立 [13](issues/13-alternative-animation-models-research.md)。
> ✅ **2026-10-21 · 13 已收口（research）** → 短名单（无序）：`gemini-3-pro-image`（Interactions/JPEG，现有 key）
> 与 OpenAI `gpt-image-2.5`（PNG，需新 key/验证）；Vertex PNG 未验证、2.1 无 style 槽；0 付费调用。
> ✅ **2026-10-21 · 14 筛查完成（Option 2）** → A · Gemini 3 Pro **黄灯**（alpha 1.8%，bbox 宽/位置 0%，L1 3）；
> B1 · 现有中转 200 空体，**无结果**（1 发、未重试）。A 可提议资格（另票 + 预算）；B 需新裁决。
> ✅ **2026-10-21 · 15 A 资格跑完成**（6 发 / 6 张 / ≈$0.83 / 0 重试）—— scavenger **机械绿**；
> enemy **机械红**（alpha 31.3% / 宽 43.6% / 背景 L1 233）。按标准 A 不能整体通过；**待人眼裁定**。
> ✅ **2026-10-21 · 15 enemy 重试完成**（3 发 / ≈$0.415）—— enemy **机械黄**（alpha 2.3%、宽/位置 0%、L1 3）；
> 三帧 bbox 完全一致，背景稳定。A 组合：scavenger 绿 + enemy 黄，**无红；待人眼裁定**。
> ✅ **2026-10-21 · 15 已收口（人裁通过）** —— A 通过资格（9 / 12 发，≈$1.245）；决赛立
> [16](issues/16-a-finalist-full-loop.md)（全 4 帧 idle + 全 6 帧 patrol）。
> ✅ **2026-10-21 · 16 决赛跑完成**（10 发 / 10 张 / ≈$1.38 / 0 重试）—— scavenger **红**（alpha 10.4% / 宽 13.6%）；
> enemy **红**（alpha 33.6% / 宽 35.5% / L1 352）。3 帧资格未泛化到全循环；**建议决赛不通过**，待确认。
> ✅ **2026-10-21 · 16 已收口（人裁：拒绝 A）** → A 不作为动画默认；2.5 继续（内部截止 2026-12-31）；
> 替代模型（官方 B2 / 换策略 / 其他）未定，截止前另立决策票。
> ⚠️ **本图承载施工**（不是纯决策图）；任何付费生图 / 文本调用仍须**逐次**报告 + 逐字点头。

## Destination

最终资源包被集成进一个**可启动、可查看的本地站点**；
已知内容瑕疵（潜伏者语义 / 地面线 / 色板）被收敛到可接受，或被明确裁定接受；
未来跑批的模型路线有结论；
JPEG 路线完成零付费施工，并以**同动画 2 帧 smoke** 验证真实 JPEG 交付（付费仍逐字点头）；
动画替代模型在 2.5 内部截止前有结论（先定统一验收标准；本轮不授权调用或迁移）。

## Notes

- **最终包（源 · 32 色纯提取）**：`runs/2026-10-19l-salvage-standby3/ruin-scavenger-extraction-assets/pack/v1/`
- **最终包（策展 · 06 定稿）**：`.scratch/asset-integration-v1/runs/2026-10-20a-olive-palette/ruin-scavenger-extraction-assets/pack/v4/`
  （34 色 = 32 提取 + 2 策展；记录：同目录 `palette-curation.md`）
  ⚠️ 03 / 02 的后续重建必须用本 run 的 `stylespec.json`（34 色），否则会把橄榄外套退回棕色。
- **最终包（03 定稿）**：`.scratch/asset-integration-v1/runs/2026-10-20d-groundline/ruin-scavenger-extraction-assets/pack/v6/`
  （在 v4 上做地面线清理；34 色；`verifyPack` ok · 61 动画帧 · 0 上游）。
- **最终包（02 定稿 · 当前集成起点）**：`.scratch/asset-integration-v1/runs/2026-10-20f-lurker/ruin-scavenger-extraction-assets/pack/v7/`
  （在 v6 上修 lurker 语义；34 色；`verifyPack` ok · 61 动画帧 · 0 上游）。
- **模型路线报告（05 定稿）**：`research/model-route-2026-10-20.md`（零付费；官方文档 / discovery + 本地离线 JPEG 模拟）。
- **C 裁定（2026-10-21）**：2.1 **不作为动画默认**；JPEG 路径（08）保留为基础能力，
  不代表 2.1 获准用于动画生产。动画继续用 2.5；2.5 内部截止 **2026-12-31** 不变。
- **动画验收标准（12 定稿）**：见 [12](issues/12-alternative-animation-model.md) 的 Answer；
  机械绿/黄/红 + 3+3 样本 + 盲标 loop + 每合格动画成本；付费筛查仍逐字点头。
- **原始设计**（与包同源）：`runs/2026-10-18d/ruin-scavenger-extraction-assets/run/v1/game-design.json`
- **付费闸**：生图 / 文本上游都算付费动作；先出书面预算报告 + 逐字点头，一笔都不能自行发。
- **零付费工具**：`reuseFrom` + `minLargestShare` 让「patch 一帧 → 复用重建」不花钱；
  `verifyPack` / `inspect` 本地免费。
- **顺序**：06 色板（已完成，v4）→ 03 地面线（**已完成**，v6）→ 01 站点集成（**已完成**，零上游）→
  02 潜伏者（**已完成**，v7）→ 05 模型路线（**已收口**，research）→ 07 路线定稿（**已收口**，人裁）→
  08 JPEG 施工（**已完成**，零付费）→ 09 同动画 smoke（**已完成**，2 发 / 人裁 A）→
  11 共享裁框（**已收口**，dry-run + 人裁 C）→ 10 fixture 重基线（**已停止**，未执行）→
  12 替代动画模型（**已收口**，标准 + 比较计划）→ 13 替代模型资料研究（**已收口**，零付费）→
  14 候选付费筛查（**已收口**，A 黄 / B1 relay 空体）→ 15 A 资格（**已收口**，绿/黄 · 人裁通过）→
  16 A 决赛全循环（**已收口**，双红 · 人裁拒绝 A）→ 2.5 继续（替代模型未定，2026-12-31 前另议）。
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
- [05. 2.5 停服后的模型路线](issues/05-model-migration.md)：**已收口（research）** ——
  推荐「冻结 2.5 产物 + `gemini-nano-banana-2.1` + Interactions JPEG 解码」；2.5 legacy PNG 只作
  已批准小补丁的临时旁路。Interactions 输出枚举**只有 JPEG**（换 3.1-flash / 3-pro 也不解决）；
  2.5 停服日期三份官方口径矛盾（2027-03-15 / 2026-10-02 / 「未弃用」），不能当安全桥。
  66 次量级成本：2.1 ≈ $2.4–2.5，3-pro ≈ $9.2，冻结 = $0。离线模拟显示压缩本身温和，
  风险在**逐帧裁框抖动**（q90 下 1K bbox 漂移 1–8 px）。施工面 ≈ 0.5–1.5 人日（`jpeg-js`）。
  报告：`research/model-route-2026-10-20.md`；7 个人裁点已立为
  [07](issues/07-model-route-ratification.md)。
- [07. 模型路线定稿](issues/07-model-route-ratification.md)：**已收口（人裁）** —— 接受 JPEG
  （同动画 2 帧 smoke 为门槛）；长期默认 `gemini-nano-banana-2.1`（smoke + fixture 后生效）；
  2.5 内部截止 **2026-12-31**（只约束新批次）。批准
  [JPEG 施工](issues/08-jpeg-decoder.md) 零付费开工并限定范围；
  [同动画 2 帧 smoke](issues/09-two-frame-smoke.md) 预算上限已批、执行前仍须逐字点头；
  [fixture 重基线](issues/10-fixture-rebaseline.md) 替换 16 张 fixture、预算另批；
  [动画级共享裁框](issues/11-shared-trimbox.md) 条件性立票。07 同时把 JPEG 施工 /
  smoke / fixture 重基线拉入本图（Destination 已相应扩写）。
- [08. JPEG 解码 + Interactions 请求改 JPEG](issues/08-jpeg-decoder.md)：**已收口** ——
  `jpeg-js@0.4.4` + `decodeJPEG()`；Interactions 请求改 `image/jpeg`；按声明 MIME 分派
  （Interactions JPEG / PNG 兼容，legacy 仅 PNG）；未知 / 冲突格式明确失败且不重试。
  `@types/jpeg-js` 是 deprecated stub（jpeg-js 自带类型），未安装。全量 **105 文件 / 1647 条绿**；
  0 上游；未改配置 / fixtures；09 已解除阻塞。
- [09. 同动画 2 帧 smoke](issues/09-two-frame-smoke.md)：**已收口（人裁 A）** —— 2 发 / 2 张 JPEG /
  ≈$0.067 / 0 重试；技术路径通，但帧间一致性未过（alpha 差 17.9% vs 2.5 的 0.4%；bbox 宽漂移
  132px vs 6px）。idle1 是离群帧；结论是 2.1 逐帧方差 + 逐帧紧裁，不是 JPEG 压缩。
  裁定：触发 [共享裁框](issues/11-shared-trimbox.md) 先做零付费 dry-run；仍不可接受则拒绝 2.1 作为动画默认。
- [11. 动画级共享裁框](issues/11-shared-trimbox.md)：**已收口（人裁 C）** —— dry-run 把 2.1 alpha 差
  **17.9% → 7.1%**，仍是 2.5 基线 **0.4%** 的 ~18×；干净 bbox 宽 **650 vs 474**（2.5: 455 vs 454）。
  结论：共享框修不了模型姿势 / 轮廓宽度 / 明暗方差；**不施工**，保留为技术方向。
- [10. 2.1 fixture 重基线](issues/10-fixture-rebaseline.md)：**停止，未执行** —— 2.1 未通过动画一致性验收；
  **不是 fixture 工具缺陷**。保留现有 16 张 2.5 fixtures；未来替代模型通过验收后另立重基线票。
- [12. 替代动画模型](issues/12-alternative-animation-model.md)：**已收口（人裁）** —— 动画验收标准与
  比较计划定稿：动画为单位、筛查 2 帧 / 资格 3+3 / 决赛全循环；机械绿/黄/红（alpha ≤1/3%、
  bbox 宽 ≤2/5%、位置 ≤1/3%、背景 L1 ≤10/20、色数 ≥14）；盲标 loop preview；每合格动画成本；
  预算上限 $0.50 / $2 / $4（只是上限，不是授权）；资格先行，主→备→停，不静默切换。
  下一步：零付费官方资料研究 [13](issues/13-alternative-animation-models-research.md)。
- [13. 替代动画模型候选：零付费官方资料研究](issues/13-alternative-animation-models-research.md)：
  **已收口（research）** —— 短名单 2 个：`gemini-3-pro-image`（Interactions/JPEG，现有 key + 7890，
  无停服日，官方 3 风格 + 5 角色参考）与 OpenAI `gpt-image-2.5-sunburst/flare`（PNG 默认、多参考图，
  需新 key + 可能 org verification，官方承认跨帧漂移）。Vertex PNG 未验证且 GCP 接入重；2.1 无 style 槽；
  2.5 / 3.1 / Imagen 4 淘汰。0 付费调用。08 已落地 JPEG 解码，Gemini 3 Pro 的格式条件已满足（报告补注）。
- [14. 候选付费筛查](issues/14-candidate-paid-screening.md)：**已收口（Option 2）** —— A · Gemini 3 Pro
  2 发全 200 / JPEG / 896×1200；alpha **1.8% 黄灯**，bbox 宽与位置 **0%**，背景 L1 **3**，色数 22/21；
  联系表在 `runs/2026-10-21c-screening/evidence/gemini3pro/contact.png`。B1 · 现有中转
  `.../codex/v1/images/edits` **200 空体、无图**（1 发未重试；relay 计价未知）。
  A 提议资格（3+3 帧，≤$2.00，另票 + 预算）；B 可换旧 `/v1`、走官方 B2 或放弃，均需新批准。
- [15. A 资格：Gemini 3 Pro 3+3 帧](issues/15-a-qualification.md)：**已收口（人裁通过）** ——
  scavenger 机械绿（alpha 1.0% / 宽 0.2% / L1 5）；enemy 重试机械黄（alpha 2.3% / 宽/位置 0% / L1 3），
  人眼通过；9 / 12 发 ≈$1.245。资格通过后立决赛 16；决赛双红，A 最终被拒绝（见 16）。
- [16. A 决赛：Gemini 3 Pro 全循环](issues/16-a-finalist-full-loop.md)：**已收口（人裁拒绝 A）** ——
  10 发 / 10 张 / ≈$1.38；scavenger 红（alpha 10.4% / 宽 13.6%）、enemy 红（alpha 33.6% / 宽 35.5% / L1 352）；
  3 帧资格未泛化到全循环。**A 不作为动画默认**；2.5 继续，内部截止 2026-12-31；替代模型未定。

## Not yet specified

（替代动画模型未定：官方 B2 / 换生成策略 / 其他，待 2026-12-31 前另立决策票；2.5 继续；本轮不授权新调用。）

## Out of scope

- **开宝箱 / 外壳交互**：属玩法 / 运行时 effort；本图只记录，不立票。
- **玩法扩展**（攻击 / 受伤 / 死亡 / 多关卡索引）。
- **跨游戏视觉记忆**。
