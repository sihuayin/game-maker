# 08. 三种母版比例 fixture 的观察断言（施工，待授权）

Type: task
Status: resolved
Owner: claude (2026-10-19 · 人裁「施工票 08」→「关票」)
Blocked by: —
Map: ../map.md
> 派生自票 05 的裁定（2026-10-19）：三种 fixture（精确 / 2.9% / 10%）钉住观察行为。
> ⚠️ **立票 ≠ 批准施工**：票 05 的裁定明确把测试断言留待后续授权。

## Question

在 `packages/assets` 的测试里补断言（以及必要的第三条 fixture）：

1. 精确（如 64×96 → 832×1248）：`match === true`，`ratioDelta === 0`，不阻断。
2. 2.9% 漂移（如 48×64 → 858×1178）：`match === false`，`ratioDelta` 照实，**不阻断**。
3. 10% 漂移：`match === false`，`ratioDelta` 照实，**不阻断**。
4. 一条守卫：若有人把「上游回图」这一支重新变成判据（抛 / 阻断），测试要红。
5. import 母版支的硬判据保持不变（不匹配仍抛）。

## 验收

- 先红后绿；断言的语义是「观察」，不是「比例门」。
- 全量测试绿；不改生产行为。
- 文档 / `verify` 输出与裁定一致。

## 边界

- 只改测试与必要的 fixture；不改生成行为、提示词、契约。
- 不跑付费上游。
- 立票 ≠ 批准施工；施工需另行点头。

## Answer

**一句话**：补上 2.9% / 10% 两条读数 fixture，并加一条 C2 现场（48×64 → 858×1178）的集成守卫 ——
观察照记、资产照发、不阻断。全量 **1616/1616 绿**；零上游、零付费、**未提交**。

### 施工（2026-10-19，人裁「施工票 08」）

- `packages/assets/tests/master.test.ts`（+2 条）：
  - **C2 现场** `48×64 → 858×1178`：`match:false`、`ratioDelta ≈ -2.886%`、
    文案含 `858×1178` 与 `2.9%`。
  - **10% 漂移** `48×64 → 66×80`：`match:false`、`ratioDelta = 0.10`、文案 `10.0%`。
- `packages/assets/tests/pack-master.test.ts`（+1 条集成守卫）：
  - 母版与引用资产同为 `48×64`，假生图端口回 `858×1178`；
  - 构建**不抛**、母版照旧落盘、引用它的资产**照发**、
    `master-ratios.json` 记 `match:false` 且 `ratioDelta ≈ -2.9%`；
  - 这条与原有的 `1024×1024` 用例一起，钉住「上游回图这一支重新变成判据就会红」。
- 原有精确（`832×1248`）与 `import` 支硬判据测试不动；资产 / 多帧提示词测试不动。

### 闸

- 聚焦：`master.test.ts` 19 条 + `pack-master.test.ts` 17 条，**36/36 绿**。
- 全量：**102 文件 / 1616 条全绿**（基线 1613，本票 +3）。
- 诚实交代：`pnpm typecheck` 在 `packages/assets` 有两条**与本票无关、且文件未被本票修改**的既有错误：
  - `tests/pack-sheet-grid.test.ts:150` 的假 `ImageGenerator` 缺 `requestedSize`；
  - `tests/prompt.test.ts:257` 的 `CharacterDNA` 未导入。
  本票的两个测试文件 typecheck 干净；**没有修这两处**（超出本票授权）。
- 零上游、零付费、**未提交**。

### 边界

- 只改测试；不改 `masterRatioReading` / `pack` 行为 / 契约。
- 三种 fixture 的语义是「观察」，不是比例门。
- `import` 母版支继续硬判（原有测试仍在）。


## Comments

### 2026-10-19 · 已提交

本票的测试与探针期源码改动已随最终包一起提交。
