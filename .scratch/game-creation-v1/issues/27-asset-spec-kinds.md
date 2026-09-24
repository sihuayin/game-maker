# 27. AssetSpec 的四类扩展：sprite / animation / background / ui

Type: grilling
Status: open
Blocked by: 24, 26
Map: ../map.md

> ✅ **票 24 已 resolved**（2026-09-24）。它给出的四类分岔点是：**每类各一份图集文件**（因为最优打包参数不同）。⚠️ 它把 `bg_sign` 归类为 `ui` 是**判断不是事实**（该资源有 1px 外框 + 嵌套内框，正是九宫格形状），**本票要裁决**。

> R4 定了四类资源一等公民。现有 `AssetSpecSchema` 只有一类通用形状
> （`visual: z.record(z.unknown())` + `geometry: z.record(z.unknown())` 两个逃生舱），
> 装不下背景与 UI 的真实差异。本票把它扩成四类，并**把票 12 出局时搬过来的
> 确定性校验规则**在这里落地。

## Question

1. **四类的 spec 各自要什么**。逐类列出「生成它必须知道的信息」：
   - **sprite**：外观、状态、尺寸、朝向
   - **animation**：帧数、动作名、pivot、循环方式（依赖[票 26](26-animation-representation.md)）
   - **background**：分辨率、**是否分层/视差**、是否可平铺、与镜头的关系
   - **ui**：屏幕空间尺寸、是否九宫格可拉伸、与分辨率缩放策略的关系
   四者的**公共部分**抽出来当基类，还是各写各的？
2. **两类逃生舱怎么办**。现有的 `visual` / `geometry` 两个 `z.record(z.unknown())`
   是 schema 上的漏洞 —— R2 之后确定性校验是**唯一**的质量控制，
   留着逃生舱等于把唯一的控制也放走了。**要么把它们结构化，要么明确它们的边界**
   （什么能进、什么不能进、谁校验）。
3. **落进校验规则（来自票 12 的搬家）**：
   - **凸包容差**：drawlist 的包围盒是凸包**上界**（票 05 实测高估 2px），
     所以尺寸校验**只判过大、不判过小**。阈值多少、按类分别定还是统一。
   - **尺寸越界**：`expectedSize` 与实际 bounds 的比对在**哪一步**做 ——
     生成后立刻（票 22 的出口处）还是光栅化时（票 21）？
   - 还有哪些**确定性**检查是值得留下的？（R2 砍的是「打分」和「自动修复」，
     不是「校验」。凡是能在生成路径上静态判定的，都值得留。）
4. **四类资源与 AssetManifest 的关系**（与[票 24](24-asset-pack-contract.md) 对齐）：
   一个 sprite 有 6 个动画，算 1 个资源还是 7 个？

## 产出要求

调用 `grilling` skill。产出**四类的 Zod 草案**，并用现有实验资源
（`experiments/style-transfer-from-test-png/` 的 6 份 + `experiments/animated-player/`
的一套）逐类**填实例验证**，证明草案装得下真实产物。
