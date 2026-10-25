# 05. VDC 自有确定性 validator 落码

Type: task
Status: resolved
Owner: claude (2026-10-25 · resolved)
Blocked by: 01, 03, 04
Map: ../map.md

## Question

实现 VDC 自有 validator（`packages/visual-design/src/validator.ts`），把 PRD §8.1 八条**全判据**（`visual-design-v1`
票 06 已定「全判据、无观察」）落成可机械判、能定位到「阶段 + 对象」的失败信息。

- **与 `audit*` 的关系**：VDC 自有，与 `auditGameConfig`/`auditScreenSpace`/`auditLayerCoverage` **并行不复用**
  （票 06）；跨契约的（`sourceIntent` 覆盖、`role↔kind`）遵循 `audit*` 中性函数模式，但代码接缝由本票确认。
- **顺序（票 06）**：语法 → 安全白名单（前置门，失败**不继续处理**）→ 一致性四项 → PNG → 文件清单。
- **八条判据**：
  1. SVG 语法（用票 03 解析器 `parseWhitelistedSvg`，解析失败 = 判据失败，定位到元素/行）；
  2. 安全白名单（`<svg>/<g>/<rect>` + 10 属性；禁 JS/foreignObject/外部引用/外部字体/动态内容/外部实体；XML 禁
     外部实体/资源加载）；
  3. 画布尺寸（`viewport` 与 VDS.viewport 一致，480×270）；
  4. 对象 ID（唯一）；
  5. 对象引用（`sourceIntent` 指向的实体 id 有效；`fill:palette:N` 下标在 palette 界内）；
  6. 对象边界与 VDS 一致（用票 04 的**共享矩形指令流** round-trip，不是两处各写一遍比较）；
  7. 预览成功生成（`preview/scene.png` 存在、尺寸 = 画布、确定性）；
  8. 文件清单（`visual-design.json` + `scene.svg` + `scene.png` + qa report 全在）。
- 判据失败 = 硬失败（抛 `CommandError("invalid", …)`，定位到阶段+对象）；**不得**静默修复、不得把无效 SVG 判成功。
- 确定性：同输入 ⇒ 同判据结果。

**测试**（TDD）：每一条判据的过/不过用例；安全失败后不继续处理后续检查；失败信息含「阶段 + 对象」；恶意 SVG
（含外部实体）被前置门拦截。

## Answer

已落码（2026-10-25）：`packages/visual-design/src/validator.ts`，`index.ts` re-export。

- **`validateVds(vds, palette, svg, png): VdcIssue[]`** —— 纯函数、确定性，返回定位到「阶段 + 对象」的 issue 清单
  （空 = 通过）。判据失败由**调用方**（票 06 compile 入口）转 `CommandError("invalid")`。
- **顺序 + 前置门**：① SVG 语法+安全白名单（`parseWhitelistedSvg`，失败**只报这一条、不继续处理**）→
  ② 画布尺寸（SVG viewport = VDS viewport）→ ③ 对象 ID 唯一（SVG 侧；VDS 侧由 schema superRefine 保证）→
  ④ 对象引用 fill 界内（`paletteColor` 越界 = 悬空引用，定位到对象）→ ⑤ 对象边界 round-trip（共享指令流
  `deriveRectInstructions` vs parsed rects，fill 全界内才做）→ ⑥ 预览尺寸（PNG = viewport）。
- **八条判据的落点**：§8.1 的「文件完整性」是**文件系统检查**，不在本纯函数里，归票 06（写盘后查文件全在）；
  其余七条（语法/白名单/画布/ID/引用/边界/预览）都在本函数。「预览成功生成」的可机判半边 = PNG 尺寸，
  「文件存在」半边归票 06。
- **与 `audit*` 并行不复用**（票 06 已定）：这个是「确定性布局产物的自校验」，不是「AI 产 GameConfig 的模型审计」。
- **验证**：`validator.test.ts` **8/8**（合法通过 · 确定性 · 前置门只报 svg · 画布/id/fill/bounds/png 各一条 ·
  定位到对象）；visual-design 全套 **49/49**；全仓 **1921/1921**；`build` 绿。
