# 03. inspect 观察的内容与来源：现有指标 + 宽高比/尺寸差

Type: grilling
Status: resolved
Owner: claude (2026-10-18 · 人裁离线；第二轮已收口，见 [06](06-round-2-rulings.md))
Blocked by: —
Map: ../map.md
> 第一轮 Q2 = (a)：palette usage / 色板外像素 / 背景层覆盖率 + 图片实际宽高比 + 输出尺寸与预期差；
> 只记录、不评分、不阻断。本票定**具体算哪些、从哪算、行长什么样**。

## Question

1. **现有 inspect 指标**：直接复用 `inspectPack.summary`（含每资源 palette usage / 色板外像素、
   背景层覆盖率、色板用色分布），还是只取其中一部分？观察是预渲染 lines，qa 原样搬。
2. **宽高比 / 尺寸差的口径**：
   - “图片实际”指哪张图：`authoring/generated/*.png` 的原图？`authoring/masters/*.png`？`authoring/imported/*`？
     还是交付图集帧（交付帧已被缩放到 `spec.size`，与目标恒等，观察价值低）？
   - 目标是什么：animation 的 `size.w × frames` × `size.h`？background 每层的 `size`？单帧 `size`？母版的 canonical？
   - 对照谁：原图与目标 sheet / 层的长宽比与尺寸；delta 怎么表达（比例、像素、方向）？
3. **覆盖哪些资产**：仅 `source.kind = "image"` 的单元（动画/层/单帧）与母版？import 原图也观察吗？
   drawlist 无位图，跳过？
4. **行格式**：确定性、可复现、可测试；例如
   `源图 1344×768（1.750）→ 目标 1920×540（3.556）· 长宽比差 -50.8%`。
   是否要分「每个 unit 一行」？是否带 asset/unit id？
5. **落点**：这些新行加在 `inspectPack.summary` 里（推荐；报告原样搬），还是单独一个 helper 的输出？
   `inspectPack.data` 是否也要带结构化值（仅为诊断，不新契约）？
6. **不做什么**：不设阈值、不判「好/坏」、不加相似度；只记录事实。


## 第二轮裁定（收口，见 [06](06-round-2-rulings.md)）

见 06 的逐字裁定；本票的接口/内容/失败语义已按 Q9–Q11 收敛。
