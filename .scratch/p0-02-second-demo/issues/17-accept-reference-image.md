# 验收参考图

Type: grilling
Status: resolved
Blocked by: 16

## Question

HITL：用户检查生成/提供的参考图（尺寸、色彩、provenance、视觉效果），决定：

- (a) 接受为 P0-02 输入，记录路径与 sha256；
- (b) 拒绝并说明原因（回到票 15/16 调整）；
- (c) 暂停 P0-02。

接受前不得启动付费 `create/build`；接受也不等于预算授权。

产物：票内 Answer + `rulings-2026-10-29.md`（追加逐字裁定）。

## Comments

- **2026-10-29 暂定（HITL）**：用户暂停视觉验收——当前对话没有收到 PNG，本地 IDE 路径不可直接打开；代理侧的尺寸/色板/确定性/provenance 检查**不能替代**实际视觉验收。等待图像可直接查看后再裁定接受/拒绝。
- 边界不变：暂停不授权付费；即使接受参考图，也不等于预算 v3 批准，`create` checkpoint 仍阻塞。

## Answer

**已收口（2026-10-29，HITL）：用户接受 `rooftop-dusk.png` 作为 P0-02 参考图输入。**

- 路径：`.scratch/p0-02-second-demo/inputs/reference/rooftop-dusk.png`
- sha256：`sha256:1b926a5bb052bd434893007b7ccc21f580c597a7c857ce582dbd8b4ad719f6f2`
- 尺寸：480×270 RGBA；16 唯一色；每像素在色板内；两次生成一致
- Provenance：同目录 `rooftop-dusk.provenance.json`
- 用户裁定：**接受**（逐字见 [../rulings-2026-10-29.md](../rulings-2026-10-29.md) 第 6 节）
- 边界：接受参考图**不授权付费执行**；`create` checkpoint 仍阻塞在预算授权 v3（票 19）。
