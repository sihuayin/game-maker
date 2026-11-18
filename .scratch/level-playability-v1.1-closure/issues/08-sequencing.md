# 五 Wave 依赖与并行边界

Type: grilling
Status: resolved
Owner: claude (wayfinder session 2026-11-18)
Blocked by: 04, 05, 06, 07
Map: ../map.md
Class: V1.1-CLOSURE / DECISION

## Question

在 P1 已闭合的前提下，冻结 V1.1 剩余收口的依赖图与并行边界（Q11=A）。

必须裁定：

1. **Wave 结构**：Wave 1 `P2 ∥ P4 ∥ PU-C5`；Wave 2 `P5`（P4 后）∥ `P6`（P3 后）；`PU-ADMIT` 在 P6 + PU-C5 后（可与 P7 并行）；Wave 3 `P7`；Wave 4 `I-04`；Wave 5 `I-05` + 最终报告。
2. **启动条件**：每个 Wave 的前置签署 / 合并 / Ledger / 证据；哪些可以真正并行，哪些只是时间上重叠但必须独立授权。
3. **证据交接**：每个 Wave 向下游交付什么（P3 证据 → P6 → PU-ADMIT；P7 报告 → I-04；I-04 + PU-ADMIT → I-05）。
4. **禁越界**：I-04 不得在 P7 冻结基线前开跑；I-05 不得在 I-04 / PU-ADMIT 签署前开跑；PU-ADMIT 不得消费未签署的 P3/PU-C5 证据。
5. **失败/停止**：任一 Wave FAIL 或 STOP 时，下游如何处理；哪些已完成的证据仍可复用；是否回滚。
6. **关键路径与估算**：标注关键路径与每单元会话估算（沿用 I-00 的 3–4 / 2–3，补 PU-C5 / PU-ADMIT 估算）。

产出：Wave 依赖表 + 证据交接表；不执行任何 Wave。

## Answer

**Q1–Q10 = 用户裁定（2026-11-18，全部按推荐）。** 产出五 Wave 依赖表、启动条件表、证据交接表、失败传导表与会话估算；**未执行任何 Wave、未跑 probe / 测试、未改产品代码、未授权任何单元**。

### 1. 五 Wave（FIX 拆为包内两段门）

| Wave | 单元 | 排期说明 |
| --- | --- | --- |
| 1 | `P2 ∥ P4 ∥ PU-C5 ∥ FIX-A` | FIX-A = 可行性评审门（docs-only；不授权生产） |
| 2 | `P5 ∥ P6` | P5 ← P4 签署；P6 ← P3 签署（P3 是 P2 内的复核门） |
| 3 | `P7 ∥ PU-ADMIT` | PU-ADMIT ← P6 签署（排期前置）+ PU-C5 签署（硬边） |
| 4 | `I-04 ∥ FIX-B` | I-04 ← P7 报告签署并冻结；FIX-B ← PU-C5 签署 + `11` 裁定 |
| 5 | `I-05 5A → 5B` + 最终报告 | 5A ← I-04 + FIX 签署；5B ← 5A + PU-ADMIT 签署 |

FIX 仍是一行 Ledger、两个门（A 可行性 / B 生产），镜像 I-05 的 5A / 5B；`10` 的裁定正文不动。

### 2. Wave 语义

- **Wave = 拓扑层，不是屏障**：单元在自己的前置闭合后即可启动，不等同层其他单元全部闭合。
- **Wave 无独立状态**：只有单元有 `PASS / FAIL / INCOMPLETE`（或 `NOT_RUN` 等逐项态）；Wave 从不被判 PASS / FAIL。

### 3. 启动条件（四件套 + 单元特例）

所有单元统一要求「启动四件套」：① 上游授权签署（Phase-2 单元 = Phase-2 增量授权；收口单元 = 收口包签署 + 本单元增量授权记录签署）；② 硬边上游已「合并 + 签署 + Ledger 行闭合」；③ 切出时 `main` SHA 记入 Ledger「回滚目标 SHA」；④ 白名单与「不触碰项」逐条列出。

| 单元 | 授权硬边（`02` 冻结，不改） | `08` 排期前置（不改授权面） |
| --- | --- | --- |
| P2 / P4 | P1 CLOSED + Phase-2 增量授权 | — |
| P3 | P2 实现完成（P2 内的复核门） | — |
| P5 | P4 签署 | — |
| P6 | P3 签署 | — |
| P7 | P2–P6 签署 + 独立授权 | — |
| PU-C5 | 收口包签署 + 增量授权 | — |
| FIX-A | 收口包签署 | — |
| FIX-B | 收口包签署 + 可行性 PASS + 增量授权 | PU-C5 签署 + `11` 裁定（**不含 P6**） |
| I-04 | 收口包签署 + 增量授权 | P7 报告签署并冻结 |
| PU-ADMIT | 收口包签署 + PU-C5 签署 + `10` | P6 签署（可放弃，见 §5） |
| I-05 5A | I-04 + FIX 合并 / 签署 / Ledger | — |
| I-05 5B | 5A + PU-ADMIT 合并 / 签署 / Ledger | — |

**两个概念不得混用**：*授权硬边*由 `02` 冻结，改边须回开 `02`；*排期前置*只约束并行与顺序，不放宽任何授权，也不构成开工授权。

### 4. 证据交接

**管线事实（2026-11-18 只读核查）**：`create` / `build` 调用 `runTemporalAudit` 的 legacy 分支并丢弃结果（`packages/assets/src/ops.ts:1099-1109`、`packages/pipeline/src/create-game.ts:645-647`）；`qa-report` schema 无 temporal 字段（`packages/contracts/src/qa.ts:283-300`）；**唯一**产出并暴露时序证据的正式路径是 `publish-gate`（`packages/pipeline/src/publish-gate.ts:174-183`）。因此 FIX / I-05 的「完整正式路径」固定为 `build --reuse-*` → `publish-gate` 链。

| 上游 | 交付 | 下游 |
| --- | --- | --- |
| P2 → P3 | 探针 / 几何证据 + manifest（audit 分支） | P6 |
| P3 | 签署的几何背书（`checked` 需 `p3-signed`） | P6、PU-ADMIT 条件 2（经 P6） |
| P4 | NB 准入机制（证据级） | P5、P7（AC-10） |
| P5 | Gate 关闭机制 | P7（AC-12） |
| P6 | AC-14 几何证据消费 | P7（AC-14）、PU-ADMIT 条件 2 |
| P7 | 冻结验收报告 | **仅作 I-04 的基线引用**；最终报告引用 |
| PU-C5 | 条件 5 证据（E1 / E2 / E3） | PU-ADMIT 条件 5、FIX 的 PU witness |
| FIX | NB / PU / IE 三案例证据 | I-05 5A |
| I-04 | 负向 / 回归验收结果 | I-05 5A |
| PU-ADMIT | 六条件逐项态 + `ADMITTED` 资格布尔 | I-05 5B |
| I-05 | 最终报告 `reports/V1.1-closure.md` | 收口声明 |

**P7 → I-04 的口径已修正**：`04-i04-brief` Q7「I-04 不消费 P7」不变；P7 报告只作为 I-04 的基线前置与引用，不是被消费的证据。

### 5. 禁越界（五条）

1. I-04 不得在 P7 报告签署并冻结前开工。
2. I-05 5A 不得在 I-04 / FIX 签署前开工。
3. I-05 5B 不得在 PU-ADMIT 签署前开工。
4. PU-ADMIT 不得消费任何未签署 / 未合并 / 无 Ledger 的证据（P3 / P6 / PU-C5 同理）；缺失只能记 `NOT_RUN` / `IE`。
5. 任一单元不得以「等待期空闲」为由拉入其他单元的活。

PU-ADMIT 的 P6 前置可放弃：P6 迟到时按硬边先开，条件 2 记 `NOT_RUN`，报告必须显式写明「为排期放弃条件 2 证据」。

### 6. 失败 / STOP 传导

| 失败单元 | 直接后果 | 仍可继续 | 回滚 |
| --- | --- | --- | --- |
| P2 / P3 | P6、P7、I-04、FIX-B、PU-ADMIT 条件 2 阻断 | P4 → P5、PU-C5 | 纯 audit，丢分支 |
| P4 | P5、P7、I-04 阻断 | P2 / P6、PU-C5、PU-ADMIT（条件 2 `NOT_RUN`） | 产品相邻，revert drill + 用户裁定 |
| P5 | P7、I-04 阻断 | 其余不受影响 | 同上 |
| P6 | P7、I-04、FIX-B 阻断；PU-ADMIT 条件 2 非 PASS | P4 / P5 链、PU-C5 | 同上 |
| P7 | I-04 阻断；closure 由 `09` 判 | 无下游 | 删除验收分支，产品零回滚 |
| PU-C5 | 条件 5 `NOT_RUN`；FIX PU witness 需独立证明 | I-04、P2–P7 链 | 丢 audit 分支 |
| FIX `INFEASIBLE` / `FAIL` | I-05 5A 不能 PASS ⇒ closure `INCOMPLETE` | PU-ADMIT 不受影响 | audit-only 丢分支；进 `fixtures/**` 则 drill |
| I-04 `FAIL` | I-05 5A 阻断 | 其余已完成证据保留 | 只增测试 ⇒ 强制 drill |
| PU-ADMIT `eligible=false` | **不是失败**：可签署收尾，5B 照常消费 | I-05 5B | docs / scratch revert |
| I-05 `FAIL` | closure `FAIL` | — | 丢分支 |

两条原则：① 已签署证据在回滚未改动其基线时继续有效；回滚使 `main` 位移 ⇒ 受影响的完成单元降为 `INCOMPLETE` 并以新基线重跑，不得静默沿用；② 任何回滚先经用户裁定，`08` 不预授权自动回滚。

### 7. 估算与关键路径

口径：每单元估算 = 实施 + 自证 + 一次 fresh 复核，不含用户签署耗时；只用于排期沟通，不作验收判据，超区间需在 Ledger 备注记实际消耗。

| 单元 | 会话 | 单元 | 会话 |
| --- | --- | --- | --- |
| P2 | 2–3 | PU-C5 | 2–3 |
| P3 | 1 | PU-ADMIT | 1–2 |
| P4 | 1–2 | FIX（A+B） | 2–3 |
| P5 | 1 | I-04 | 3–4（I-00） |
| P6 | 1–2 | I-05 | 2–3（I-00：5A 1–2 + 5B 1） |
| P7 | 2–3 | | |

**关键路径**：`P2 → P3 → P6 → P7 → I-04 → I-05 5B ≈ 11–15 会话`。P4 → P5 链（1–2）短于 P2 → P3 → P6（4–6），不占关键路径；PU-ADMIT（5–8）与 FIX（6–9）均在 I-05 5B 前完成。长杆：探针链、P7 验收、I-04。

### 8. 本票新增裁定（随 Q8–Q10 一并冻结）

- **FIX witness 绑定**：绑到 `publish-gate` 证据的内部 `witness.result`（`nb-candidate` / `pu-candidate`）；公共 verdict 保持 IE、`PUBLIC_NB` / `PUBLIC_PU` 保持 `BLOCKED`。PRD 字面口径与产品现实的差异由 `11-fix-witness-binding` 收敛进 `移动-收口.md` §5.1 与 `reports/I05-brief.md`，并由 `09-closure-dod` 在 DoD 映射中显式披露。
- **FIX-B 排 Wave 4**：证据签在 P2–P6 全部合并后的 `main` 上，I-05 消费者基线一致；FIX-A 可行性门留在 Wave 1，提前暴露结构性风险。
- **新票接线**：新建 `11-fix-witness-binding`（task）；`09` 的 `Blocked by` 追加 `11`；FIX 授权前置引用 `11` 的签署结论；`08` 不复述该口径（决策只存一处）。

### 9. 未做与下游

未执行任何 Wave、未运行 probe / 测试、未修改产品代码或已签署文档、未授权任何单元。前沿 = `11-fix-witness-binding`（`09` 等 `11`）。本票未启动后续票。
