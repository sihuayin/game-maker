# 04. 程序化造一张能真正考验 StyleSpec 提取的参考图

Type: prototype
Status: open
Blocked by: —
Map: ../map.md

## Question

仓库里一张图片都没有，而 Q7 决定了「人类未提供 → 程序化造一张」。
造这张图不是随手画个占位符 —— 它是整条链路的**输入端**，
造得太弱会让后面所有 QA 都失去意义。

要造出的图必须同时能考验 StyleSpec 的这几个维度（文档第 12 节）：

- **Palette**：色板要够鲜明、够有限（cozy 风：暖绿 / 奶油 / 棕），
  这样票 12 的「颜色 ∈ palette」静态校验才有意义
- **Shape language**：圆润 / 柔和，要有可辨识的形状特征，
  不能全是矩形（否则「形状语言」这一维无法被区分）
- **Camera / Composition**：top-down，构图要有明确的空间层次
- **Lighting / Material**：手绘感、无强对比光影
- **Character style**：至少一个角色，可爱比例

**关键设计约束**：图里应该**故意不包含** cow / tractor / barn / fishing rod
这类后续会被生成的资源 —— 因为文档第 13 节的
**Novel Asset Style Consistency** 恰恰要求「参考图里没有的东西也必须属于
同一个视觉世界」。如果参考图里什么都画全了，这个最重要的维度就永远测不到。

需要决定：

1. 用什么造？（Node + Canvas / 手写 SVG / HTML + Playwright 截图）
2. 造几张？Q1 说的是「一张**或者多张**图片」—— 多图输入会不会改变
   StyleSpec 提取的语义（多图是取交集还是并集？冲突怎么办）？
   这个要不要现在就支持，还是先做单图？
3. 图放哪、叫什么、多大分辨率？（Q9 决定了 `demo/projects/<id>/inputs/`）
4. 要不要同时造一张**反例图**（比如赛博朋克霓虹风），
   用来验证 StyleSpec 提取不是永远返回同一套 cozy 结果？

调用 `prototype` skill 造出实物，然后让人类 react。
产出物链接到本票，不要贴进正文。

## Answer

_（待填）_
