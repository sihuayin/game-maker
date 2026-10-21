# 10. 2.1 fixture 重基线（付费，替换 16 张）

Type: task
Status: resolved
Owner: claude (2026-10-21 · 停止，未执行)
Blocked by: 09, 11
Map: ../map.md
> 派生自 [07](07-model-route-ratification.md) 的 Q6 裁定（2026-10-20）。
> ⚠️ **单独立付费票**：预算另批；执行前须书面预算报告 + 逐字点头。

## Question

smoke 通过后，用 2.1 重新生成并**替换**现有 16 张 `model-paint*` fixtures：

- `fixtures/model-paint`：5 张
- `fixtures/model-paint-layers`：5 张
- `fixtures/model-paint-despill`：6 张

要求：

- 重量 2.1 真图，按现有 README 的纪律更新读数与断言；**不放宽断言**来兼容新模型。
- 旧 2.5 fixtures 在新一批验收前保留；验收通过后在一个提交里替换，旧字节留在 git 历史。
- 预算：约 **$0.54 起**（16 × $0.0336，未计重试）；实际预算另出报告。
- 默认模型配置的切换由**人手动**完成；agent **不改** `game-maker.local.json`。

## 验收

- 16 张新 fixture 落盘；三份 README 的读数与断言更新。
- 全量测试全绿；断言没有被放宽。
- 花费 / 发数 / 重试落账。
- 给出人手动改配置所需的模型与代理值。

## 边界

- 不替换成「两套并存」；只保留一套 2.1 fixture。
- 不做完整包跑批；不改源码（除非测试断言必须随 fixture 更新，且仅限测试）。
- 付费前必须另出预算报告 + 逐字点头。

## Answer（2026-10-21 · 停止，不执行）

**裁定：停止，不执行 fixture 重基线。**

- 原因：2.1 未通过动画一致性验收（[09](09-two-frame-smoke.md) / [11](11-shared-trimbox.md) 的 C 裁定），
  **不是 fixture 工具本身的缺陷**。
- 保留现有 16 张 2.5 fixtures，原样不动；不把基线迁移到被拒绝的 2.1。
- 不产生任何付费调用；不改 fixtures / 源码 / 配置。
- 若未来替代动画模型通过验收，fixture 重基线应**另立新票**，沿用本票的方法
  （重量 16 张、不放宽断言），但不复用本票的 2.1 假设。
- 证据：本票无执行产物；停止依据见 09 / 11。
