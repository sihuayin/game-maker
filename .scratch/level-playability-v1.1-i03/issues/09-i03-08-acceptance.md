# I03-08 验收矩阵、负向测试、回归与证据格式

Type: grilling
Status: resolved
Owner: claude (I03-08 session 2026-11-14)
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
**Q1=A / Q2=A / Q3=A / Q4=A / Q5=全冻结 / Q6=通过 / Q7=通过 / Q8=通过 / Q9=通过。**
冻结 I-03 验收矩阵：**21 条 AC（6 组，required 19 条）**、18 条负向、回归清单、E1/E2/E3 证据与报告结构。
本票只定义验收与证据汇总层；**不授权 U1–U5 实施，不改变 `PUBLIC_NB` / `PUBLIC_PU` 的 `BLOCKED` 状态**。

### 0. 冻结原则

1. **验收矩阵只判断 I-03 交付是否满足既定契约**，不重新定义各票的事实源。
2. **不得把未实现 / 未运行的能力包装成通过**；`NOT_RUN` 必须显式披露，不能计入 PASS。
3. **不得用总通过率、加权分、多数决或分组 PASS 替代逐项状态。**
4. **I03-08 是验收与证据汇总层，不是新的能力实现层**：只能消费 I03-01～I03-07 已定义的契约、准入条件、复核结果与回归证据；不得在验收阶段补实现、放宽判据、修改能力 gate，或把 `NOT_RUN` 解释为通过。
5. 验收全绿 **不等于** `PUBLIC_NB` / `PUBLIC_PU` 开放。

### 1. 分组（Q1）

| 分组 | 验收范围 | 主要依赖 |
| --- | --- | --- |
| **G1 映射** | 内部时序结果 → 公共证据映射 | U1、U4 |
| **G2 Verdict / coverage** | 三态、`coverage.temporal`、旧 Verdict 优先级 | U1、U2 |
| **G3 几何与 NB / PU 准入** | 几何证据、NB / PU 条件、能力门控 | U1、U2、U4 |
| **G4 发布闸** | G1–G11、诊断字段、拒稿行为不变 | U5 |
| **G5 实施边界与回滚** | 白名单、架构守卫、Ledger、回滚演练 | U1–U5 |
| **G6 回归** | 全量测试、LP-06/07、确定性及跨包回归 | U1–U5 |

每条 AC 必须包含：唯一编号、明确判据、依赖单元、证据级别（E1/E2/E3）、必需证据路径或测试名、`PASS / FAIL / NOT_RUN`、是否 required。

### 2. 逐项状态与整体语义（Q2）

| 状态 | 定义 |
| --- | --- |
| `PASS` | 判据已由要求的证据完整证明 |
| `FAIL` | 已执行且证据违反判据 |
| `NOT_RUN` | 未执行、证据缺失、依赖尚未满足，或无法完成判断 |

**整体验收**：只有全部 required AC 均为 `PASS` 时，整体才可写 `PASS`。任一 required AC 为 `FAIL` 或 `NOT_RUN` ⇒ 整体不得写 `PASS`。

补充：

- `NOT_RUN` **不能**通过“不适用”标签自动转成 `PASS`；确实不适用的项目必须有预先定义的适用性判据与理由，并在矩阵中明确标记；不得事后为通过验收改变 required 属性。
- 非 required AC 即使 `NOT_RUN`，也必须在报告中披露，不能从矩阵隐藏。

### 3. AC 矩阵（Q6）

| ID | 判据 | 依赖 | 证据 | required |
| --- | --- | --- | --- | --- |
| **G1 映射** | | | | |
| AC-01 | 公共 temporal evidence 只含 `model / lag / degradation / limits` + `kind:"temporal"` witness；不泄漏内部 Proof / Witness / 原始 perLag | U1、U4 | E1+E2 | 是 |
| AC-02 | D9 全部内部 degradation 码 many-to-one 映射到 13 个公共值；未知码不透传、不静默降级 | U1 | E2 | 是 |
| AC-03 | `coverage.temporal ∈ {checked, partial, unknown}`；缺失按 `unknown`；无移动 Hazard ⇒ 不适用、不拉 IE；不得写成 `checked` | U1、U2 | E2 | 是 |
| AC-04 | `perLag` 恰好两档 `[主档, 基准档]`，各档结论字段完整；不含原始 Witness | U1 | E2 | 是 |
| **G2 Verdict / coverage** | | | | |
| AC-05 | gate `BLOCKED` 时 `nb-candidate` / `pu-candidate` 一律公共 IE；不得产 NB / PU | U2 | E2 | 是 |
| AC-06 | 优先级 `existing PU > existing IE > temporal IE > NB`；temporal 不得削弱 PU 或把 IE 改成 NB | U2 | E2 | 是 |
| AC-07 | 无移动 Hazard ⇒ temporal 缺省且 verdict 不变；有移动 Hazard 而缺字段 ⇒ `unknown` ⇒ IE；IE 永不升级 | U2 | E2 | 是 |
| AC-08 | `PLAYABILITY_TEMPORAL_EVIDENCE` 非阻断：不产 `ConfigIssue` / warning / error；`playabilityIssues` 映射不变 | U2 | E2 | 是 |
| AC-09 | existing PU + temporal candidate + 对应 gate `OPEN` ⇒ STOP + HITL，不得静默择一 | U2 | E2 | 是 |
| **G3 几何与 NB / PU 准入** | | | | |
| AC-10 | NB 准入规则：几何 hazard + player（必要时 graph）checked、temporal checked、双档完整一致、witness COMPLETE、预算 / 确定性 / 体积 / 映射、固定夹具；任一不满足不得 ADMITTED（synthetic fixture 驱动） | U1、U2、U4 | E2+E3 | 是 |
| AC-11 | PU 六条件逐项 PASS 才 ADMITTED；任一 `BLOCKED / IE / NOT_RUN` 不得 ADMITTED；条件 2 / 5 当前硬阻断 | U2、U4 | E2 | **否（phase-1 NOT_RUN）** |
| AC-12 | 假 NB / 假 PU ⇒ 全局 gate 关闭 + 证据基线失效 + 受影响结果 IE；关闭优先于缓存 / 历史 / 逐关 | U2、U4 | E2 | 是 |
| AC-13 | NB ≠ PU；NB 的 `NO_PROVEN_BLOCKER`、`midAirHits=0`、conditional graph cut 均不得作为 PU 正面证据 | U2 | E2 | 是 |
| AC-14 | 几何消费只认 I03-03C 分项 PASS；probe 退出码 / `all-checked` 不能替代；环境不匹配 ⇒ partial，不判 untrusted | U2 | E1+E2 | 是 |
| AC-15 | 真实几何 probe 实施 + I03-03C 独立复核报告（14 正例行 + 10 负例）完成并一致 | U1、U4 | E2+E3 | **否（phase-1 NOT_RUN）** |
| **G4 发布闸** | | | | |
| AC-16 | G1–G11 全过；拒稿行为不变、无新增 `throw`、temporal 证据不产 `CommandError` | U5 | E2 | 是 |
| AC-17 | temporal 诊断不落盘、不进 CLI / MCP、不升契约；缺省 ≠ 不适用；现有 publish-gate / create-game 断言零改动 | U5 | E1+E2 | 是 |
| **G5 实施边界与回滚** | | | | |
| AC-18 | 每单元 diff 只含白名单文件与限定目的；无新依赖；T-56/57/58/60/61/62/64 按冻结语义；无新增生产调用者 | U1–U5 | E1+E2 | 是 |
| AC-19 | T-58 按批准语义改写：允许 stub 与指定适配器、禁止其他 analyzer；正负路径均有断言 | U4 | E1+E2 | 是 |
| AC-20 | 每单元五道复核门证据、Ledger 完整、U4/U5/U3 回滚演练、无预填；关闭条件满足（gate `BLOCKED`、`publicResult=null`、拒稿不变、无未解决 STOP） | U1–U5 | E2+E3 | 是 |
| **G6 回归** | | | | |
| AC-21 | 全量 vitest + `tsc -b` + `check:deps` + `check:links` + build 全绿；LP-06/07 原命令重跑与冻结基线逐项一致；19 关 IE 不回归；跨进程确定性 scratch 通过 | U1–U5 | E2+E3 | 是 |

- **required = 19 条**（AC-01～AC-10、AC-12～AC-14、AC-16～AC-21）。
- **AC-11 / AC-15 预先定义为非 required**，phase-1 必须披露 `NOT_RUN`；该属性不得事后修改。
- 约 20 条是目标规模，不是硬配额：不拆无独立判据的条目，也不合并不同失败原因。

### 4. 负向矩阵（Q7）

| # | 场景 | 期望 | 归属 |
| --- | --- | --- | --- |
| N1 | `nb-candidate` + gate `BLOCKED` | 公共 IE，不是 NB | AC-05 |
| N2 | `pu-candidate` + gate `BLOCKED` | 公共 IE，不是 PU | AC-05 |
| N3 | temporal `checked` + gate `BLOCKED` | 仍是 IE；不得因 checked 发布 | AC-05 |
| N4 | 无移动 Hazard + temporal 缺省 | verdict 不变，不拉 IE | AC-07 |
| N5 | 有移动 Hazard + temporal 缺省 | `unknown` ⇒ IE | AC-07 |
| N6 | `partial` / `unknown` + existing NB | IE；不得聚合为 NB | AC-06 |
| N7 | existing PU + temporal candidate + gate `OPEN` | STOP + HITL | AC-09 |
| N8 | existing IE + temporal candidate | 保持 IE | AC-06 |
| N9 | temporal evidence 被映射成 `ConfigIssue` | 禁止 | AC-08 |
| N10 | `partial` / `unknown` 被写成 `checked` | 禁止 | AC-03 |
| N11 | NB 结果被当作 PU 正面证明 | 禁止 | AC-13 |
| N12 | `midAirHits=0` / conditional graph cut 作为条件 5 证据 | 禁止 | AC-13 |
| N13 | 假 NB / 假 PU | 全局关闭 + 基线失效 + IE + 关闭优先 | AC-12 |
| N14 | probe 退出 0 / `all-checked` 当作分项 checked；环境不匹配判 untrusted | 禁止 | AC-14 |
| N15 | 发布闸 G1–G11（引用 I03-06） | 全部照旧 | AC-16 |
| N16 | gate 已关闭但缓存 / 历史产物 / 逐关结果仍返回 NB / PU | 禁止 | AC-12 |
| N17 | `NOT_RUN` 被计入 PASS 或从矩阵隐藏 | 禁止 | 全局规则 |
| N18 | 白名单外修改、新增生产调用者、新依赖 | STOP | AC-18 |

- N15 只引用 I03-06 的 G1–G11，不复制内容。
- N13 / N16 的细节引用 I03-04 §7 / I03-05 §4 的关闭优先级与基线失效规则。

### 5. 回归范围（Q3 / Q8）

| 类别 | 执行要求 |
| --- | --- |
| Vitest | `pnpm test`，全量，不只跑相关包 |
| 类型 / 构建 | `pnpm build`（`tsc -b` + bundle） |
| 依赖 / 链接 | `pnpm check:deps`、`pnpm check:links` |
| 架构守卫 | T-55 / 56 / 57 / 58 / 59 / 60 / 61 / 62 / 63 / 64 / 65 全部执行 |
| LP-06 | `pnpm build && node .scratch/level-playability-v1-p1/acceptance-corpus.mjs` |
| LP-07 | `pnpm build && node .scratch/level-playability-v1-p1/acceptance-matrix.mjs` |
| 跨包回归 | `packages/contracts/tests/playability-*.test.ts`、`packages/pipeline/tests/{publish-gate,create-game}.test.ts`、`packages/assets/tests/ops.test.ts` |
| 确定性 | 沿用 I-02 U5 冻结的跨进程命令与输出，不改语义 |

- LP-06/07 **保持原命令**，不迁移进 Vitest、不包装成 CI、不修改执行语义。
- LP-06/07 通过只说明既有语料 / 矩阵未发生未批准回归，**不**代表 I-03 的 NB / PU 正例已验证。
- 19 关语料只承担 IE 不回归，不构成 NB / PU 正例。

### 6. 证据格式、报告与退出码（Q4 / Q9）

沿用 I-02 定义：

- **E1**：源码 / 契约 `file:line`；
- **E2**：测试名 + 断言 + 退出码；
- **E3**：scratch 复跑（命令、路径、计数、原始输出摘要）。

报告固定路径：`.scratch/level-playability-v1.1-i03/reports/I03-acceptance.md`。

报告固定章节：

1. 基线 commit SHA、验收代码 commit SHA、执行环境；
2. AC 索引：判据、required、`PASS / FAIL / NOT_RUN`、E1/E2/E3 引用、测试名 / 文件路径 / 输出 hash；
3. 负向矩阵 N1–N18 的逐项结果；
4. 回归命令、退出码、日志 hash、LP-06/07 输出 hash；
5. 已知限制 L1–L8；
6. 整体状态：`PASS` / `FAIL` / `INCOMPLETE`；
7. 签署记录。

退出码：

| 退出码 | 含义 |
| --- | --- |
| `0` | 没有 required AC 为 `FAIL`；**不代表整体 PASS**，仍需检查 `NOT_RUN` |
| `1` | 至少一个 required AC 为 `FAIL` |
| `2` | 验收输入、基线或报告结构无效，无法可靠判断 |

- required AC 全部 PASS ⇒ 整体 `PASS`；任一 required FAIL ⇒ `FAIL`；无 FAIL 但有 required `NOT_RUN` ⇒ `INCOMPLETE`。
- 报告是验收事实记录；退出码只是执行状态信号，不能取代报告。

### 7. 已知限制 / 未覆盖项（Q5）

| 编号 | 已知限制 | 验收处理 |
| --- | --- | --- |
| L1 | LP-06/07 无 Vitest、不在 CI | 原命令 scratch 重跑；记录限制 |
| L2 | Runtime hitbox equality 未证 | 不得宣称 Runtime 几何已 checked |
| L3 | PU 条件 5 未闭合 | AC-11 为 `NOT_RUN` / `BLOCKED`；不得被其他 PU 条件 PASS 抵消 |
| L4 | 几何 probe 未实现、夹具未物化 | AC-15 为 `NOT_RUN`；未来 probe 运行成功仍须 I03-03C 独立复核 |
| L5 | 19 关语料只承担 IE 不回归 | 不得用作 NB / PU 正例 |
| L6 | 不新增性能基准 | 沿用 I-02 / U5 已定义预算证据 |
| L7 | 跨进程确定性检查为 scratch、非 CI | 记录命令、环境、输出及 hash |
| L8 | 验收全绿不等于能力开放 | `PUBLIC_NB` / `PUBLIC_PU` 继续 `BLOCKED` |

- L2 与 L4 相关但不同：probe 产出证据，不自动证明真实 Runtime 与 manifest 几何一致。
- 八项限制在验收报告中**不得静默省略**。

### 8. 边界

- **全部进入 I-03 授权包**：I03-09 必须把 §0–§7 转录进 `docs/v7.8/移动-I03.md` 的验收、负向、回归与证据章节。
- **不授权 U1–U5 实施**；不改变 `PUBLIC_NB` / `PUBLIC_PU` 的 `BLOCKED` 状态。
- **不修改生产代码 / 测试 / fixture**；本票只产验收计划。
- 验收通过不构成公共能力开放、不构成单元增量授权、不替代 I03-10 独立审查与 I03-11 用户签署。

### 9. 下游

- **I03-09**：按 §2 / §3 / §4 组装授权包；不得把 `NOT_RUN` 写成已通过，不得预填 Ledger。
- **I03-10**：独立审查授权包与验收矩阵的一致性；核对 required 属性、L1–L8、退出码语义。
- **I03-11**：用户签署整包；单签不构成 U1–U5 授权，也不开放能力。
- **I03-PU-Air-Control-Closure**：条件 5 独立闭合；完成后只把 AC-11 从 `NOT_RUN` 推进到可执行，不自动 ADMITTED / OPEN。

## Comments

- 2026-11-14（I03-10 F2 修正）：AC-15 的负例计数由 10 更新为 11（含 `body-bounds-mismatch`）；AC-15 仍为 phase-1 `NOT_RUN`、非 required。
