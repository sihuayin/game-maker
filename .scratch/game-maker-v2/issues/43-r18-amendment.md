# 43. R18 变更票：多参考图契约**移除 `role`** —— `styleReferences` 回到「只存路径」

Type: grilling
Status: open
Owner: —
Blocked by: —
Map: ../map.md
> ⚠️ **它是 R17 那条元规则的产物**：R 表是**决策记录**、`docs/v2` 是它的表达层，
> 而**要改 R 表必须重新开票**。来历：[票 26「多参考图：N 张图怎么合并、怎么分工」](26-multiple-style-references.md)
> 的裁定（第 3 轮 Q2）**记录**了「移除 `role`」这个决定，并**特意不改** R 表与契约 —— 落到本票。
> ⚠️ **本票不阻塞 V2 终点**：今天 `role: "global"` 一路跑得通（`cli.ts:466` · `mcp/src/server.ts:263`
> 两个调用方都硬编码它）⇒ 这是一条**清理**，不是一条阻塞。
> ⚠️ **本票不是「多图实现」**：多图（N>1）的实现已由票 26 裁进地图的 `## Out of scope`
> （它不属于端到端链路的必要步骤）。**本票只处理 `role` 这一个字段的去留与其字面。**

## Question

R18 的原字面（`map.md` 的 R 表）：

> **多参考图**（Q19）：**契约层进**（`styleReferences: {path, role}[]` ——「一图一角色」是合理方向），
> 但**第一阶段 `maxItems === 1`**；N 图的权重融合与冲突解决**没有任何实测**，实现延后并开票（见票 26）。

### 1. R18 改成什么字面 —— 「字段」与「理由」是一起改，还是分开改

票 26 裁掉的**不只是** `role` 这个字段，还有 R18 当初给它的**理由**：
「一图一角色」是合理方向（`image A: palette` · `image B: character` · `image C: environment`）。

⚠️ 而那条理由**与更早的裁决相抵**：`characterImages` / `materialImages` 当年被判「**零消费者，不进**」
（`contracts/src/visual-world.ts:247`）。票 26 的第 1 轮裁定 **(A)「同一件事的多个来源」**
已经**把那个分工模型否掉**了 —— 理由是「没有材料证明那些角色都有明确的消费者」。

⇒ 待定的只剩**写法**：

- **(a) 只改字段**（`{path, role}[]` → `{path}[]`），**理由那一句原样留着**。
  ⚠️ 后果：R 表里会留着一句**已被票 26 否掉**的理由 —— 决策记录与决策不一致。
- **(b) 字段与理由一起改**：把「一图一角色是合理方向」换成票 26 裁定的语义
  （**同一个世界的多个来源**；融合发生在**理解层那一次调用**）。
  ⚠️ 代价：这个票面比 (a) 长，而 R 表是**决策记录**、不是规格 ⇒ 长度本身不是优点。

### 2. 契约落到什么形状

票 26 给的**契约目标**是 `styleReferences: { path }[]` —— 也就是 **R15 的字面**
（「原图进 `styleReferences`，**只存引用**（路径），二进制不进 JSON」）。

⚠️ 但 R15 已被[票 02「`VisualWorldSpec` 落地」](02-contract-visual-world.md) 摊平成
`VisualWorldSpec.styleReferences` ⇒ **「回到 R15」= 去掉 `role`，不是搬家**。
⇒ 要答的是：本票把 R15 与 R18 的关系**怎么写下来**（R18 是不是就此**退回 R15 的字面**）。

### 3. 落地范围 —— 要不要在本票一并做

去掉 `role` 至少要动（**别重新量**）：

| 落点 | 是什么 |
|---|---|
| `contracts/src/visual-world.ts:253` · `:290` | schema 那一行 + 导出的 `StyleReference` 类型 |
| `cli/src/cli.ts:466` · `mcp/src/server.ts:263` | 两个**硬编码**的 `role: "global"` |
| `pipeline/src/create-game.ts:48` · `:244` | 入参类型与那一处断言 |
| `contracts/tests/visual-world.test.ts:205-211` | 「契约不拦张数」那条测试（它构造 3 条 `styleReferences`） |
| `vision/tests/analyze-reference.test.ts` 等 | 任何构造 `styleReferences` 的测试 |

⇒ 要答的是：**R 表字面 + 契约 + 代码 + 测试一起落**（R5「票解出来的决定当场实现」），
还是**只改 R 表字面**、把落地再甩一张票。

⚠️ 注意 **R5 与「清理不算终点」之间没有冲突**：R5 说的是「票**解出来**的决定当场实现」，
而本票解出来的决定就是「`role` 拿掉」。

### 4. 判据与完成线

- 要不要一条测试钉住「**`styleReferences` 里没有 `role` 这个键**」的阳性，
  以及一条钉住「**多给了一个 `role` 键 ⇒ 拒**」的阴性（`z.strictObject` 本来就该拒，但**没有测试钉过**）？
- 完成线（照票 38 / 40 / 41 的惯例）：代码 + 免费测试（含 `typecheck` / `check:deps` / `check:links`）、
  **不执行任何付费真跑**、**不动 `game-maker.local.json`**。

### 5. 顺带一句（本票**不**处理）

票 26 裁定的**另一条待办**是「`>1` 张由**调用方边界**拒（`CommandError("usage")` ⇒ 退出码 2），
vision 内部留兜底」—— ⚠️ 那是**多图实现**的一部分，**随将来的施工票走**，**不在本票**。

## Answer

（待解）
