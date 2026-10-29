# 裁定参考图生成路径

Type: grilling
Status: resolved
Blocked by: （无）

## Question

现有 `.scratch/game-creation-v1/experiments/reference-image-draft/generate.mjs` **硬编码为黄昏山间列车小站**（variant A/B/C），无参数；它不能生成“黄昏屋顶城市”。请裁定参考图路径：

- (a) 授权新建 **effort-local** 脚本 `.scratch/p0-02-second-demo/tools/generate-reference.mjs`，复用现有 `draw.mjs` 的 canvas 原语；零付费、确定性、可复现，生成 480×270 黄昏屋顶城市；不改生产代码/历史实验。
- (b) 改用 `fixtures/reference/halt-dusk.png`（480×270、18 色、黄昏山间列车小站），把 A 的概念/关卡/资源改成该世界。
- (c) 用户提供一张新的黄昏屋顶城市 PNG（给出路径）。
- (d) 暂停 P0-02。

产物：票内 Answer + `rulings-2026-10-29.md`（追加逐字裁定）。

## Answer

**已收口（2026-10-29，HITL）。** 参考图路径 = **(a) 新建 effort-local 脚本**。

**用户逐字授权边界：**

1. 仅授权新建临时工具脚本及生成参考图，不授权修改生产代码、现有 `generate.mjs`、fixtures 或历史实验。
2. 零付费、无外部生图调用；固定输入与参数应产生可复现结果。
3. 保留“屋顶信使”概念，以及已裁定的 4 封信 + 可选信箱。
4. 生成后检查尺寸、色彩、provenance 和实际视觉效果；不得将生成成功等同于视觉验收通过。
5. 按既定流程，票 16 生成并检查，票 17 由用户验收。票 17 接受之前，不运行 `create` checkpoint；付费执行仍阻塞于预算 v2 授权。

**下一步**：票 16「生成并检查参考图」（task，零付费）→ 票 17「验收参考图」（HITL）。票 05 阻塞在 17。逐字裁定见 [../rulings-2026-10-29.md](../rulings-2026-10-29.md)。
