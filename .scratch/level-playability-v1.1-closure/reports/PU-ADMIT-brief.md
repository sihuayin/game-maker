# PU-ADMIT unit brief · PU 六条件准入验收

| 项 | 值 |
| --- | --- |
| 票 | [`07-pu-admit-brief`](../issues/07-pu-admit-brief.md)（grilling，resolved 2026-11-18） |
| 授权包 | `docs/v7.8/移动-收口.md` §7（UNSIGNED 草案） |
| 证据底座 | [`01-coverage-inventory`](../evidence/01-coverage-inventory.md) §3（`sha256:9cba8e38…`） |
| 上游冻结 | [`10-i05-temporal-fixtures`](../issues/10-i05-temporal-fixtures.md)（SIGNED 2026-11-18）· [`PU-C5 brief`](PU-C5-brief.md) · Phase-2 [`P6 brief`](../../level-playability-v1.1-i03-phase2/issues/06-p6-ac14-consumption.md) |
| 状态 | **brief 冻结；PU-ADMIT `NOT_AUTHORIZED`**——实施前仍需独立增量授权记录 + 用户签署 |
| 基线 | 单元分支切出时的 `main` SHA（不在本 brief 预填） |

## 0. 单元性质

PU-ADMIT = **纯消费 / 纯判定**：

- 消费已签署证据（条件 1/3/4/6 的准入证据清单、条件 2 的 P6 几何证据、条件 5 的 PU-C5 证据），逐项核对并给出六条件四态；
- **不生产证据**：不跑 probe、不自建 fixture、不补写测试或脚本、不重跑 P2/P3/P6/PU-C5；
- **不改**产品源码 / 产品测试 / `fixtures/**` / 已签署文档 / `temporal-gate.ts` / `movementModelClosure` / `PUBLIC_PU` gate / `publicCapability`；
- 唯一的「执行」是**只读复跑现有 vitest 文件**，用于给证据 hash 一个可复算锚点（§7）。

资格语义固定：**资格 ≠ `ADMITTED` ≠ `OPEN`**。本单元结论不改变 gate、不设置 `publicCapability`、不产生公共 PU。

## 1. 前置与硬边

| 前置 | 性质 | 缺失时 |
| --- | --- | --- |
| 收口包签署 | 硬边（包 §2） | 不启动 |
| PU-C5 合并 / 签署 / Ledger | 硬边（包 §2） | 条件 5 `NOT_RUN`，单元不可开跑 |
| `10` 裁定（FIX 口径 / 证据归属） | 硬边（包 §2） | 不启动 |
| P3 已签署 + P6 合并 / 签署 / Ledger | **非硬边**（排期归 `08`） | 条件 2 `NOT_RUN`；其余条件照常判定 |
| P7 验收 | 非前置 | P7 / AC-11 不受影响（§9） |
| FIX | 非前置 | FIX PU witness 只作支持证据（§3.3） |

- 不等待 P6：P6 未完成时 PU-ADMIT 仍可在自己的授权下开跑并如实记 `NOT_RUN`；是否等 P6 属 `08` 的 Wave 排期。
- 不因 P6 缺失而阻塞其他单元；也不把 P6 的缺失改写成其他条件的 PASS。

## 2. 判定总则

### 2.1 四态

条件状态只取 I-03 §9.2 的四种：`PASS / BLOCKED / INSUFFICIENT_EVIDENCE / NOT_RUN`。语义：

| 状态 | 含义 |
| --- | --- |
| `PASS` | 签署来源可解析、hash 匹配、只读复跑一致、且该项判据本身成立 |
| `NOT_RUN` | 前置证据 / 单元尚未发生（未签署、未合并、未执行） |
| `INSUFFICIENT_EVIDENCE` | 证据存在但不足以支撑判据（缺 hash、类别不全、复跑不一致、scope 仅为 partial） |
| `BLOCKED` | 存在明确反证（签署证据 FAIL、组件 `unknown/partial`、产品路径与声称的 checked 矛盾） |

**任一条件 `PASS` 必须同时满足**：

1. 来源是已签署 / 已合并产物，路径与 `sha256` 可解析；
2. 该来源在只读复跑中一致（§7）；
3. 该条件的判据在来源里被**直接断言**，不得由相邻条件推断。

缺 1 ⇒ `NOT_RUN`；有 1 但 2 或 3 不足 ⇒ `INSUFFICIENT_EVIDENCE`；有明确反证 ⇒ `BLOCKED`。

### 2.2 资格公式（三个门，全部 PASS 才为真）

```
ADMITTED-eligibility =
    六条件逐项 PASS
  ∧ §9.4 固定 PU 准入夹具门 PASS
  ∧ 本单元 fresh 独立复核 PASS
```

- 不使用总分 / 加权 / 通过率 / 多数决；不做逐关判定（I-03 §9.1 的阶段 2 是全局阶段；逐关属阶段 3 `OPEN`）。
- **三类准入证据清单齐全 ≠ §9.4 固定准入夹具门达标**（用户裁定 Q1）。清单只是既有证据的分类盘点；I-03 §9.4 的完整 admission fixture 要求必须由**单独签署、先冻结后使用、带 hash 与独立复核**的夹具集满足，PU-ADMIT 不得自行宣布其达标。
- 当前不存在该已签署夹具集，且新建 fixture 已判出图。因此按本 brief 执行时，夹具门预期为 `UNMET`，**`eligible` 预期为 `false`**；报告必须显式记录该事实与缺口，不得为了拿到 true 而放宽判据。

## 3. 条件 1 / 3 / 4 / 6 与准入证据清单

### 3.1 清单形态

执行时冻结 `evidence/pu-admit/admission-evidence-list.json`，每条记录：

```json
{
  "category": "synthetic-positive | false-pu-negative | real-ie-negative",
  "condition": "1 | 3 | 4 | 6 | all",
  "file": "packages/contracts/tests/....test.ts",
  "testName": "....",
  "line": 123,
  "expected": "....",
  "commit": "<40hex>",
  "assertionSha256": "sha256:<64hex>",
  "scope": "synthetic | real-level"
}
```

- `commit` 固定为清单冻结时的 `main` SHA；执行时若 `main` 已前进，须记录「测试文件未变」或重新冻结。
- `assertionSha256` 对「测试名 + 关键断言文本 + 期望值」做规范化后取 hash；保证同一断言可复算。
- 清单只增不改；冻结后不得事后调整样本（I-03 §9.4「禁止事后调整样本」）。

### 3.2 三类清单（种子，执行时逐条核对并补全）

| 类别 | 必须覆盖 | 现有候选（`file:line`） |
| --- | --- | --- |
| 合成 PU 正例 | 永久门区完整 + 图割完整 + hop 双档完整一致 + lag | `playability-temporal.test.ts:209`（PU_WORLD ⇒ `pu-candidate`，六项 PASS）；`:665`（A–J B 同判据）；`playability-temporal-evasion.test.ts:339`（两档不可达且覆盖成立 ⇒ COMPLETE） |
| False-PU 负例 | 上方绕行 / 下方坑道 / 部分路径 / 局部封锁 / 采样漏检 / `midAirHits` 否决 | `playability-temporal.test.ts:258`（图割不成立 ⇒ INCOMPLETE）、`:276`（无恒覆盖核心 ⇒ IE）、`:686`（证据不足 ⇒ IE）、`:761`（垂直规避 ⇒ INCOMPLETE）；`playability-temporal-evasion.test.ts:217`（可达目标）、`:224`（不可达）、`:310`（覆盖不可证明）、`:321`（cap 绑定）、`:328`（反例 9）、`:445`（`midAirHits` 只作否决）、`:476`（反例 12） |
| 真实 IE 负例 | 几何不足 / 模型外未闭合 / 双档不一致 / 预算耗尽 时保持 IE | 19 个 moving-hazard 语料的 U5 审计结果（`U5-final-audit.md` 的 IE 早退矩阵）；FIX 的 IE 负例（签署后） |

- 每个 I-03 §9.4 要求的负例必须在清单里有对应行；**缺行 ⇒ 受影响条件 `INSUFFICIENT_EVIDENCE`**，不得用「同类测试存在」代替。
- 真实 IE 负例只证明「不误升」，不证明条件 1/3/4/6 的正面判据。

### 3.3 清单与资格的关系

- 清单齐全时，条件 1/3/4/6 可在 **`scope: "synthetic"`** 下记 `PASS`；这一状态表达「判据在合成世界成立」，不等于准入夹具门达标。
- **Q1 裁定**：不得以清单三类齐全自动覆盖 §9.4 的完整 fixture 要求；夹具门独立判定（§2.2）。
- FIX 的真实 PU witness（若已签署）只能作为 `scope: "real-level"` 的**支持证据**列在报告附注，不得改变六条件状态、不得计入资格、不得冲抵任一缺口（`10` 裁定 Q6）。

## 4. 条件 2 · 几何证据

- **唯一来源**：P6 的 `GeometryEvidenceInput` + P3 已签署复核 + P6 合并 / 签署 / Ledger。PU-ADMIT 不读 probe 原始帧、不自行运行 P2 / P3、不从源码推断 `checked`。
- 消费内容：`components.hazard/player/graph`、`review.a/b/c`、`hashes.probeManifestHash/evidenceHash/reviewReportHash`；并核对签署记录与 Ledger 行。
- 状态映射：

| 情形 | 状态 |
| --- | --- |
| P3 / P6 未签署、未合并、Ledger 缺行 | `NOT_RUN` |
| 三者任一非 `checked`（`partial` / `unknown` / `not-applicable` 按 I-03 语义） | `BLOCKED` |
| hash 缺失 / hash 不匹配 / review 非 PASS / 复跑不一致 | `INSUFFICIENT_EVIDENCE` |
| 三者全 `checked` + review PASS + hash 匹配 + 复跑一致 | `PASS` |

- 产品里硬编码的 `blockedReason`（`temporal.ts:500-503`）若与声称的 `checked` 冲突，视为明确反证 ⇒ `BLOCKED`，并 STOP + HITL。
- 不得用合成几何 / 测试桩冒充 P3 签署证据。

## 5. 条件 5 · 模型外规避

- **唯一来源**：PU-C5 的签署证据：`PU-C5-acceptance.md`、合同路径复核报告 `pu-air-control-closure-review.md`、`SHA256SUMS`、用户签署、Ledger 行。
- 消费内容：C1–C17 逐项四态、A/B 证明 hash、环境记录、复核结论；并核对「required 全 PASS + A/B + 复核 + 签署」。
- 状态映射：

| 情形 | 状态 |
| --- | --- |
| PU-C5 未授权 / 未合并 / 未签署 / Ledger 缺行 | `NOT_RUN` |
| 签署证据整体为 `FAIL` 或 `INSUFFICIENT_EVIDENCE` | `BLOCKED` |
| 任一 required 非 PASS / A/B 缺失 / 复核非 PASS / hash 不匹配 | `INSUFFICIENT_EVIDENCE` |
| 全部 required PASS + A/B + 复核 PASS + 用户签署 + hash 匹配 | `PASS` |

- 不重跑 probe、不重算 A/B、不读取未签署中间产物。
- `midAirHits=0`、conditional 图割、NB 结果一律不得作为条件 5 的正面证据（合同 C16 / C17 与 N12）。
- FIX 的 PU witness 不得计入条件 5；条件 5 只认 PU-C5。

## 6. 条件汇总表

| # | 条件 | 来源 | PASS 判据 | 默认状态（当前仓库） | 缺口归属 |
| --- | --- | --- | --- | --- | --- |
| 1 | 永久门区证明 | 准入证据清单（合成正例） | 全周期闭式 + 判侧 + forbidden 注入完整，且清单行 hash / 复跑一致 | `PASS (synthetic)` 可能，但夹具门 `UNMET` | 完整准入夹具（出图，另票） |
| 2 | 几何可信 | P6 / P3 | `hazard/player/graph` 全 `checked` + 签署 + hash | `NOT_RUN` | Phase-2 P2/P3/P6 |
| 3 | 图割证明 | 准入证据清单 | 模型内图割完整 + hop 完整；不得写成 Runtime 不可达 | `PASS (synthetic)` 可能 | 完整准入夹具 |
| 4 | Hop 采样 | 准入证据清单 | 双档完整、`F1 ⊆ F2`、无预算问题 | `PASS (synthetic)` 可能 | 完整准入夹具 |
| 5 | 模型外规避 | PU-C5 | C1–C15 全 PASS + A/B + 复核 + 签署 | `NOT_RUN` | PU-C5 |
| 6 | Lag 证明 | 准入证据清单 | 构造性 invariant + 双档证据一致 | `PASS (synthetic)` 可能 | 完整准入夹具 |
| — | §9.4 固定夹具门 | 单独签署的 complete admission fixture set | 先冻结 + hash + 独立复核 | `UNMET` | 出图；新建 fixture 需独立授权 |
| — | 独立复核 | 本单元 fresh reviewer | 逐项复核 + 抽查 + 重跑 | `NOT_RUN` | PU-ADMIT |

## 7. 只读复算

- 命令（示例，执行时记录实际命令与版本）：

```bash
pnpm vitest run \
  packages/contracts/tests/playability-temporal.test.ts \
  packages/contracts/tests/playability-temporal-gate.test.ts \
  packages/contracts/tests/playability-temporal-evasion.test.ts \
  packages/contracts/tests/playability-temporal-input.test.ts \
  packages/contracts/tests/playability-temporal-evidence.test.ts
```

- 记录：Node / pnpm / vitest 版本、`main` SHA、命令、退出码、逐用例结果、原始输出 hash。
- 只读复跑**不得**新增或修改测试、不得写 `packages/**` / `fixtures/**`、不得跑 probe。
- 复跑不一致的行 ⇒ 受影响条件 `INSUFFICIENT_EVIDENCE`，并 STOP + HITL 调查。
- 测试在当前环境不可运行（缺依赖 / 平台限制）⇒ 该行 `NOT_RUN`，不得记为 PASS。

## 8. 判定输出与落点

| 产物 | 路径 |
| --- | --- |
| 人类可读报告 | `.scratch/level-playability-v1.1-closure/reports/PU-ADMIT-acceptance.md` |
| 机器判定 | `.scratch/level-playability-v1.1-closure/evidence/pu-admit/verdict.json` |
| 条件矩阵（派生视图） | `.scratch/level-playability-v1.1-closure/evidence/pu-admit/condition-matrix.json` |
| 准入证据清单 | `.scratch/level-playability-v1.1-closure/evidence/pu-admit/admission-evidence-list.json` |
| 命令 / 输出 / hash | `evidence/pu-admit/{commands.log, raw/, SHA256SUMS}` |
| 复核报告 | `.scratch/level-playability-v1.1-closure/reports/PU-ADMIT-review.md` |
| 用户签署 | `.scratch/level-playability-v1.1-closure/reports/PU-ADMIT-signature.md` |
| 增量授权 | `.scratch/level-playability-v1.1-closure/reports/PU-ADMIT-incremental-authorization.md` |

`verdict.json` 固定形状（字段只增不改）：

```json
{
  "unit": "PU-ADMIT",
  "baseline": "<40hex>",
  "conditions": {
    "1": { "status": "PASS", "scope": "synthetic", "evidence": [{ "path": "...", "sha256": "..." }] },
    "2": { "status": "NOT_RUN", "scope": null, "evidence": [] },
    "3": { "status": "PASS", "scope": "synthetic", "evidence": [] },
    "4": { "status": "PASS", "scope": "synthetic", "evidence": [] },
    "5": { "status": "NOT_RUN", "scope": null, "evidence": [] },
    "6": { "status": "PASS", "scope": "synthetic", "evidence": [] }
  },
  "admissionFixtureGate": { "status": "UNMET", "reason": "no signed complete admission fixture set" },
  "review": { "status": "NOT_RUN", "report": "reports/PU-ADMIT-review.md", "sha256": null },
  "eligible": false,
  "wording": "eligibility != ADMITTED != OPEN"
}
```

- `eligible` 严格按 §2.2 三闸合取计算；false 时必须在报告中给出逐项缺口，而不是只给布尔。
- 报告首页固定列出：六条件逐项状态、夹具门、复核状态、`eligible`、措辞边界、残余风险。
- 不使用总分 / 通过率；任何「六项里 N 项 PASS」的表述都不得替代逐项判定。

## 9. 与 P7 / AC-11 的关系

- P7 报告 `phase2-acceptance.md` 保持不可变；AC-11 仍为 `NOT_RUN`（I-03 已冻结的非 required 项）。
- PU-ADMIT **不**回写 AC-11、不追加 addendum、不重开 P7、不把 P7 的 19 条 required 结论卷入本单元。
- closure 总报告（`09-closure-dod` 定义，落点 `reports/V1.1-closure.md`）另起一节引用 PU-ADMIT 的签署 hash；`ADMITTED` 资格属 closure 范围，Phase-2 验收属 P7 范围，两条链各自留痕。

## 10. 复核、签署、STOP、回滚

- **复核**：fresh reviewer，未参与 PU-ADMIT 的判定撰写与证据清单冻结；独立重跑 §7 命令、重算 hash、抽查 ≥2 条自选断言、核对三闸合取；报告写独立性声明、环境、输入 hash、限制与签署行。
- **签署**：用户签署 `PU-ADMIT-signature.md`；签署对象为 `verdict.json` 与 `PU-ADMIT-acceptance.md` 的 hash。
- **STOP（继承包内 12 + 4 + 6 条，另加）**：
  1. 用 FIX 的真实 PU witness 计入六条件或资格；
  2. 把合成 `PU_WORLD` / 静态层结论写成真实关卡证据；
  3. 缺 hash / 未签署 / 复跑不一致仍判 `PASS`；
  4. 回写 AC-11、修改 P7 报告或重开 P7；
  5. 修改 gate / `publicCapability` / `movementModelClosure` / 产品源码 / 产品测试 / `fixtures/**`；
  6. 现场补写测试 / 脚本、运行 probe 或新建 fixture 以凑判据。
- **回滚**：docs / scratch-only revert；产品零改动、无 revert drill。回滚目标 = 单元切出时 `main` SHA。

## 11. `eligible=false` 的收尾

- 本单元**照常 resolve**：`eligible=false` + 逐项缺口登记（哪项 `NOT_RUN` / `IE` / `BLOCKED`、缺什么、归哪个单元）。
- 不自动阻塞 closure 的其余单元；不重开本票直到 true；不为凑资格放宽判据。
- closure 整体状态（`PASS / FAIL / INCOMPLETE`）由 `09-closure-dod` 按 PRD DoD 判定；本单元只提供事实与缺口。
- `eligible=true` 只在三闸全部 PASS 时出现；若出现，仍不改 gate、不进入 `ADMITTED`、不开放 `OPEN`。

## 12. Handoff

- **→ `08-sequencing`**：PU-ADMIT 的真实排期（P6 + PU-C5 之后、可与 P7 并行）由 `08` 冻结；本 brief 只固定非硬边语义。
- **→ `09-closure-dod`**：资格结论是 closure DoD 的一行输入；false 时必须进入残余风险清单。
- **→ I-05 5B**：按签署 hash 引用 PU-ADMIT，不重跑、不改写。

本 brief 不授权 PU-ADMIT，也不授权任何产品代码 / fixture 改动。
