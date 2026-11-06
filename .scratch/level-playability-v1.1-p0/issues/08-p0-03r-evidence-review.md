# P0-03R 案例证据复核

Type: grilling
Status: open
Owner:
Blocked by: 07
Map: ../map.md

## Question

人工复核三案例的配置、真实 Runtime 记录与判断对照，裁定证据是否足以进入结论包。

### 复核清单

1. A 的安全窗口是否同时有算法区间与真实 Runtime 行为支持？有没有「刚好没撞到」的偶然性？
2. B 的不可玩结论是否来自证明，而不是有限试玩失败？证明是否覆盖所有等待 / 重试策略？
3. C 是否明确 `INSUFFICIENT_EVIDENCE`，且原因与 P0-01R 的未确认事项对应？
4. 案例配置是否受控、可复现？是否修改了既有 fixture / 历史配置？
5. 是否存在 harness 限制被误当成游戏结论？
6. 是否需要补证 / 暂停 / 扩展案例？

### 交付

- `evidence/03r-ruling.md` + 本票 `## Answer`：**证据充分 / 需补证 / 不通过**，逐案例列裁定。
- 不产生产品代码 commit。

### 通过标准

- 用户明确批准；未通过时 P0-04 保持 blocked。
