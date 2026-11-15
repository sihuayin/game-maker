# U1 依赖前置检查（I03-IMPL-02 / Q3）

| 项 | 值 |
| --- | --- |
| 日期 | 2026-11-15 |
| 票 | I03-IMPL-02 U1 执行 brief |
| 检查对象 | `TemporalTwoLagInternalResult` 的定义来源与依赖方向 |
| 结论 | **PASS**；U1 无需复制类型、增加依赖、添加共享类型文件或扩大白名单 |

## 1. 定义位置

- `export type TemporalTwoLagInternalResult` → `packages/contracts/src/playability/temporal.ts:940`
- `export type TemporalInternalResult` → `packages/contracts/src/playability/temporal-result.ts:41`
- `grep -rn "TemporalTwoLagInternalResult" packages/assets/src`：**无命中**。
- `packages/contracts/package.json` 的 `dependencies` 仅有 `zod`；没有 `@game-maker/assets`。

## 2. 依赖方向

- `packages/contracts/src/playability/verdict.ts`：只 `import type { Aabb } from "./geometry.js"`（叶子）。
- `packages/contracts/src/playability/temporal.ts`：`import type { PlayabilityVerdictState } from "./verdict.js"`（line 61）。
- `packages/contracts/src/playability/temporal-result.ts`：只 `import type { Aabb } from "./geometry.js"`。
- U1 新增 `temporal-evidence.ts` 计划只 import：
  - `./temporal.js` → `TemporalTwoLagInternalResult`（contracts）；
  - `./temporal-result.js` → 内部结果类型（contracts）；
  - `./verdict.js` → 公共类型（contracts）。
- DAG：`geometry ← verdict ← temporal ← temporal-evidence`；**无循环**。

## 3. 结论与 STOP 条件

Q3 前置检查 **PASS**。U1 是 contracts 内的类型 + 纯适配器单元，不引入跨包依赖，不扩大白名单。

若实施时发现下列任一变化 ⇒ **STOP + HITL**，提交依赖证据并重新裁定：

- `TemporalTwoLagInternalResult` 不在 contracts 的合法依赖范围；
- 需要复制类型 / 新增共享类型文件 / 增加依赖 / 修改白名单；
- `verdict.ts` 出现反向 import 或循环；
- `packages/contracts` 需要依赖 `packages/assets`。
