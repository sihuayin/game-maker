# 14. enemy 比例：模型画竖、设计框 32×32 方（patrol 差 0.3%）

Type: grilling
Status: resolved
Owner: main session · 2026-10-26
Map: ../map.md

## Question

票 05 第三次重跑，修完票 13 的 sourceSizeObservations bug 后，run（hero）deltaAr 8.2% 过，
**patrol（enemy）deltaAr 25.3% 仍差 0.3% 不过**（阈值 25%）。

现场（`.scratch/fpvs-v1-p0/runs/2026-10-26-e2e-r3/.../entity-enemy.patrol.png`）：

- enemy **母版** 1024×1024（方形，master-ratios match=True）；
- patrol 整片 1024×1024（方形）；
- 但 `contentSize`（墨迹包围盒）= 718×900（0.798 偏竖）—— 模型把 4 个 enemy 在 2×2 网格里**画成了偏竖排列**，
  交付时被压到 32×32 方框。
- character-dna 里 enemy 的 silhouette 写的是「**宽体**矩形…横向张力强」，但模型实际画**竖**——措辞与画法相反。

裁定怎么处置（用户已逐字选「调 enemy 尺寸（设计层）」），落实施落票 15。

HITL：用户逐字裁定，不替用户答。

## Answer（裁定 · 2026-10-26 用户逐字）

**Q 裁定：选择 (1) 调 enemy 尺寸（设计层）。** 把 enemy 的设计框从 32×32 改成**高比例**（如 24×32 或 32×48），
匹配模型实际把它画成高挑机器人的比例，帧表 AR 目标跟着变（2×2 网格 = 48×64 AR 0.75），与模型画法对齐。
确定性，不赌方差。

**裁定边界**：

1. **只动 enemy 一个**：hero 8.2% 已过，不动；只把 enemy 的尺寸/比例改成高挑。
2. **落点在设计/清单层**：enemy 的 32×32 是 `plan-assets` 模型选的（design 层无实体尺寸字段）；
   实施 = 让 plan-assets 按 silhouette/身份把 enemy 定成高挑尺寸（提示词 + 可能的兜底），归票 15 细化。
3. **不动** `constructive-constraint` 阈值（票 03 裁定）、不动帧表网格推导（票 13）。

**为什么不选其他**：(2) 重跑赌方差 —— 模型已两次把 enemy 画竖（r2 源 3.023 横、r3 源 0.798 竖，都不方），
方差方向不定、会白烧；(3) 只排查措辞 —— silhouette 已写「宽体」但模型画竖，措辞方向本身反了，改措辞不解决「框 32×32 方」这一端。

**补记（2026-10-26）**：实施落 [票 15](../issues/15-enemy-size-tall.md)。
