# 13. empty-input 独立重试档

Type: task
Status: resolved
Owner: main session · 2026-10-24
Blocked by: —
Map: ../map.md

## Question

给 `empty-input` 单独一档重试，与 `schema` 分开——两者性质不同，却共用 `STRUCTURED_CALL_ATTEMPTS = 3`：

- **`empty-input`**（`structured-call.ts` `parseToolUse`）：上游把 `tool_use.input` 丢了（`{}`/非对象）。**数据丢失、常在重试里恢复**。
- **`schema`**（同一函数）：模型吐出入参但过不了契约。**模型没过、重试大概率没用**。

实测（票 07 诊断追记）：plan-assets 失败里 `empty-input` 占 5/6；plan-only 第 2 发就恢复；Stage A 那次 3/3
连续 empty 把 3 发预算耗光。

**要定三件事：**
1. **重试上限**：empty-input 给几发？（如 6 vs 默认 3，或按墙钟封顶）
2. **作用域**：只 `plan-assets`（大 schema 步）生效，还是全结构化调用统一？
3. **病因显式化**：是否顺带把 empty-input 在 ledger/异常里更显式标记（现在已能写出 `failures=[empty-input]`，可确认是否足够）。

证据：票 07 诊断追记（`proxy_request_logs` 已证请求未截断、empty-input 是响应侧主因）。

## Answer（2026-10-24 · 已落地）

给 `empty-input` 单独 6 发重试预算（schema 等维持 3 发），scope 只 `plan-assets`（票 13 裁定）。

- **改动**：
  1. `contracts/src/structured-call.ts`：新增 `EMPTY_INPUT_ATTEMPTS = 6`（注释写明与 `STRUCTURED_CALL_ATTEMPTS`
     分开的病因依据）。
  2. `assets/src/ops.ts` `planAssets` 循环：`for (3)` → `while (emptyInputs < 6 && others < 3)`；
     `once.failure === "empty-input"` 单独计数，其余坏档（schema / 覆盖闸 / hud 闸 / 玩家闸）计 `others`。
- **病因显式化**：无需改 —— `call.trip({failure})` 已写得出 `failures=[empty-input]`。
- **witness 2 条**（`plan-assets.test.ts`）：① 5 发 empty 后第 6 发成功（旧代码 3 发就放弃）；
  ② 6 发全 empty → invalid、不无限重试。
- **测试**：全仓 **1858 绿**（`pnpm test`，123 文件 0 失败）。
