# 06. plan-only 重试验证 recipe 入参（付费 · 需授权）

Type: task
Status: resolved
Owner: main session · 2026-10-22
Blocked by: 05
Map: ../map.md

## Question

票 05 探针通过后，用失败现场的输入跑 **1 次 plan-only 重试**（只发 `plan-assets` 这一步），验证
`emit_asset_recipe` 能产出**非空、过契约、可作 recipe 合法输入**的入参。

命令同 `.scratch/p0-final-v1/issues/05-fix-text-upstream.md` 的 plan-only 重试：
```bash
node packages/cli/dist/cli.mjs plan \
  --design  .scratch/p0-final-v1/runs/2026-10-22-real/.failed-2026-10-22T08-18-36-700Z/game-design.json \
  --visual-world .scratch/p0-final-v1/runs/2026-10-22-real/.failed-2026-10-22T08-18-36-700Z/visual-world.json \
  --out .scratch/text-upstream-v1/runs/<date>-plan-only --json
```

**通过**（Q5，缺一不可）：返回非空 + 过既有契约验证 + 可作后续 recipe 阶段合法输入。
HTTP 200 / 可解析 JSON / 模型自称成功**都不算**通过。
**失败**：若 `empty-input` 仍出现，则根因大概率是大 schema（转 `Not yet specified` 的仓库侧修法票）；
若 `schema` 失败，记录入参到底缺了什么。

**付费**：1 次 plan-assets（≤3 往返），≈ $0.011；计入 $0.25 硬上限。**必须先逐字授权再发。**

## Answer

**已收口（task · 付费 plan-only）**：一发通过（attempts=1，零重试），根因实锤修复。

- 命令：`game-maker plan --design <failed-field>/game-design.json --visual-world <…>/visual-world.json
  --out .scratch/text-upstream-v1/runs/2026-10-22-plan-only --json`。
- 结果：exit 0，`model=deepseek-v4-pro`，`attempts=1`；产出 recipe
  `wasteland-scavenger-recipe/recipes/v1.json`（6 资源：animation×2 · sprite×3 · background×1），
  plan 落盘 `v1.plan.json`。
- 通过判据（Q5，缺一不可）：非空 ✓ + 过契约 ✓（exit 0）+ 可作 recipe 阶段合法输入 ✓。
- 实际花费 **$0.0042912**（8420 in / 1471 out，cc-switch 日志）；累计 $0.0044262 / $0.25。
- 根因定论：`empty-input` 与 `schema` 两个签名都源自 flash 降级（`ANTHROPIC_MODEL=deepseek-flash` 兜底）；
  切到 `deepseek-v4-pro` 后一次通过、零重试。**Destination 达成。**
