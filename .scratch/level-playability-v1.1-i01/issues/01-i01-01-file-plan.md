# I01-01 精确文件清单与依赖方向

Type: task
Status: resolved
Owner: amber
Blocked by: —
Map: ../map.md
Class: I-01 / DELIVERABLE

## Question

把三轮裁定收敛成一份**逐文件的 I-01 改动计划**，并证明它在 I-00 §11 白名单与 R2 授权之内。

### 必须交付

1. **文件清单**：每个新增 / 修改文件列一行，写清楚：
   - 改动性质（新增模块 / 新增导出 / 修改签名 / 仅内部实现）；
   - 为什么必须在这个包、这个文件，而不能留在别处；
   - 不做的后果；
   - 对应的 I-00 白名单条目（`docs/v7.8/移动-I00.md` §11）。
2. **依赖方向**：明确 `assets → contracts` 单向；`contracts` 不得出现 `node:fs` / `node:crypto`；列出所有新增 import 及方向。
3. **模块落点**：
   - 唯一生产读取器在 `assets/src/ops.ts` 的哪个函数；
   - `contracts/playability/temporal-input.ts` 承载什么（纯验证函数 / 类型 / brand）；
   - 新时序入口是 `api.ts` 的新导出，还是 `temporal-input.ts` 的入口；
   - 运行时 brand 的铸造工厂放在哪、为什么不进 barrel。
4. **公共面判定**：逐项对照 R2 已批准的 4 项加法；本次计划**不得**引入第 5 项。若确实需要，标记 `STOP → I-00 R2`。
5. **既有测试零改动证明**：列出 `playability-api.test.ts`、`config-audit.test.ts`、`publish-gate.test.ts` 的现状调用点，说明本计划为何不需要修改它们。
6. **越界清单**：若发现任何必需文件不在白名单，单独成节，标 `STOP`。

### 产出

`../evidence/01-file-plan.md`。**不修改任何生产文件。**

### 收口条件

- 每个文件都能映射到白名单条目；
- 依赖方向无环；
- 公共面无第 5 项加法；
- 越界清单为空，或明确写出停止结论并移交 I01-07 / I01-R1。

## Answer

计划：[`evidence/01-file-plan.md`](../evidence/01-file-plan.md)。

- **最小改动面**：contracts 2 个新文件（`temporal-input.ts` 纯验证 + brand、`temporal.ts` 入口 + stub + 两档比较）+ `api.ts` 只加导出；assets `ops.ts` 唯一读盘层；pipeline `create-game.ts` / `publish-gate.ts` 接线；新测试 1 个。
- **不需要改** `config-audit.ts`、`mechanic.ts`、`verdict.ts`、`playability/index.ts`、`contracts/src/index.ts`。三处调用方直接调 `runTemporalAudit`，不经过 `ConfigAuditContext`。
- **公开路径约束**：`contracts/src/index.ts` 不在白名单，且只导出 `playability/api.js` ⇒ 新符号必须经 `api.ts` 转出；这让 I-00 计划的 `auditPlayability` 签名改动**完全不必要**。
- **公共面**：新导出替代 R2 第 1 项，不是第 5 项；R2 第 2–4 项在 I-01 不使用（留给 I-03）。assets 包新增两个导出，必须进 I01-07 审计。
- **依赖方向**：`pipeline → assets → contracts`，无环；contracts 源码禁止 `node:fs` / `node:crypto`，由新测试内的架构断言守护。
- **既有测试**：零改动（旧入口签名不变，`ConfigAuditContext` 不变）。
- **越界清单**：空。条件性停止已列出：contracts 引入 Node 内置模块、改 `index.ts`、第 5 项公共面、改既有测试、新依赖或 `fixtures/packs/**`。
