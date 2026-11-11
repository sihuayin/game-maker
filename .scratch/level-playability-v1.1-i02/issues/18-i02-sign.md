# I02-SIGN 授权包签署

Type: grilling
Status: resolved
Owner: amber
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

## Answer

**用户 `amber` 于 2026-11-11 签署授权包。** 签署范围：**首次签署，仅放行 U1**。

| 项 | 值 |
| --- | --- |
| 签署对象 | `docs/v7.8/移动-I02.md` |
| 签署依据的审计版本 SHA | `afb1fbe99ba972796b634d7de2dbe343c5551e7a129b24037944c7978b1df9ad`（I02-AUDIT `SIGN-READY`） |
| 签署后文档 SHA | `797cd6fc7b299e22b6e90b9ef8a9567376ea3a914d70f8b6f1fc0f9a6ecedc56` |
| 签署人 | `amber` |
| 日期 | 2026-11-11 |

### 逐项确认

1. **与审计报告一致，无未决阻断项**：I02-AUDIT 结论 `SIGN-READY`（仅 U1）；F1–F4 已修，F5 自审限制与 F6 条件已记录。
2. **签署的是授权包，不是「I-02 已完成」**：本签署不表示 I-02 算法已实现、已验收或已发布；授权包 §1 / §15.3 已写明。
3. **授权状态**：
   - I02-01（U1）→ `AUTHORIZED`；
   - I02-02（U2）、I02-03（U3）、I02-05（U5）→ `PLANNED`；
   - I02-04（U4）→ **`BLOCKED`**，待 `graph.ts` 独立增量审批。
   SIGN 票的「其余四个单元保持 `PLANNED`」是初始表述；[D8](14-i02-d8-review-gates.md) 对 U4 的 `BLOCKED` 更具体，以 D8 与授权包 §7.3 为准。
4. **R1 / R2 与增量授权序列确认**：R1(U1) → R2(U2) → R3(U3) → R4(U4)；U5 由完成报告 + AC-08～AC-13 验收；每次复核 PASS 只允许**申请**下一单元的增量授权，不自动授权。
5. **I02-03 / I02-04 的先后与条件确认**：I02-03 先完成并通过 R3，才允许进入 I02-04；I02-04 还需要 `graph.ts` 独立审批；未批时 U4 保持 `BLOCKED`。
6. **本图收口**：I-02 授权包交付完成；后续实现是**独立 effort**，不得从本图推导任何授权。公共 `PUBLIC_NB` / `PUBLIC_PU` 仍为 `BLOCKED`。

### 签署后的授权台账

| 项 | 状态 |
| --- | --- |
| U1 连续时间求交 | `AUTHORIZED` |
| U2 安全通过 Witness | `PLANNED` |
| U3 永久封锁门 | `PLANNED` |
| U4 垂直规避图割 | `BLOCKED` |
| U5 预算 / 确定性 / 集成 | `PLANNED` |
| `PUBLIC_NB` | `BLOCKED` |
| `PUBLIC_PU` | `BLOCKED` |

### 下游

无。地图收口；实现 / I-03 接入 / 公共 Verdict 均需另开 effort 与独立授权。
