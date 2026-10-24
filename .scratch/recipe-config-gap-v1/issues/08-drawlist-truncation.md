# 08. drawlist 九宫格 UI 截断：先判性质，再定修法

Type: research
Status: resolved
Owner: main session · 2026-10-23
Blocked by: 07
Map: ../map.md

## Question

判清「drawlist 九宫格 UI 面板（`hud-panel`）输出被截断」的**性质**，再决定修复策略。**不预设修法**。

关键区别（用户 2026-10-23 裁定）：

> drawlist 输出被截断 ≠ drawlist 无法表达九宫格 UI。
> - 若是**生成预算不足**（max_tokens 截断）→ 增加预算 / 针对性重试可能就解决。
> - 若是**输出格式 / 结构约束 / UI 复杂度**导致的截断 → 单纯加预算只是延后问题。

三种候选修法（用户预判）：

| 方案 | 优点 | 风险 | 预判 |
|---|---|---|---|
| A. 调大生成预算 | 改动小、可能直接解决 | 增加成本；不保证复杂 UI 不再截断 | 不作首选 |
| B. 九宫格 UI 改走 image | 避免 drawlist 对复杂布局的表达限制 | 丧失程序化绘制的确定性、风格一致性可能下降 | 特定资源的降级路径 |
| C. 截断检测 + 重试 | 可恢复部分不完整输出 | 结构性预算不足时重试可能重复失败、增成本 | 必须评估、不盲目重试 |

## 要钉死的事实（E1 源码 / E3 现场）

- 现场：`.scratch/recipe-config-gap-v1/runs/2026-10-23-p0-final/wasteland-scavenger-assets/failed-2026-10-23T12-03-14-382Z/`
  （已付位图 + 逐字提示词 + 截断的 drawlist 回应）。
- 截断点：JSON position 4065（约 4KB），在 `{"op":"rect",…,"fill":"palette:` 处断开 —— **远小于** `max_tokens=32_000`
  （≈128KB）。2/2 失败、截断点相近 → 疑似**结构/格式**问题，而非预算。需证实。
- `generate.ts` 的 drawlist 生成：`max_tokens ?? 32_000`（`:124`）；`stop === "max_tokens"` 才抛「撞上 max_tokens」、
  而我们拿到的是「返回的不是合法 JSON」—— 说明截断**不是**以 `max_tokens` stop 报出来的。需查：回应为何在
  4KB 处被掐断（代理 / 模型 / 工具入参解析哪一环）。
- 判断「截断性质」的具体判据：截断位置 vs max_tokens、2/2 是否同点、`stop_reason` 字段、以及九宫格面板的
  drawlist op 数量是否天然偏多（`ninePatch` 边框 + 中央 = 固定少量 rect，不该 4KB 就断）。

## 要回答的子问题

1. 截断是**预算**（撞 max_tokens）还是**格式/结构**（模型/代理在非 max_tokens 处掐断）？
2. 若是预算 → A/C 哪个更稳（一次加够 vs 截断重试）？若是格式/结构 → B（改走 image）还是修 drawlist 的生成/解析？
3. 修法落点（`generate.ts` / `resolveRoute` / 提示词哪一处），及最小改动。

## Answer

**诊断（探针修正后）：模型侧随机截断，不是传输/预算。修法选 C（截断检测 + 加大重试）已落地。**

初判「传输 4KB 截断」被三发只读探针**证伪**：

- 简单 JSON 150 对象 → **11.5KB / 5702 token / 完整**（`stop_reason=end_turn`）⇒ cc-switch 传输层 **没有 4KB 上限**。
- **实际 hud-panel drawlist**（真 `renderPrompt` + 真 spec/style）→ **6.3KB / 2699 token / 完整** ⇒ 同一个提示词
  我复跑 1 发就成，而真实 run 里 2/2 截断在 ~4KB —— 是**随机**的模型侧截断，不是确定性传输/预算截断。

**真因**：九宫格 ui 面板的 drawlist **天然偏长**（提示词「锈蚀金属质感」+「至少 10 op」+「dither 做材质」把模型
推向 ~6KB 纹理 op），模型**偶尔**在生成中途掐断。`max_tokens=32K` 根本没撞、`stop_reason` 一直是 `end_turn`。

**修法（C）已落地**（2026-10-23）：
- `packages/assets/src/generate.ts`：drawlist `attempts` 默认 **2 → 4**（`:105`），把「坏 JSON 就重采样」从 2 次提到
  4 次；注释记下票 08 的根因。drawlist 是文本、每发 ~$0.001，成本可忽略。
- witness（`packages/assets/tests/generate.test.ts`）：新增「前三次坏、第四次正常 → 成功」+ 把「两次都失败」改成
  「四次都失败 → `/4 次都没成功/`」。全仓 1855 测试绿、`assets` typecheck 绿。

B（九宫格 ui 改走 image）留作 C 仍不稳时的降级路径，本票不落地。
