# 17. Visual QA 的**判据**：只收构造性约束与层覆盖，七个 `similarity` 一个都不要

Type: grilling
Status: open
Owner: —
Blocked by: 06, 15
Map: ../map.md
> ⚠️ **包骨架已在[票 07](07-deps-allowlist.md) 里建好并接线**（`check-deps.mjs` 的 `ALLOWED` + 根 `tsconfig.json` 的 `references`）——
> 这一票**只写代码**，不要再建包、也不要再动那两处接线。
> 依据 **R3**（Q13）。`03 §21` 要七个相似度；本票要证的是**它们全是观察**。

## Question

`03 §21` 要检查：`style similarity` · `palette similarity` · `silhouette` · `composition` ·
`character consistency` · `material consistency` · `animation consistency`。

R3 定了判据只收三类（**集合差 / 构造性约束 / 引用族**）。R3 还说了理由：
`review.ts:6` 那条纪律**已经在跑** ——「***它只说差异，不说好坏***……不要求打分」。

### 1. 逐项判「判据 / 观察」，并说出理由

对 `§21` 的七项，每一项都要答：**它满足「精确可算 + 错了一定不是设计」吗？**
⚠️ **判据的门槛是后半句**（`CONTEXT.md:364-371`）：「要把一条观察升级成判据，
得先说出『**错了一定不是设计**』的理由。」说不出的，就是观察。

### 2. 判据那一侧的清单（R3 给的，要落成实现）

| 判据 | 今天在哪 | 备注 |
|---|---|---|
| 色板绑定四值自洽（`exact`/`composited`/`quantized`/`unbound`） | `assetpack.ts` / `quantize.ts` | 票 36 定的，**必须在** |
| 尺寸 · 锚点 · 九宫格 三条构造性约束 | 散在 `pack.ts` / 校验处 | ⚠️ 九宫格误写的代价**落在画上**（`CONTEXT.md:259-269`） |
| **层覆盖**（不平铺的层必须 ≥ 视口） | 装配期检查 | `CONTEXT.md:429-435`：视口 480×270 是**外壳常量** |

要答：这三条**是不是已经在跑**？若已经在跑，本票的活是**把它们接进 QAReport**（票 06），
不是重写。⚠️ 重写 = 第二份真相。

### 3. 视觉判据的输入是**交付态**

`CONTEXT.md:174-179`：`exact` 是「**光栅化后扫像素实测**，不是承诺」。
要答：判据跑在**交付态图集**上（那就有像素），还是**创作态 drawlist** 上（票 36 说
`Palette Binding` 对 drawlist **解析期静态可判**）？两者取其一，或各管一半。

## Answer

（待解）
