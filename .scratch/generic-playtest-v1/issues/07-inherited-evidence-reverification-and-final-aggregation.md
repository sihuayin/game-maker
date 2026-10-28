# 07 继承证据重验与最终聚合

Type: task
Status: open
Blocked by: 06, 09

## Question

汇总本轮试玩证据 + 继承的视觉审核与历史 verdict，产出最终验收报告。

必须完成：

1. **继承证据机械比对（Q8(b)，不改产品代码）**：用 effort 脚本核对
   `review-record.json` 的 `subject`、`capture.json` 的 pack/site/shell/checksum、`delivery` 身份、
   实际文件哈希、历史 `delivery.verdict` 是否属于同一冻结对象。身份或哈希不一致 ⇒ 不得继承。
2. **逐项重验**：按 01 的差距清单，确认本轮修复是否关闭对应验收项；未关闭的如实记录。
3. **回归**：`pnpm test`、`pnpm typecheck`、`pnpm test:playtest`、必要的 acceptance 命令全绿；日志留档。
4. **最终报告**：身份 / QA / 试玩 / 归因 / 视觉 / 聚合，逐项列强制条件 → 结论 → 证据（路径/命令/退出码/身份）；
   结论允许 `pass` / `fail` / `blocked` / `incomplete`，由 `deriveDeliveryVerdict` 或现有聚合确定，不手工改中间 JSON。
5. **限制披露**：明确记录「产品读取路径未重算证据哈希」「只跑一个真实 Demo」「纵向/喷发仅 fixture 证据」等限制；
   不得宣称已解决 Q8(b) 排除的问题。

## 03 裁定（已锁定，2026-10-28）

- **继承比对（effort 脚本，不改产品路径）**：`review-record.subject` ↔ delivery 身份；materials/capture 逐文件 sha256；`site-integrity` 四文件哈希；QA evidence 36/36 哈希；历史 `delivery.verdict` 是否属于同一冻结对象。身份或哈希不一致 ⇒ 不得继承。
- **视觉**：吸收 [09 补审](09-visual-review-supplement.md) 的四项追加记录；FA-04 六项按原样继承，不改历史记录。
- **最终结论**：交付 verdict 由 `deriveDeliveryVerdict` 确定性计算；另给 §5.5 八项逐项 `MET`/`PARTIAL`/`NOT MET`（横向可用 E2 + 冻结 Demo E3，纵向/喷发用 E2 fixture）；两者均通过才 `pass`，否则按 `fail` > `blocked` > `incomplete` 落；不新建第二套状态模型，不手工改中间 JSON。
- **必须披露**：产品读取路径仍不重算哈希；只跑一个真实 Demo；纵向/喷发仅 fixture 证据；五态 E2E 未做；旧 `x=813 / 24 reset` 不可复现（当前样本 `x=438 / 19`）；FA-04 六项与 §7.3 七项的映射及补审来源；`08-goal.png` 与 `09-final.png` 字节相同（8 个不同画面）。
- 06 失败时不得用历史 `pass` 覆盖本轮失败；报告须列出分歧。

## 08 裁定（已批准，2026-10-28）

- 07 汇总时从 `result.json` 读取场景级 `stop.reason` / `stop.atStep`，作为 §5.5「终止原因、最后状态、动作轨迹可追溯」的证据；交付摘要 `delivery.playtest` 不含 stop。
- 确定性：`playtestProjectionOf` 已含 `stopReason`；重复运行比较与将来基线晋升都要记录它。旧报告无 stop ⇒ `stopReason: null`。
- 身份：新报告 `identity.harnessVersion/rulesVersion` 为 v2；冻结对象的 delivery 身份只到 pack/site/config/shell，**不得**把 harness/rules 版本差异当成站点身份漂移。历史 FA-02 报告仍为 v1，可读、可继承为历史证据。
- 归因：执行器 stop ⇒ `AGENT_LIMITATION`（在游戏失败/环境失败/SUCCESS 之后）；报告措辞不得把主动停止写成场景超时。

## Answer
