# I03-08 验收矩阵、负向测试、回归与证据格式

Type: grilling
Status: open
Owner: —
Blocked by: 02, 03, 04, 05, 06, 07
Map: ../map.md
Class: I-03 / DECISION

## Question

I-03 授权包的验收矩阵：AC、负向测试、回归、E1 / E2 / E3 证据与逐项 `PASS / FAIL / NOT_RUN`。

### 必须裁定

- 内部 → 公共映射的正 / 负例；IE 不得 → NB；
- `PUBLIC_NB` / `PUBLIC_PU` 未准入时不得发布；
- `coverage.temporal` / 几何 gate / publish-gate 行为不变的断言；
- 回归：LP-06/07、现有 playability tests、T-55/57/58/61/62/64；
- 证据格式、报告路径、退出码 / hash；
- 不得用总通过率替代逐项状态。

### 禁止

- 用测试全绿替代准入授权；
- 把 IE 当安全结论；
- 把未运行项写成通过。

### 验收

AC 表（逐项）、负向矩阵、回归清单、证据格式、未覆盖项。

## Answer

（resolved 时填写）
