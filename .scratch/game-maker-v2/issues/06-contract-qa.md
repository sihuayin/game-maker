# 06. `qa.ts` 的形状：判据会阻断，观察只报 —— 两种东西不许混成一个 `score`

Type: grilling
Status: open
Owner: —
Blocked by: —
Map: ../map.md
> 依据 **R3**（Q3b/Q13）。`03 §9-12` 的那些 `similarity` 数值**一个都不进判据**。
> ⚠️ **2026-10-01（票 28）：本票造的是 V2 契约 —— 请用 `import { z } from "zod/v4"` 写**（不是 `from "zod"`）。
> 理由与代价见[票 28 的 Answer](28-structured-call-substrate.md)：`toolInputSchema` 只能转 v4 的 schema，而 v3/v4 的 schema **不许互相嵌套**。
> 另：**封口用 `z.strictObject`** —— 普通的 `z.object` 不产出 `additionalProperties: false`。

## Question

`01-contracts.md` §9-12 给的形状里，**有四处与 R3 直接冲突**，这一票就是改它们：

```ts
QAReport { status: "pass" | "fail"; visual?; gameplay?; intent?; failures[]; repairAttempts }
VisualQAResult { styleSimilarity; paletteSimilarity; silhouetteSimilarity;
                 compositionSimilarity; characterConsistency; materialConsistency;
                 animationConsistency }        // ← 七个数值
IntentQAResult { coverage: Record<string, boolean>; score: number; missingRequirements[] }
QAFailureCode = "STYLE_MISMATCH" | "COLOR_MISMATCH" | ... // ← 十二个码，多是数值越界的名字
```

### 1. 一个报告装两种东西，形状上怎么表达

R3 说判据**阻断**、观察**只报**。今天这两者在仓库里**已经分开住**：
`inspect`（观察，票 39 搬过去的）与 `verify`（判据，构建期红）。
要答：`QAReport` 是**一个**报告装两半，还是**两个**东西（判据一份、观察一份）？
⚠️ 如果装成一个，`status: "pass" | "fail"` 只能由**判据**决定，**观察不许影响它** ——
那 `score: number` 与七个 `similarity` 就**没有位置**了，要说清它们去哪（见 §3）。

### 2. 判据的那张表（R3 已给，要落成枚举）

| QA | 判据 |
|---|---|
| Visual | 色板绑定四值自洽（票 36）· 尺寸/锚点/九宫格三条构造性约束 · **层覆盖**（不平铺的层 ≥ 视口） |
| Gameplay | **引用族**（`hud.panel` 必须 `ui` · 砖的三条 · 资源解得到）· 冒烟 boot→spawn→goal |
| Intent | **集合差**：`GameIntentSpec` 里每个实体/机制在 `GameDesignSpec` 里有对应项 |

要答：`QAFailureCode` 的**十二个码**里，哪些**留**（并各自对应上表哪一条）、哪些**删**。
⚠️ `Camera` / `Silhouette` / `Material` / `Animation` / `Scale` 那几个码今天**没有判据撑着**
—— 留着它们就是留一个「谁来触发」都答不出的枚举值。

### 3. 观察项去哪

**已经有家**：`review.ts`（视觉差异，只说差异不说好坏）+ `inspect`（票 39 搬过去的用色观察）。
要答：`QAReport` 是**引用**它们，还是重算一份？⚠️ 重算 = 第二份真相。

### 4. `repairAttempts` 属于谁

它只有修复循环（票 21）用得上。要答：它进 `QAReport` 还是进 `run/v<N>/` 的另一份账。

## Answer

（待解）
