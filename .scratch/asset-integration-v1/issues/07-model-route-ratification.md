# 07. 模型路线定稿：接受 JPEG / 2.1 默认 / 2.5 内部截止日

Type: grilling
Status: open
Owner: —
Blocked by: —
Map: ../map.md
> 派生自 [05](05-model-migration.md) 的 research 报告：
> [`../research/model-route-2026-10-20.md`](../research/model-route-2026-10-20.md)。
> ⚠️ 本票只裁路线，**不批准任何付费跑、不批准施工**；施工 / 付费验证须另立票并按付费闸逐次点头。

## Question

05 已给出推荐路线：**冻结 2.5 产物；战略路线 = Interactions API + JPEG 解码，模型 `gemini-nano-banana-2.1`；
2.5 legacy PNG 只作已批准小补丁的临时旁路。** 本票请人逐条裁定：

1. **接受 JPEG 作为未来上游格式？** 在「不切 Vertex / 不换 provider」的前提下，Interactions 的输出枚举
   只有 JPEG（v1 / v1alpha / v1beta discovery 一致）；这是唯一可走的路。
2. **长期默认模型定 `gemini-nano-banana-2.1`？** 对比：3.1-lite 更便宜但官方明说「不为多参考图优化」；
   3-pro 约 4× 成本且像素风收益未经证实；3.1-flash 已 deprecated。
3. **2.5 的内部截止日**：官方三份口径互相打架（2027-03-15 / 2026-10-02 / 「未弃用」）；
   报告建议内部按 **2026-12-31** 停止依赖 2.5 跑新批次。
4. **是否批准零付费施工票**（`jpeg-js` 解码 + Interactions 请求改 JPEG + 测试；约 0.5–1.5 人日；
   顺序必须先解码器、后改请求）。
5. **是否批准同动画 2 帧的 smoke 预算**（2.1 · Interactions · JPEG；≤4 发 / ≤$0.16 / ≤15 分钟），
   用来验证真实 JPEG 编码 + 逐帧裁框抖动。付费仍须逐字点头。
6. **fixture 重基线**：smoke 通过后，**替换**现有 16 张 2.5 `model-paint*` fixture，还是新增一套 2.1 fixture？
   （报告建议替换；不要放宽断言来「兼容」新模型。）
7. **若 smoke 看到帧间抖动**，是否追加「动画级共享裁框」施工票（`ImportOptions.trimBox` 已有，
   `pack.ts` 未暴露）？

## 验收

- 每个问题一条明确裁定（可含条件与顺序）。
- 任何施工 / 付费验证的授权范围写清楚；未写到的部分不授权。
- 若裁定「只冻结、暂不迁移」，写明触发重新评估的条件。

## 边界

- 不批准任何付费调用；不改 `game-maker.local.json`；不改源码；不换 provider。
- 本票不预设 05 的推荐一定被接受 —— 可以裁「只冻结」，也可以裁其他模型。
