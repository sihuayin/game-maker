# FIX witness 绑定口径与收口措辞收敛

Type: task
Status: open
Owner: —
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
