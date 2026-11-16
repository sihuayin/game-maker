# I03-IMPL-07 验收与关闭计划

Type: grilling
Status: resolved
Owner: claude (I03-IMPL-07 session 2026-11-16)
Blocked by: 06
Map: ../map.md
Class: I-03-IMPL / ACCEPTANCE

## Question

为 I-03 实施产出最终验收与关闭计划，至少覆盖：

- 授权包 §10 的 AC-01–AC-21（required 19；AC-11 / AC-15 phase-1 `NOT_RUN`）；
- G1–G11、N1–N18、T-55–T-65、LP-06 / LP-07、全量 vitest / build / check:deps / check:links；
- E1 / E2 / E3；报告固定路径 `.scratch/level-playability-v1.1-i03/reports/I03-acceptance.md`；退出码 0 / 1 / 2 与 `PASS / FAIL / INCOMPLETE`；
- L1–L8 固定披露；
- 正常关闭与中止关闭（逆序回滚、Ledger 完整、无未解决 STOP）；
- **关闭 ≠ 开放**：`PUBLIC_NB` / `PUBLIC_PU` 仍 `BLOCKED`；`publicResult=null`；发布拒稿行为不变；
- **明确：本计划不写代码**；验收由未来执行会话按单元完成后运行。

## Answer

**Q1–Q7 = A。** 本计划是 I-03 实施完成后的验收 / 关闭规格，**不授权本会话执行验收或实施**。

### 0. 双重收口与计划边界

- **规划地图收口**：I03-IMPL-07 resolve 后，7 张票全部完成，地图 `Status: closed`；交付协议、U1–U5 五份 brief、本验收计划。**不写产品代码、不跑实施验收、不开放能力。**
- **实施收口**：未来独立实施 effort 完成后按授权包 §11.6 处理；本计划只给验收 / 关闭清单，不代替实施验收。
- 本会话只提交 docs（票 + 地图），不修改 `packages/**`、不跑测试、不创建验收报告。

### 1. 验收会话的独立性与前置条件（Q1）

未来验收必须由 **fresh 独立会话**执行，且该会话：

- 未参与 U1–U5 实现；
- 未参与本地图规划；
- 不以作者总结作为 PASS 依据；
- 直接检查原始授权、复核、证据与 Ledger；
- 现场复算授权包 hash，并重新运行验收命令。

固定输入：

- 已签署授权包：签署前 `sha256:2f89d572008b538be5871fef11d9f539e16829d1f4ceafe6e25a8a250fb9a52e`、签署后 `sha256:f45332bedd87209353a6f3e482408484151deed788c42996e36436437e1120cb`；
- 独立审查报告：`sha256:40af4b4b243abf1fbaac5a794cf1a8ccaf32b65e3c7ed29278e1d21502feed09`；
- U1–U5 独立授权记录、复核报告、证据；
- 授权包 §12.2 Ledger；
- U3 合并后的 `main` SHA。

**hash 边界**：上述 hash 是规划锚点；未来验收必须核对实际字节并复算**完整** hash，不得只比较前缀，不得因记录了预期值就默认文件可信。hash 不符、签署链不完整、证据引用无法解析 ⇒ 记录 `FAIL` / `NOT_RUN`，不得自行修补历史记录。

### 2. AC 矩阵模板与证据映射（Q2）

报告必须逐项覆盖 AC-01–AC-21：

| 字段 | 要求 |
| --- | --- |
| AC id | AC-01–AC-21 |
| required | 明确标记（required 19） |
| 证据级别 | E1 / E2 / E3 |
| 证据来源 | 测试名 / `file:line` / 命令 |
| 状态 | `PASS` / `FAIL` / `NOT_RUN`（计划阶段不预填） |
| 证据路径 + hash | 可复核的原始证据引用 |
| 备注 | 限制、偏差、失败原因 |

**AC → 证据源映射（模板，不预填状态）**：

| AC | 证据源 | 备注 |
| --- | --- | --- |
| AC-01–AC-04 | U1 `playability-temporal-evidence.test.ts` / `playability-api.test.ts` / `evidence/U1` | 映射 / coverage / lag / 不泄漏内部 |
| AC-05–AC-09 | U2 `playability-public-verdict.test.ts` / `evidence/U2` | Verdict 映射 / 优先级 / 冲突 / 非阻断 |
| AC-10 | U1 + U2 + U4 `ops.test.ts` / `evidence/U4` | NB 准入 synthetic + 集成 smoke |
| AC-11 | U2 / U4 | **非 required；phase-1 `NOT_RUN`**；PU 条件 2 / 5 `BLOCKED` |
| AC-12 | U2 / U4 | 假 NB / 假 PU 全局关闭；若 phase-1 无 global gate 实现，按实际证据判 `NOT_RUN` |
| AC-13 | U2 `playability-public-verdict.test.ts` | NB ≠ PU |
| AC-14 | U2 / U4 | 几何消费只认 I03-03C；probe 未实现时按实际证据判 |
| AC-15 | U1 / U4 | **非 required；phase-1 `NOT_RUN`**；probe 未实现 |
| AC-16 | U5 `publish-gate.test.ts` / `evidence/U5` | G1–G11 + 变异守卫 |
| AC-17 | U5 `publish-gate.test.ts` | 不落盘 / 不打印 / 不升契约 |
| AC-18 | U1–U5 diff / 架构守卫 / `evidence/*` | 白名单 / 无新依赖 |
| AC-19 | U4 `temporal-input.test.ts` T-58 | 允许 stub + 指定 analyzer |
| AC-20 | U1–U5 Ledger / 复核门 / 回滚演练 | 五道门 + 无预填 |
| AC-21 | U1–U5 全量回归 / LP-06/07 / 确定性 | 见 §3 |

- AC-11 / AC-15 非 required；phase-1 `NOT_RUN` 必须显式披露。
- 禁止通过率、加权、分组 PASS、多数决替代逐条判定。
- 每条 AC 必须有明确判据；不得由某个测试整体通过推导其他 AC。
- 计划阶段所有状态保持未填；验收会话按实际证据填。

### 3. 回归命令、顺序与环境（Q3）

未来验收按以下顺序执行并留痕：

1. **基线**：U3 合并后 `main` SHA、授权包 hash、干净 `git status`、OS / Node / pnpm 版本。
2. `pnpm test`：记录 Vitest 文件数、测试数、退出码、runner 警告。
3. `pnpm build`：`tsc -b` + bundle。
4. `pnpm check:deps`。
5. `pnpm check:links`。
6. **T-55–T-65** 架构守卫逐项列出（包含在 `pnpm test`，报告单独引用）。
7. **LP-06 / LP-07 原命令**；冻结基线 **20 unique configs / 96 pairs / 19 个 x 轴移动 Hazard**；不得把“19 关”当作唯一 config 数。
8. 对冻结 LP-06 输出逐项比较，核对 20 config 的 IE 结果；记录排除 `generatedAt` 后的语义 hash。
9. **跨进程确定性**：执行 I-02 U5 冻结命令；记录环境 / 输出 / hash；比较实际输出，不以命令成功代替 PASS。
10. 披露 **L1–L8**；不得隐去或包装为通过。

**LP-06/07 tracked evidence 隔离**：

- 优先在干净 worktree 运行；
- 或复制到 `/tmp` 后比较；
- 若在原 worktree 执行，比较完成后必须恢复 tracked evidence，并验证 `git status` 干净。

**退出码边界**：命令退出码 0 只说明命令正常结束；输出与冻结基线不一致仍可构成 `FAIL`。

### 4. 报告格式、退出码与整体状态（Q4 + Q7）

**固定报告路径**：`.scratch/level-playability-v1.1-i03/reports/I03-acceptance.md`。

**固定章节**：

1. 基线 SHA / 验收代码 SHA / 环境；
2. AC 索引；
3. 负向矩阵（G1–G11、N1–N18）；
4. 回归命令、退出码与 hash；
5. L1–L8；
6. 整体状态；
7. 用户签署记录。

**整体状态**：

| 条件 | 整体状态 |
| --- | --- |
| 所有 required AC 均 PASS | `PASS` |
| 任一 required AC 为 FAIL | `FAIL` |
| 无 required FAIL，但至少一项 required 为 NOT_RUN | `INCOMPLETE` |

**退出码（Q7=A，严格按已签署授权包 §10.5）**：

| 退出码 | 含义 |
| --- | --- |
| `0` | 没有 required FAIL；**不代表整体 PASS**，仍需检查 `NOT_RUN` |
| `1` | 至少一个 required FAIL |
| `2` | 验收输入 / 基线 / 报告结构无效 |

- `INCOMPLETE` 是**报告整体状态**，不占用 exit 2；无 required FAIL 但存在 required `NOT_RUN` 时，验收命令仍退出 `0`，报告状态写 `INCOMPLETE`。
- 若同时存在 FAIL 与 required `NOT_RUN`：优先 `1` / `FAIL`，但逐项保留 `NOT_RUN`。
- 报告由独立验收会话撰写；**用户审阅并签署**；验收会话不得替用户签署。

### 5. 关闭计划（Q5）

**正常关闭（未来实施 effort，按 §11.6）**：

- U1–U5 全部完成独立复核与用户签署；
- Ledger 完整；
- 全量测试、类型检查、依赖守卫全绿；
- `PUBLIC_NB` / `PUBLIC_PU` 仍 `BLOCKED`；
- `publicResult=null`；
- 发布拒稿行为与退出码不变；
- 无未解决 STOP。

**中止关闭**：

- 按逆序 `U3 → U5 → U4 → U2 → U1` 回滚全部已落地单元；
- 回到各单元实施前基线；
- 重新运行全量测试与依赖守卫；
- Ledger 记录中止原因、实际回滚 SHA、最终验证结果。

**关闭 ≠ 开放**：正常关闭只表示生产接线、证据映射、诊断接管与复核完成；`PUBLIC_NB` / `PUBLIC_PU` 开放是独立的后续准入决策。

### 6. 交付形态、提交与证据边界（Q6）

- 本计划只写在本票 Answer；不另建 `reports/07-acceptance-plan.md`。
- 本会话只提交 docs（票 + 地图）；不写产品代码、不跑实施验收、不改 `packages/**`。
- 未来验收报告固定放授权包路径；`.scratch` 证据是审计材料，不预授权进入产品 PR。
- 地图 / 票 docs-only PR → `main`。

### 7. L1–L8 固定披露

| 编号 | 已知限制 | 验收处理 |
| --- | --- | --- |
| L1 | LP-06/07 无 Vitest、不在 CI | 原命令 scratch 重跑；记录限制 |
| L2 | Runtime hitbox equality 未证 | 不得宣称 Runtime 几何已 checked |
| L3 | PU 条件 5 未闭合 | AC-11 `NOT_RUN` / `BLOCKED`；不得被其他 PU 条件 PASS 抵消 |
| L4 | 几何 probe 未实现、夹具未物化 | AC-15 `NOT_RUN`；未来 probe 成功仍须 I03-03C 独立复核 |
| L5 | 19 关语料只承担 IE 不回归 | 不得用作 NB / PU 正例 |
| L6 | 不新增性能基准 | 沿用 I-02 / U5 预算证据 |
| L7 | 跨进程确定性检查为 scratch、非 CI | 记录命令、环境、输出及 hash |
| L8 | 验收全绿不等于能力开放 | `PUBLIC_NB` / `PUBLIC_PU` 继续 `BLOCKED` |

### 8. 最终冻结结论

- **独立验收**：fresh 会话，原始证据复核，不接受作者自证。
- **逐项判定**：AC-01–AC-21 全量映射；required 19 条不可加权。
- **完整回归**：全量测试、构建、依赖守卫、T-55–T-65、LP-06/07、跨进程确定性、L1–L8。
- **严格状态**：`PASS / FAIL / INCOMPLETE`；退出码 `0 / 1 / 2` 与整体状态分离；exit 2 仅表示 invalid input（Q7=A）。
- **双重收口**：规划地图收口与未来实施关闭完全分开。
- **文档交付**：只规划、不实施、不验收、不开放能力。

### 9. 边界

本计划 **不构成实施授权、不构成验收执行、不构成能力开放**。`PUBLIC_NB` / `PUBLIC_PU` 仍 `BLOCKED`；U1–U5 实施与最终验收仍需各自的独立授权 / 复核 / 签署 / Ledger。
