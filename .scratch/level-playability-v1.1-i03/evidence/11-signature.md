# I03-11 用户签署记录

| 项 | 值 |
| --- | --- |
| 签署人 | **amber** |
| 日期 | **2026-11-15** |
| 范围 | **仅 I-03 授权包** `docs/v7.8/移动-I03.md` |
| 签署前 hash（签署对象） | `sha256:2f89d572008b538be5871fef11d9f539e16829d1f4ceafe6e25a8a250fb9a52e` |
| 签署后 hash（含 §17.1 签署栏） | `sha256:f45332bedd87209353a6f3e482408484151deed788c42996e36436437e1120cb` |
| 独立审查 | `reports/I03-review.md` · `sha256:40af4b4b243abf1fbaac5a794cf1a8ccaf32b65e3c7ed29278e1d21502feed09`（PASS 23/23；F2 已修正） |
| F2 修正证据 | `evidence/10-f2-correction.md` · `sha256:17ea5f9137b9dbf3dbf7ab715fc26e598c0ee419ff94794a9b974584086a8c2a` |
| 结论 | **批准 I-03 授权包，作为后续实施 effort 的规划依据。** |
| 签署后状态 | I-03 授权包 `SIGNED`；U1 / U2 / U4 / U5 / U3 **仍 `NOT_AUTHORIZED`**；`PUBLIC_NB` / `PUBLIC_PU` **仍 `BLOCKED`**；I-03 实施 **`NOT_AUTHORIZED`** |
| 备注 | 签署对象是写入签署栏**之前**的授权包内容（`2f89d572…`）；签署栏写入后文件 hash 变为 `f45332be…`。两者都记录在本文件，避免把签署栏本身误当作被签署内容。 |

## 签署确认

1. 签署**不**自动授权 U1–U5；实施必须另开 effort，并按授权包 §11 / §12 逐单元取得增量授权。
2. 签署**不**开放 `PUBLIC_NB` / `PUBLIC_PU`；两者仍 `BLOCKED`，公共能力由各自准入链决定。
3. **不**改变 I-02 的 `publicCapability="BLOCKED"` / `publicResult=null`；适配层只消费，不回写 / 篡改。
4. **不**启动实施、**不**改生产代码、**不**推送 / 建 PR / 合并。

## 边界

本签署只建立后续实施依据；不表示 I-03 已实施、不表示任何实施单元已授权、不表示任何公共能力可开放。
`PUBLIC_NB` / `PUBLIC_PU` 仍 `BLOCKED`；I-03 实施仍 `NOT_AUTHORIZED`。
