# I02-SIGN 授权包签署

Type: grilling
Status: open
Owner: —
Blocked by: 17
Map: ../map.md
Class: I-02 / SIGN

## Question

用户签署 `docs/v7.8/移动-I02.md`。**首次签署只放行 I02-01**；其余四个单元保持 `PLANNED`，需要后续增量授权。

### 必须确认

1. 授权包与范围/证据审计报告一致，无未决阻断项。
2. 明确签署的是「授权包」，不是「I-02 已完成」。
3. I02-01 状态改为 `AUTHORIZED`；I02-02～05 保持 `PLANNED`。
4. 确认 R1 / R2 的通过条件与增量授权序列。
5. 确认 I02-03 / I02-04 的先后与各自授权条件。
6. 确认本图到此收口；后续实现是独立 effort，不得从本图推导授权。

### 输出

签署记录写入授权包 §签署表；本图 `Status: closed`，`Decisions so far` 补上最终授权包条目。

### 下游

无（地图收口）。
