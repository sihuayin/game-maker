# I02-AUDIT 范围与证据审计

Type: task
Status: resolved
Owner: amber
Blocked by: 16
Map: ../map.md
Class: I-02 / DELIVERABLE

## Question

对 I-02 授权包做范围审计与证据审计，判断是否达到「可签署」。**审计不放过缺项，也不替用户签署。**

### 必须完成

1. **范围审计**：
   - 白名单增量是否与 I-00 §11、用户 2026-11-10 裁定一致；
   - 是否有白名单外文件被偷偷纳入；
   - `graph.ts` / `profile.ts` / `fixtures/packs/**` 的「需单独裁定」项是否被正确处理；
   - 是否越界到 I-03 生产接入 / Runtime / CLI / MCP / 公共 Contract / 新依赖。
2. **证据审计**：
   - 每条结论是否有 E1/E2/E3 证据；
   - 链接是否可解析；SHA 是否可复算；命令是否可复现；
   - scratch 结果是否被错误表述为生产验收；
   - 是否修改过产品目录（必须为否）。
3. **完整性审计**：
   - 五个单元是否完整定义；授权状态是否正确；
   - R1/R2 清单是否可执行；
   - I02-03 / I02-04 的依赖、先后、授权条件是否明确；
   - 冲突登记表是否覆盖已知冲突且无静默消解；
   - 非目标 / 停止条件 / 退出条件是否齐全。
4. **可签署性判断**：`SIGN-READY` / `BLOCKED`，逐项列出阻断项与需要的裁定。

### 输出

`reports/02-auth-audit.md`，含检查表、证据链接、阻断项、结论。

### 下游

I02-SIGN。

## 上游裁定（D8，2026-11-11）

审计必须检查：单元授权与能力授权是否分离；U4 是否被误标为 `AUTHORIZED`；R4 是否被误写成最终能力授权；预算接口是否被写成独立实施单元；`PLANNED` 是否被读成隐含授权。

## Answer

**AFK task 已完成。** 审计报告：[`reports/02-auth-audit.md`](../reports/02-auth-audit.md)。

**结论：`SIGN-READY`（仅限首次签署 U1）**；无阻断首次签署 U1 的缺项。

**修改产品目录：否**（`git diff --stat a3b8a54..HEAD -- packages/` 为空；仅授权包、审计报告、本票与地图）。

### 1. 审计结果

| 维度 | 结果 |
| --- | --- |
| 范围审计（白名单、`graph.ts`、`profile.ts`、fixtures、I-03 边界、产品目录） | **PASS**（F1/F2 修正后） |
| 证据审计（E1/E2/E3、链接、SHA、命令、scratch 口径） | **PASS**（05/06 语义复现，见 F4） |
| 完整性审计（五单元、状态、R1/R2、I02-03/04、冲突登记、停止条件） | **PASS** |
| D8 专项（单元 ≠ 能力、U4 非 AUTHORIZED、R4 非最终能力、预算非独立单元、PLANNED 非隐含授权） | **PASS** |

### 2. 发现与处置

- **F1（已修）**：`temporal-input.ts` 未显式列入禁止清单 ⇒ 授权包 §5.3 补入。
- **F2（已修）**：未显式禁止新增 JSON fixture ⇒ 授权包 §5.3 / §5.5 补入。
- **F3（已修）**：行数口径不一致 ⇒ AUTH 票 / 地图改为「约 1,020 行」。
- **F4（已修）**：05 / 06 的 `run.json` 含墙钟 / `generatedAt`，SHA 只能作快照 ⇒ 授权包 §14 补说明；复现以 `checks`、`stateSignature`、分布、`determinism` 为准。
- **F5（记录）**：本审计由授权包作者会话执行，不是独立第三方；用户签署是独立门，R1–R4 仍按 D8 要求独立复核。
- **F6（记录）**：`B-02` `OPEN`、`B-11` `PARTIAL`、`B-03/04/13` `DEFERRED TO I-03`、U4 `BLOCKED`、`PUBLIC_NB/PU` `BLOCKED`。均不阻断首次签署 U1。

### 3. 授权包最终状态

- 路径：`docs/v7.8/移动-I02.md`
- SHA-256：`afb1fbe99ba972796b634d7de2dbe343c5551e7a129b24037944c7978b1df9ad`
- 审计记录已写入授权包 §15.1 / §15.4。

### 4. 可签署范围

- 首次签署**只放行 U1**；
- U2/U3/U5 保持 `PLANNED`；U4 保持 `BLOCKED`；
- `PUBLIC_NB` / `PUBLIC_PU` 保持 `BLOCKED`；
- 超出 U1 的签署范围需要对应复核门 + 增量签署；`B-02` 与 Runtime hitbox equality 仍是公共 PU 的独立阻塞。

### 5. 下游

**I02-SIGN**：由用户签署；首次签署只放行 U1。审计不替用户签署，也不产生实施授权。
