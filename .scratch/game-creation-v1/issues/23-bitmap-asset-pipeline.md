# 23. 位图 Asset 管线：生图适配、sheet 切片、与 drawlist 的分工边界

Type: prototype
Status: open
Blocked by: —
Map: ../map.md

## Question

2026-09-23 已验证：千问 `wan2.7-image-pro` 能按 `demo/test.png` 的风格
生成像素风角色 sprite（7.8s/张，1024×1024，参考图 base64 内联作风格条件）。
证据：`experiments/bitmap-asset-via-wan/player_with_reference.png`。
配方与踩坑记录在同目录 README。

**这把 Q3「不用位图」的前提推翻了**（当初的前提是环境无生图能力）。
Q3 修正为混合路线。本票要把位图这条路从「能出一张图」变成「能进运行时」。

### 必须回答的问题

1. **⚠️ 帧一致性：GPT 那张基准图的 trick 是「一张图含全部帧，再按网格切」。**
   我们没测过 wan 能否产出**对齐的网格 sheet**（4 方向 × 8 帧 = 32 格）。
   这是位图路线的生死问题：如果切出来帧与帧错位/尺寸不一，动画就废了。
   要实测：① 让 wan 直接画 N×M 网格 sheet；② 若不行，逐帧生成 + 按 alpha 包围盒
   自动对齐裁切；③ 再不行，只生成单帧静态 + 用 drawlist 做位移假动画。
   三条路的产物都要渲染出来人眼判。
2. **分工边界**：哪些 Asset 走位图、哪些走 drawlist？
   初步提案：**角色/敌人/NPC 走位图**（玩家盯得最多、需要手绘质感）；
   **平台/砖块/拾取物/招牌走 drawlist**（可平铺、可校验、可廉价 repair）。
   边界判据是什么？「需要有机形状或手绘质感」？还是「数量少且重要」？
   这个判据要写成规则，不能每次人肉决定。
3. **`AssetSpec` / `ArtifactRef` 怎么区分两种 Asset？**
   `ArtifactRef.type` 现在是 `z.enum([...,"asset",...])`，没有子类型。
   提案：加 `kind: "bitmap" | "drawlist"`，或靠 `path` 后缀（`.png` vs `.json`）推断。
   **靠后缀推断是隐式契约，会漂移** —— 倾向显式字段，但要改契约。
4. **位图的版本化与 repair**：文档第 21 节的版本化在位图下依然成立
   （`player/v1.png`, `v2.png`）。但 **repair 的语义变了**：
   drawlist 的 repair 是改一个数字；位图的 repair 是**重新生成**（抽奖）
   或**图生图编辑**（wan 支持 image 输入，可能可以做局部修改 —— 未测）。
   票 16 的 RepairAction 需要新增位图策略（`BITMAP_REGENERATION` /
   `BITMAP_IMG2IMG_EDIT`），且 **Stalled 检测在抽奖式 repair 下更重要了**。
5. **像素网格后处理**：生图产出 1024×1024，但游戏要 32px 网格的清晰像素。
   谁负责降采样/量化？要不要「量化到 StyleSpec.palette + 最近邻缩放到目标尺寸」
   的后处理步骤？这一步做不好，游戏里 sprite 会发糊 ——
   而「发糊」恰恰会毁掉像素风的全部价值。
6. **成本与配额**：wan2.7-image-pro 走的是千问 Token Plan。
   一次 run 要多少张图（角色 6 帧 sheet ×1 + 敌人 ×N + …）？
   Token Plan 的**图像配额**是否与聊天共享？用超了会怎样？
   （票 19 的成本核算要并入这一项。）

### 产出要求

调用 `prototype` skill。问题 1 与 5 必须出实物：
- 问题 1：三条路各产一份可看的动画预览（复用
  `experiments/animated-player/anim.html` 的播放器）
- 问题 5：同一张生图，做/不做网格量化各渲染一份并排对比

问题 2/3/4 是契约决策，产出规则文本与 schema 草案即可。

## Answer

_（待填）_
