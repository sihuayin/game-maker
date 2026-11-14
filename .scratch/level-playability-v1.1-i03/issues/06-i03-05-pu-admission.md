# I03-05 PUBLIC_PU 独立准入链

Type: grilling
Status: open
Owner: —
Blocked by: 01, 02, 03, 04, 13, 14, 15
Map: ../map.md
Class: I-03 / DECISION

## Question

`PUBLIC_PU` 的独立准入条件与持续 `BLOCKED` 的机制；至少覆盖几何 `checked`、空中控制 / 模型外规避闭合、hop 图割与加倍采样完整性、I-00 六项 PU 条件、独立审查与增量授权。

### 必须裁定

- 每项条件的证据与 gate；
- PU 与 NB 的独立性；
- 任何一项未满足时 `publicCapability="BLOCKED"` 的表达；
- 假 PU 的负向测试与停止规则；
- 不得因 NB 通过推导 PU 可用。

### 禁止

- 在几何 / 空中控制 / hop 未闭合时开放 PU；
- 用内部 `pu-candidate` 直接发布 `PROVEN_UNPLAYABLE`；
- 把 NB 准入当作 PU 准入。

### 验收

PU 条件表、gate 状态、独立审查 / 授权路径、负向场景、持续 BLOCKED 的机制。

## Answer

（resolved 时填写）
