# 13. 母版 → DNA → 动画：`character-gen.ts` 与 `character-reference` 策略

Type: grilling
Status: open
Owner: —
Blocked by: 04, 11, 07
Map: ../map.md
> `docs/v2/03-claude-code.md` §16。「而不是 idle / run / jump 分别重新设计角色。」

## Question

⚠️ **先说清楚：那条性质今天已经成立。** §16 要防的事（分别重新设计角色）今天**不会发生** ——
多帧是**一次调用画一行、按墨迹间隙切**（`pack.ts:340-342,377` + `sheet.ts`，
`sheet.ts:1-9` 记着「等分会给出 144 vs 4 的头宽差」）。

所以这一票问的是**别的事**：**母版 + DNA 买到了什么今天买不到的东西？**

### 1. 今天有什么、缺什么（别重新量）

- **有**：`ImageSource.reference`（`recipe.ts:60-65`）是一条**文件路径**的母版；
  `fixtures/recipes/shift-change-image-anim.json:46` 在用；
  Gemini 把 `[styleReference, reference]` 按序内联（`image-gen.ts:299-312`，
  prompt 里注明「附件第 N 张」）；OpenAI 有输入图时走 `/images/edits`。
- **缺**：契约（`masterAsset` / `derivedFrom` / `CharacterDNA` 在 `packages/` 里**零命中**）、
  跨资产一致性、依赖边。

### 2. 母版**本身**怎么造出来

§16 的链是 `Character Master → Character DNA → Animations`。要答：**第一环谁产？**
- **(a)** 一次 `image` 调用（用 `VisualWorldSpec` + `CharacterDNA` 当提示词）产出一张母版位图；
- **(b)** 用 drawlist 画（可 diff、可静态校验，符合「创作态」那一侧的偏好）；
- **(c)** 母版可有可无 —— 直接从 DNA + 世界语法生成每个动画。

⚠️ **(a) 有一个链条上的硬约束**：`CONTEXT.md:117-131` 那条「风格一致性可证明」成立于**创作态**
（色板引用使「颜色 ∈ 色板」构造上恒真），再由创作态**决定性**地传导到交付态。
**生图产出的母版不经过那层** —— 它的颜色靠 `Palette Binding` 的 `quantized` 或 `unquantized`
诚实标注（票 36）。要答：母版和它的动画**各自**标成哪一值。

### 3. `character-reference` 在别的上游上会**静默失效**

`recipe.ts:129-131` 与 `image-gen.ts:56-68` 记着：DashScope 的 `image_edit` 需要**公网 URL**，
接不了本地文件；上游不支持参考图时**管线不报错**。

⚠️ 这是本票最该钉的一条：**「带参考图」这件要求，在某个协议上会静默地不成立。**
要答：是**判据**（那家协议下 `character-reference` 直接拒绝）还是**观察**（照跑、账上记一笔）。

### 4. 判据

帧间一致的**可断言**形式是什么？今天的判据是「一次调用画一行」这个**构造**本身。
DNA 之后要多一条吗？（⚠️ 若拿不出「精确可算 + 错了一定不是设计」的形式，按 R3 它只能是**观察**。）

## Answer

（待解）
