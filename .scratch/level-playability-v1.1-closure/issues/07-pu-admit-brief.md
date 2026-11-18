# PU-ADMIT 六条件准入验收 brief

Type: grilling
Status: resolved
Owner: claude (wayfinder session 2026-11-18)
Blocked by: 02, 06, 10
Map: ../map.md
Class: V1.1-CLOSURE / UNIT-BRIEF

## Question

冻结 PU-ADMIT 的六条件准入验收。它只判定「是否具备 `ADMITTED` 资格」，不改变 PU gate（Q9=A）。

必须裁定：

1. **六条件来源**：条件 1/3/4/6 消费 U5 的 PASS 证据，但 `01-coverage-inventory` 证明它们只在**合成 `PU_WORLD`** 上 PASS；条件 2 消费 P6 的几何证据（hazard/player/graph checked）；条件 5 消费 PU-C5 的签署证据。必须裁定「合成世界 PASS」是否足以作为 `ADMITTED` 资格的正向证据，还是必须真实关卡证据（若后者，与 `10-i05-temporal-fixtures` 联动）。逐项定义「什么算 PASS」与证据 hash。
2. **不重复实现**：PU-ADMIT 不重新跑 P2/P3/P6/PU-C5，只做消费、逐项核对与准入判定；若证据缺 hash / 未签署 / 环境不匹配 ⇒ `NOT_RUN` / `IE`，不得伪造 PASS。
3. **准入判定**：六项全部 PASS ⇒ `ADMITTED-eligibility = true`；任一项非 PASS ⇒ false；不使用总分/加权/通过率。输出形态（报告 / JSON / 只读汇总）与落点。
4. **gate 边界**：`PUBLIC_PU` 仍 `BLOCKED`；不修改 `public-verdict` / `capability-gate`；资格 ≠ ADMITTED ≠ OPEN。
5. **与 P7 / AC-11 的关系**：P7 的 AC-11 是非 required `NOT_RUN`；PU-ADMIT 是否更新 AC-11、如何记录、是否影响 P7 的 19 条 required 结论。
6. **证据 / 复核**：报告路径、fresh 独立复核、用户签署、STOP 条件。

产出：PU-ADMIT unit brief；不实施、不判定任何真实关卡。

## Context（`10-i05-temporal-fixtures` 裁定，2026-11-18）

- PU-ADMIT **不要求**真实 PU 案例；FIX 的真实 PU witness 只能作支持证据，不得计入 `ADMITTED` 资格。
- 条件 5 只消费 PU-C5 的签署证据；六条件资格只在本单元判定；两者与 FIX 证据互不重复计入。
- PU-ADMIT 不被 FIX 阻塞：前置仍为收口包签署 + PU-C5 合并 / 签署 / Ledger + P6 签署证据（若采用）。
- `PUBLIC_PU` 仍 `BLOCKED`；资格 ≠ `ADMITTED` ≠ `OPEN`。

## Answer

**Q1–Q8 = 用户裁定（2026-11-18）。** PU-ADMIT 冻结为**纯消费 / 纯判定**：只消费已签署证据，产出六条件逐项四态与全局 `ADMITTED` 资格布尔；不生产证据、不跑 probe、不自建 fixture、不改产品代码 / 测试 / gate。

交付：

- [`reports/PU-ADMIT-brief.md`](../reports/PU-ADMIT-brief.md) @ `sha256:f48e6202b1c87dade18bc742c9e6c916f88c8443a9211a8a59d16318b18757ae`（冻结；PU-ADMIT 仍 `NOT_AUTHORIZED`）。
- `docs/v7.8/移动-收口.md` §7 由占位改为 PU-ADMIT 授权面；包 hash `45e35c6109faa2d7ae8073e4c510321324b31dbfa5714ef1d5b17a3935a32c51`（5 单元 / 5 行 Ledger 不变）。

| # | 冻结 |
| --- | --- |
| Q1 | 冻结三类准入证据清单（合成正例 / false-PU 负例 / 真实 IE 负例，逐条 file:line + testName + commit + 断言 hash）；条件 1/3/4/6 可在 `scope: "synthetic"` 下记 PASS；**三类齐全不得自动覆盖 I-03 §9.4 的完整 fixture 要求**——夹具门独立判定，且新建 fixture 出图 |
| Q2 | 引用签署 hash + 只读复跑现有 vitest（不新增 / 修改测试、不跑 probe）；记录环境、命令、退出码、逐用例结果与输出 hash；不一致 ⇒ 受影响条件 `IE` |
| Q3 | P6 是条件 2 的唯一来源；P3/P6 缺失 ⇒ `NOT_RUN`；证据不足（hash / review / partial）⇒ `IE`；明确反证（组件非 checked、产品路径矛盾）⇒ `BLOCKED`；P6 非硬边，排期归 `08` |
| Q4 | 条件 5 只消费 PU-C5 签署证据；未签署 / 未合并 ⇒ `NOT_RUN`；FIX 的真实 PU witness 只作支持证据，绝不冲抵 |
| Q5 | 报告 `reports/PU-ADMIT-acceptance.md` + `evidence/pu-admit/verdict.json` / `condition-matrix.json` / `admission-evidence-list.json`；全局资格判定，不做逐关；措辞固定「资格 ≠ `ADMITTED` ≠ `OPEN`」 |
| Q6 | P7 / AC-11 不变：P7 报告不可变、AC-11 仍 `NOT_RUN`；PU-ADMIT 不追加 addendum、不回写、不重开 P7；closure 总报告另起一节引用 |
| Q7 | fresh 独立复核 + 用户签署 + docs/scratch-only 回滚；STOP 继承包内 12 + 4 + 6 条，另加 6 条（FIX witness 计入资格 / 合成冒充真实 / 缺 hash 判 PASS / 回写 AC-11 / 改 gate 或产品 / 现场补写测试） |
| Q8 | `eligible=false` 可签署收尾：逐项缺口登记、不自动阻塞其他单元；closure 整体状态归 `09-closure-dod` 按 DoD 判定 |

**资格公式（三闸合取）**：

```
ADMITTED-eligibility = 六条件逐项 PASS
                     ∧ §9.4 固定 PU 准入夹具门 PASS
                     ∧ 本单元 fresh 独立复核 PASS
```

- 当前无已签署的完整 admission fixture 集，且新建 fixture 出图 ⇒ 夹具门预期 `UNMET`、`eligible` 预期 `false`；报告必须如实记录，不得为凑资格放宽判据。
- 六条件逐项状态只用 `PASS / BLOCKED / INSUFFICIENT_EVIDENCE / NOT_RUN`；不用总分 / 加权 / 通过率。
- `PUBLIC_PU` 仍 `BLOCKED`；不修改 `publicCapability` / `publicResult` / `movementModelClosure`；资格 ≠ `ADMITTED` ≠ `OPEN`。

**未做**：未执行 PU-ADMIT、未创建任何 fixture、未运行 probe、未改产品代码、未签署任何单元。

**下游**：`08-sequencing` 与 `09-closure-dod` 解锁；本票未启动后续票。
