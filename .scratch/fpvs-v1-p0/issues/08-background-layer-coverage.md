# 08. 背景层覆盖缺口修复

Type: grilling
Status: resolved
Owner: main session · 2026-10-26
Map: ../map.md

## Question

票 05 的 Stage B 暴露：背景资产 `wasteland-station-bg` 生成得太小（`sky` 320×180 / `far-buildings` 1200×180 /
`station-wall` 1200×180），盖不住世界 1200×270 + 视差（0 / 0.3 / 0.6），`auditLayerCoverage` 报 3 条确定性硬失败。
缺口在**资产生成/清单层**（背景画布尺寸规划），不是文本上游、不是模型。

裁定修复方案，至少覆盖：

1. **修在哪一层**：资产生成提示词（`assetPlanPrompt` 让背景画布盖住世界）· 清单闸（plan-assets 加「背景覆盖」gate，
   不够大就重采样）· 确定性后处理（平铺 / 拉伸到世界尺寸）—— 或组合。
2. **口径**：背景尺寸怎么算（世界尺寸 + 视差余量；平铺 vs 单张撑满）。
3. **验证**：免费离线验证（全仓 test + 假上游）+ 重跑 Stage B 验证 3 条背景覆盖硬失败归零。

HITL：用户逐字裁定，不替用户答。

## Answer（裁定 · 2026-10-26 用户逐字）

**三问裁定**：

1. **修在哪一层**：**提示词 + 清单闸（组合）**。`assetPlanPrompt` / `recipeShapeSpec` 注入视口（480×270）
   与「背景层高 ≥ 视口高」规则；再加 `backgroundCoverageGate` 确定性拒绝不合规清单并重采样。
   理由：闸的重采样是**盲的**（`ops.ts:379-457` 循环每次同一句 prompt、不回灌失败），模型不知目标高度时三发不收敛
   —— 只有提示词告知目标高度、闸门确定性兜底，才既收敛又不静默。
2. **口径**：**高 ≥ 视口高 270，宽走 tileable.x**。`world.size.h` 恒 = 视口高（config 规则 `ops.ts:1046` 钉死），
   故每层高 ≥ 270；正视差层 `tileable.x` 铺满世界宽，parallax 0 的 sky 单图 ≥ 480、不需接缝。
   **不** tileable.y、**不**拉伸。
3. **验证**：**免费离线 + 现有产物过闸**。全仓 test + 假上游单测（320×180 拒 / 480×270 过），并把 probe-7 已有
   `asset-recipe.json`（背景 320×180）喂给新闸确认抓得到（E3 证据，零付费）。付费 Stage B 重跑归票 05，不在本票。

**裁定边界**：

1. **不动确定性后处理（拉伸/平铺）**：180→270 是 1.5× 非整数缩放、像素画畸变，且与 `tileable` 语义冲突。
2. **视口事实源**：`planAssets` 增加 `viewport?` 参数，`create-game` 传 `input.viewport ?? DEFAULT_VIEWPORT`
   （与 `compileRuntime` `:555` 同源），闸与 config 那步共用一个数。
3. **零付费**：本票不付费生图；免费离线验证 + 喂 probe-7 现有产物过闸。
4. **不新增错误通路**：闸与玩家闸 / HUD 闸 / 覆盖闸同一档（`schema`、重采样），不动 `CALL_FAILURES` 闭集。

**为什么不选其他**：只加闸 = 盲重采样不收敛、白烧 3 笔；只改提示词 = 模型不遵守时静默漏过（本仓反复踩）；
确定性后处理 = 非整数缩放畸变 + 语义冲突。

**补记（2026-10-26）**：实施落 [票 09](../issues/09-background-coverage-impl.md)。
