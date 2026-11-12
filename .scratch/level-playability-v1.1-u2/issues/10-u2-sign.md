# U2-SIGN 用户签署 R2

Type: grilling
Status: open
Owner: —
Blocked by: 09
Map: ../map.md
Class: U2 / SIGN

## Question

用户审阅 `R2-review.md` 并签署，确认 U2 完成。**签署不等于 U3 授权。**

### 签署前提

1. R2 报告逐项 `PASS`；必要项没有 `NOT_RUN`；
2. 无阻断项 / 白名单外改动 / 公共导出 / 生产接线；
3. 用户已审阅报告与 diff。

### 签署动作

- 在 `.scratch/level-playability-v1.1-i02/reports/R2-review.md` 末尾签署栏记录：签署人、日期、结论、范围；
- 地图 `Status: closed`；
- `Decisions so far` 补 U2-R2 / U2-SIGN 条目；
- **不启动 U3**；U3 仍需 R2 PASS + 单独的增量签署。

### 失败处理

任一 `FAIL`、必要项 `NOT_RUN` 或用户拒绝签署 ⇒ 地图保持 open，U2 未完成，修复后重新 R2。

### 下游

无（U2 收口）。U3 实现是独立 effort / 独立授权。
