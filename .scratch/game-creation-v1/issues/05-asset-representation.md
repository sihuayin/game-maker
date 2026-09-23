# 05. Asset 的表达形式：「绘制代码 + 参数」具体长什么样？

Type: prototype
Status: open
Blocked by: —
Map: ../map.md

## Question

Q3 决定了 Asset **不是位图，而是绘制代码**；Q15 决定了 AI 只产出
「数据 + 纯函数」。这两条合起来定义了本项目最核心的产物形态，
但**具体形状完全没定** —— 而它是票 09（Game Config）、票 12（Visual QA）、
票 16（Repair）三张票的共同前置。

候选表达形式：

- **A) SVG 字符串**：AI 产出 `<svg>...</svg>` 文本。
  优点：可直接静态解析（XML parser 就能查所有 `fill`/`stroke`）、可 diff、
  浏览器和 Phaser 都能加载。缺点：动画和多状态（`states: ["idle","harvested"]`）
  表达笨拙；AI 容易产出不合法 XML。
- **B) Canvas 绘制指令数组（自定义 DSL）**：
  AI 产出 `[{op:'rect',x,y,w,h,fill:'palette:3'}, ...]` 这样的 JSON。
  优点：**天生是数据**，Zod 可校验、可 diff、静态检查零成本、
  颜色可以引用色板索引（`palette:3`）而不是硬编码 hex，
  多状态就是多组指令。缺点：需要自己写 renderer，表现力受限。
- **C) TypeScript 纯函数**：AI 产出 `(ctx, style) => void` 的函数体。
  优点：表现力最强。缺点：**是代码不是数据** —— 无法静态校验、无法安全 diff、
  要 eval 或动态 import，直接违背 Q15「数据 + 纯函数」里「可 Zod 校验」的初衷。
- **D) B + A 混合**：几何用 Canvas DSL，需要复杂路径时允许内嵌 SVG path 字符串。

必须回答的子问题：

1. **多状态怎么表达**？`AssetSpec.states: ["idle","harvested"]` 和
   `variants` 在选定的形式下如何落地？状态切换是换整份指令还是打补丁？
2. **色板绑定**：颜色是硬编码 hex 还是引用 `StyleSpec.palette` 的索引/名字？
   引用式能让「颜色 ∈ palette」成为**编译期就成立的事实**而不是运行时检查 ——
   这可能是 Q11 结构化校验能做到的最强形式。
3. **尺寸与 scale**：文档第 31 节的例子是「cow bounds = 180×160，
   GameSpec 期望 80×80，StyleSpec 参考 scale = 0.8」。
   选定形式下，这三个数从哪读、谁负责对齐？
4. **版本化的物理形态**：`assets/cow/v1`、`v2` 里存的到底是
   `.svg` 文件、`.json` 文件、还是 `.ts` 文件？（Q9 已定目录结构，
   但文件格式由本票决定。）
5. **依赖关系**：文档第 63 节说 scene 依赖 cow/barn/tree。
   选定形式下 `AssetSpec.dependencies` 怎么表达和校验？
6. **Phaser 怎么消费它**：选定的形式如何变成 Phaser 的 GameObject？
   （`this.add.image` 需要位图 —— 那是不是得先 rasterize？
   还是用 `this.add.graphics()` 直接画指令？还是 SVG 走 `this.load.svg`？）
   **这一条可能反过来否决某个候选**：如果 Phaser 消费 SVG 有硬限制，
   A 就不成立。

调用 `prototype` skill：挑一个候选，**真的用 Cozy Farm 的 cow + tomato + player
三个资源把它写出来**，让人类看着实物 react。不要停在纸面对比。
产出物链接到本票。

## Answer

_（待填）_
