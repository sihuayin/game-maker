# 12. 结构化 Visual QA：检查什么、怎么量化、阈值多少？

Type: grilling
Status: open
Blocked by: 05
Map: ../map.md

## Question

Q11 决定了 Visual QA 以**结构化静态校验**为主、截图仅作 Evidence。
这是 Q3（程序化资源）带来的红利：因为 Asset 是代码/数据，
文档第 13 节要求的那些维度从「视觉模型事后猜」变成「静态可证明」。

但**具体检查什么、怎么算分，一条都没定**。而 `DEFAULT_GATE_POLICY`
（`demo/src/contracts/policy.ts`）里已经写死了
`hard.visualStyle: 0.80` 这个阈值 —— **一个还不知道怎么算的分数，
阈值却已经定了**。这个顺序是反的，本票要修正它。

阻塞在票 05：能静态检查什么，完全取决于 Asset 的表达形式。
（如果 Asset 是 Canvas 指令 DSL 且颜色引用色板索引，那「颜色 ∈ palette」
是**编译期恒真**的，检查它就毫无意义 —— 得去检查别的。）

文档第 13 节要求评价六个维度，逐个落地：

1. **Color**：所有出现的颜色 ∈ `StyleSpec.palette`。
   怎么提取颜色取决于票 05。允许的偏差是多少
   （调色板外的抗锯齿边缘色？透明度变化？）？
2. **Shape**：形状特征匹配 `StyleSpec.shapeLanguage`
   （`["rounded","soft"]`）。**这个怎么量化？**
   圆角半径占比？多边形顶点数？曲率？
   「soft」在一段绘制指令里对应什么可测量的性质？
   —— 这可能是六个维度里最难的一个，也可能根本量化不了，
   那就必须诚实承认并降级为人工检查项。
3. **Material**：`StyleSpec.material: ["painted"]`。程序化生成下
   「painted」意味着什么可检查的东西？（无渐变？有噪点纹理？无高光？）
4. **Lighting**：`StyleSpec.lighting`。要不要检查阴影方向一致性
   （所有资源的光源来自同一侧）？这在静态校验下可行吗？
5. **Composition**：场景布局的构图。这一维**不属于单个 Asset**，
   属于 Game Config 的场景布局 —— 那它是 Visual QA 的职责还是
   Gameplay QA 的职责？
6. **Identity**：`["cozy","stylized","soft","pastoral"]` 这种整体气质。
   **这一维几乎肯定无法静态校验** —— 要不要明确承认，
   把它留给 fog 里的「视觉模型打分」？

以及：

7. **Semantic scale mismatch**（文档第 31 节的核心例子）：
   `cow bounds = 180×160` vs `GameSpec 期望 80×80` vs `StyleSpec scale = 0.8`。
   这条**完全可静态判定**，是结构化校验最漂亮的战果。
   三个数分别从哪读？期望尺寸写在 Game Config 还是 AssetSpec 的 `geometry`？
8. **Novel Asset Style Consistency**：参考图里没有的资源是否仍属同一世界。
   程序化生成下，如果所有 Asset 都由**同一套生成函数 + 同一个 palette**
   产出，这一维**天然成立** —— 那么检查它就退化成
   「确认没有 Asset 绕过生成函数手工硬编码」。这个检查有价值吗？
   还是说这一维在 Q3 的路线下已经**不再是风险**，可以从 QA 里去掉？
   （注意：`VisualReportSchema` 里有 `novelAssetStyleConsistency` 必填字段，
   去掉它要改契约。）
9. **截图区域 Evidence**：文档第 30 节要求 `evidenceIds` 能指到
   `region_003` 这种**区域**。区域截图怎么定义和裁剪？
   用 `RuntimeEntity.bounds` 来裁？
10. **分数怎么合成**：`VisualReport.score` / `styleConsistency` /
    `novelAssetStyleConsistency` 三个 0-1 分数各自怎么来？
    issue 的 severity（critical/major/minor）怎么扣？
    **定完之后回过头修正 `policy.ts` 里的 `0.80`** —— 
    它应该是一个有依据的数字，不是拍脑袋。

调用 `grilling` 与 `codebase-design` skill。
**产出是一份检查项清单（每项含：判定方法、数据来源、severity、是否可自动化）
+ 一份修正后的 visual 阈值依据。**
凡是判定为「无法静态校验」的维度，必须显式写进结论并推给 fog，
不要含糊地留一个假的自动检查。

## Answer

_（待填）_

---

## 来自票 01 的更新（2026-09-23）

票 01 的视觉实测发现了一个**直接削弱本票第 1 条（Color 检查）的问题**：

### ⚠️ 色板补全幻觉

给模型一张**只有 4 种颜色**的程序化测试图（四象限：
`#E74C3C` / `#2ECC71` / `#3498DB` / `#F1C40F`），
它准确识别出全部 4 个（hex 精确命中），**但额外多返回了 2 个**：
`#ECF0F1`、`#2C3E50` —— 这两个是 Flat UI 调色板里的常见邻居色，
**图中根本不存在**。三次运行都稳定多返回 1-2 个。

后果：`StyleSpec.palette` 是一个**被放宽了的**集合。
本票第 1 条「所有出现的颜色 ∈ palette」这个检查，
在 palette 含幻觉色的情况下**判定力下降** ——
一个用了 `#ECF0F1` 的资源会被判为合规，而它其实偏离了参考图。

必须回答：

- **要不要反向校验 palette**？即用真实像素直方图（参考图的实际颜色分布）
  去核对模型报的 palette，剔除图中不存在的颜色？
  这是纯计算、零模型成本、确定性 —— 与本票「结构化校验」的路线完全一致。
  代价是需要一个 PNG 解码器（Node 侧，`pngjs` 之类）。
- **容差怎么定**？实测模型对真实颜色的还原精度很高
  （4/4 精确命中），所以容差可以定得很紧（比如 ΔE < 3）。
  但 `StyleSpec.palette` 的语义是「这个世界允许的颜色」还是
  「参考图里出现的颜色」？**这两个不是一回事** —— 前者应该更宽。
  这个语义分歧要在本票里定死，它决定了容差该多大。
- **`confidence` 字段能信吗**？实测模型自报 0.9-0.92，
  且**在幻觉色板上也报 0.92**。→ 它对自身幻觉无感知，
  **`confidence` 不能用作 palette 可信度的判据**。
