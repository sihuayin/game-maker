# 票 19：standby3 定向修复报告（已授权，1 发）

- **授权（人裁逐字）**：
  > **修 standby3：1 发 / ≤4 发 / 15 分钟，修完复用重建**
- **输入**：`runs/2026-10-19k-standby3-fix/asset-recipe.json`（单个 sprite `extraction-point`，64×96）
- **模板**：`singleObjectPrompt`（单物体贴图；终端描述；背景纯色；正视正交）
- **模型 / 端点**：`gemini-2.5-flash-image` · legacy `generateContent`
- **预算**：1 次生图 / ≤4 发 / 0 文本 / 15 分钟；正常 ≈ $0.039，最坏 ≈ $0.156
- **输出**：`runs/2026-10-19k-standby3-fix/standby3-fix/pack/v1/`（raw：`authoring/generated/extraction-point.png`）
- **重建**：把新 raw 复制为 patch 目录的 `extraction-point.standby3.png`，其余 66 张 + 3 drawlist 复用；0 上游。
- **验收**：新图是终端（不是人）；替换后整包 `verifyPack` ok；61 帧不变。
