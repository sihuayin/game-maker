# FIX witness 绑定口径与收口措辞收敛

Type: task
Status: resolved
Owner: claude (wayfinder session 2026-11-18)
Blocked by: —
Map: ../map.md
Class: V1.1-CLOSURE / DOCS-CONVERGENCE

## Question

`08-sequencing` 已裁定（Q8=A，2026-11-18）：FIX 的 witness 绑到 `publish-gate` 证据的内部 `witness.result`（`nb-candidate` / `pu-candidate`）；公共 verdict 保持 IE，`PUBLIC_NB` / `PUBLIC_PU` 保持 `BLOCKED`。本票只做这件事的措辞收敛与 hash 重算，**不重开决定、不执行 FIX、不改产品代码**：

1. `docs/v7.8/移动-收口.md` §5.1：把 FIX 交付措辞从「`NO_PROVEN_BLOCKER` / `PROVEN_UNPLAYABLE`」改为「`publish-gate` 证据内 `witness.result = nb-candidate / pu-candidate`」，并写明公共 verdict 仍为 IE、gate 仍 `BLOCKED`、原因（生产 gate / admission 硬编码，见 `packages/assets/src/ops.ts:1058-1059` / `:1134-1135`）。
2. `reports/I05-brief.md`：新增一节引用该绑定口径；已冻结的逐项判据与八条 Q 裁定不改。
3. `docs/v7.8/移动-收口.md` §8：修正最终报告路径残留 `reports/final-closure.md` → `reports/V1.1-closure.md`（与 §5.2 / `I05-brief` 一致）。
4. 重算并记录包 SHA-256（包仍 UNSIGNED；不签署、不授权）。

**不做**：不改 `10-i05-temporal-fixtures` 的裁定正文；不改 PRD；不在本票讨论公共 gate 开放；不创建 fixture；不跑任何管线。

## Answer

**完成（2026-11-18，AFK task）。** 三处措辞收敛落地，包仍 `UNSIGNED`、未授权任何单元、未改产品代码 / PRD、未创建 fixture、未跑管线。

### 1. `docs/v7.8/移动-收口.md` §5.1

- NB / PU / IE 三行判据从公共 verdict（`NO_PROVEN_BLOCKER` / `PROVEN_UNPLAYABLE` / `INSUFFICIENT_EVIDENCE`）改为 `publish-gate` 证据内 `witness.result`（`nb-candidate` / `pu-candidate` / `insufficient-evidence`）。
- 新增「witness 绑定口径」段：说明公共 verdict 恒为 IE、`publicCapability="BLOCKED"`、`publicResult=null` 及原因（`packages/assets/src/ops.ts:1058-1059` / `:1134-1135`；`public-verdict.ts:75-82`）；要求 closure 报告显式披露 PRD 字面口径与本绑定口径的差异；写明唯一暴露时序证据的正式路径是 `publish-gate`（`create` / `build` 丢弃结果：`ops.ts:1099-1109`；`qa-report` 无 temporal 字段：`qa.ts:283-300`）。
- 案例路径行由「`create` / `build` / `publish-gate` / `qa-report` 任一完整跑通」收窄为固定 `build --reuse-*` → `publish-gate`。

### 2. `reports/I05-brief.md`

- 新增 §3.3「witness 绑定口径」，引用上述字段、公共 verdict 不变量与唯一证据路径；§6 判定规则与八条 Q 裁定未改。

### 3. `docs/v7.8/移动-收口.md` §8

- `reports/final-closure.md` → `reports/V1.1-closure.md`；`reports/final-closure-signature.md` → `reports/V1.1-closure-signature.md`。全文已无 `final-closure` 残留。

### 4. 包 hash

- 收敛后 SHA-256：`e1dc14d01a3847d36d06c4a32293194ae78106c1bb2c5b5121fd3d40301ecc00`（`sha256sum docs/v7.8/移动-收口.md`）。包仍 UNSIGNED；§14 签署栏未填。

### 5. 已知历史残留

- `02-authorization-package` 的 Q5 行仍写 `final-closure-signature.md`；该行是当时裁定的历史记录，已被 `05-i05-brief` Q4 取代，本票按「不改写已关票记录」保持原样。

**未做**：未执行 FIX、未跑 probe / 测试、未改 `10-i05-temporal-fixtures` 裁定、未签任何授权。**下游**：`09-closure-dod` 解锁。
