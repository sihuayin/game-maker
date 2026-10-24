# 12. registry 实现切片：status 落账 + 四样见证 + R12 硬约束

Type: task
Status: resolved
Owner: main session · 2026-10-23
Blocked by: —
Map: ../map.md

## Question

落地 [票 01](01-mechanic-registry-status.md) 的裁定（最小账本 + 见证推导 + 硬约束），把 registry 真正实现出来：

1. **status 落账**：每机制加 `status`（experimental / supported / deprecated），`MECHANICS` 保持纯 id 列表。
2. **四样见证**：构建期机械证明每机制「设计表达 + config 表达 + Runtime 实现 + QA probe 四样齐全」→ **推导** status，
   而非手写。
3. **R12 硬约束**：设计 `mechanics[]` 引用非 `supported` 机制 → 新增拒绝理由（`mechanic-experimental`）。

## 现状（E1，见 ../findings-codebase.md）

- `MECHANICS`（`vocabulary.ts:34-51`）纯 id；`RuntimeProfile.mechanics = [...MECHANICS]`（`runtime-profile.ts:117`）。
- witness 先例：`packages/demo/tests/shell-capability-witness.test.ts`（把每条 capability 钉到源码行）。
- R12 拒绝理由 `REJECT_REASONS`（`build-design.ts:39-45`）5 条封闭；设计引用机制的检查走 `profileDifferences`
  （`build-design.ts:134-145`，今天恒空）。

## 建议

- status 用独立 `MECHANIC_STATUS: Record<Mechanic, Status>`（不破坏 `z.enum(MECHANICS)` 派生）。
- 见证复用 witness-test 先例：Runtime 实现按「源码行钉住」判；config 表达按「config schema 有对应字段」判；
  **QA probe 腿依赖 [票 06](06-behavioral-qa-probe.md)**（probe 机制定了才知道「有 probe」怎么判），先 stub、06 落地后补。
- R12 硬约束落在 `profileDifferences`：status ≠ supported 的机制被设计引用即拒绝。
- 收口时把「机制状态（mechanic status）」与「见证（witness）」写进 CONTEXT.md（新词，领域建模）。

## 阻塞

QA probe 腿依赖 [票 06](06-behavioral-qa-probe.md)；runtime/config 腿与 R12 硬约束不依赖（可先做）。

## Answer

**已实现（2026-10-23）** —— 把 [票 01](01-mechanic-registry-status.md) 的裁定落成代码。`pnpm typecheck` 通过、全仓 **1827 测试全绿**。

1. **status 落账 + 推导**（`packages/contracts/src/vocabulary.ts`）：
   - `MECHANIC_STATUSES` / `MechanicStatusSchema` / `MechanicStatus`（experimental / supported / deprecated，封闭枚举）。
   - `DEPRECATED_MECHANICS`（生命周期手标，现为空）+ `RUNTIME_IMPLEMENTED_MECHANICS`（运行时实现见证转录，7 条）。
   - `deriveMechanicStatus()`：deprecated（手标）→ supported（有运行时实现）→ experimental。`MECHANICS` 保持纯 id 列表（`z.enum` 派生不变）。
2. **R12 硬约束**（`packages/game-design/src/build-design.ts`）：`REJECT_REASONS` 加 `mechanic-experimental`；`profileDifferences` 里设计引用非 `supported` 机制即拒。
3. **运行时见证判据**（新 `packages/demo/tests/shell-mechanic-witness.test.ts`）：`Record<Mechanic, {file, needle} | null>` 穷尽表；`moving-platform: null` 是「声明了没实现」的表态；逐条剥注释读源码断言 needle 还在（与能力侧同款）。
4. **测试**：`vocabulary.test.ts` 加「机制状态」判据（今天**只有** moving-platform 是 experimental）；`build-design.test.ts` 加 `mechanic-experimental` 正/负例。
5. **词汇表**：CONTEXT.md 新增「机制状态（Mechanic Status）」词条。

**未做（按票面 defer）**：QA probe 那条见证腿 —— 依赖 [票 06](06-behavioral-qa-probe.md)。06 落地后 `deriveMechanicStatus` 加一条 `∧ qaProbe` 即可收紧「supported」。

**毕业**：`moving-platform` 的伪支持现在**可被机械判出**（自动推导 experimental + R12 拒引用）。[票 09](09-moving-platform-marking.md) 的「标记」部分已由本票完成，剩下的只是**负向见证**（证明「带 motion 的 solid 确实不移动」这个 `null` 是对的），不再是「标记」本身。
