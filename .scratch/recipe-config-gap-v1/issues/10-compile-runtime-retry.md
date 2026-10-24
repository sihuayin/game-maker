# 10. compile-runtime 业务校验重试语义：模型错重采样 vs 确定不重试

Type: task
Status: resolved
Owner: main session · 2026-10-23
Blocked by: 07
Map: ../map.md

## Question

把 compile-runtime 的**业务校验**（`auditGameConfig` + `auditScreenSpace` + `auditLayerCoverage`）从「一律不重试」
改成「**模型错 → 重采样；设计+包确实做不出 → 不重试**」。

背景：R12（设计步）已修成 `intent-*` 重采样、`*-unsupported` 不重试（票 07 顺带）。但 config 步的业务校验仍是
「不重采样、不落盘」一刀切 —— 于是模型摆错一个实体（`entity 出界`）、HUD 摆出屏这类**模型侧随机错误**也当终局，
整条链白花生图钱。

## 要判的分类（E1 源码）

三批业务校验里，哪些是「模型这一发写错了、下一发可能写对」（= 重采样），哪些是「这份设计配这个包**真**做不出」
（= 不重试）：

- `auditGameConfig`：引用族（引用解不到/kind 错）+ 自洽族（实体出界、出生点卡 solid、gate 悬空…）—— 多为**模型错**。
- `auditScreenSpace`：HUD 面板/pip 落屏外 —— **模型错**。
- `auditLayerCoverage`：背景层盖不住世界 —— 由「背景资源尺寸 + world.size」决定，**更偏确定**（重抽 config 改不了）。

## 边界

- 改 `packages/assets/src/ops.ts` 的 `compileRuntime`：把「可重采样」的那几类 business 硬失败**移进重采样循环**
  （与 schema 失败同档、三发），「确定」的那类仍**出循环即抛**。
- 判据与口径**只此一处**，不抄第二份；witness 测试覆盖「模型错第一发坏第二发好 → attempts:2」+「确定错 → 只走一趟」。
- 不碰生图/付费；测试产物只写 `out/` 或本 effort 目录。

## Answer

**已实现（2026-10-23）** —— 把 compile-runtime 业务校验从「一律不重试」拆成「模型错重采样 / 确定不重试」：

- **`packages/assets/src/ops.ts`（`compileRuntime`）**：把 `auditGameConfig`（引用族 + 自洽族）+ `auditScreenSpace`
  （HUD 屏幕空间）**移进重采样循环**（在 `parseGameConfig` 之后、`break` 之前），有硬失败即 `call.trip({spent})` +
  `continue`（与 schema 失败同档，三发）；`auditLayerCoverage`（层盖不住世界）**留在循环后**、仍不重采样。
  循环后重建 `issues`（三批全量，供 summary 警告 + 层覆盖 hard 检查）。
- **口径**：引用/自洽/HUD = 模型这一发写错、下一发可能写对 ⇒ 重采样；层覆盖 = 背景资源尺寸 + world.size 决定、
  重抽 config 改不了 ⇒ 不重试。与 R12 的 `intent-*` 重采样 / `*-unsupported` 不重试**同一条思路**。
- **witness**（`compile-runtime.test.ts`）：「引用解不到 ⇒ 三发重采样、账上无 failure」+「第一发坏第二发好 ⇒
  `attempts:2`、出包」；「层盖不住世界」仍 `attempts:1`（票 65 那条不动）。全仓 1855 测试绿、`assets` typecheck 绿。
