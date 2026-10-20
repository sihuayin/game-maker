# 02. 潜伏者 hang / lunge / retreat 语义修复

Type: task
Status: open
Owner: —
Blocked by: —
Map: ../map.md
> 派生自最终包的内容验收：潜伏者形象一致，但倒挂 / 站立语义混用。

## Question

按动作逐帧修 `ceiling-lurker` 的语义：

- `hang`：倒挂在天花板 / 通风管下，头朝下；
- `lunge`：落下并短距离扑击，身体转为前扑；
- `retreat`：回到悬挂位，恢复头朝下。

做法：逐帧重生成语义不符的帧（≤13 发），把新 raw 放进 patch 目录，
其余帧 + 3 drawlist 用 `reuseFrom` 复用重建；不改包结构。

## 验收

- 三个动作的倒挂 / 站立语义在联系表上逐帧可读。
- 重建包 `verifyPack` ok；帧数不变（4 / 5 / 4）；0 母版调用。
- 花费 / 每帧调用数落账。

## 边界

- **付费**：先出书面预算报告 + 逐字点头；本票不预授权。
- 不改母版 / 网格判据；不重跑其他资源的帧。
