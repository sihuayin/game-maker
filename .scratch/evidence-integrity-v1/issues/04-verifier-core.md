# 正式校验器核心：清单、哈希、路径、身份、一致性、六项重导出

Type: task
Status: open
Blocked by: 03

## Question

在 `packages/pipeline` 实现正式证据完整性校验核心（纯逻辑 + 只读 I/O），按裁定落死：

1. **清单解析**：Q6 形状的 zod schema；不匹配 ⇒ 抛 invalid（CLI 层映射 `EXIT.invalid(4)`）。
2. **文件校验**：逐条 `verified` / `missing` / `unreadable` / `hash-mismatch` / `path-invalid` / `reference-invalid`（语义分类，不新增对外合同枚举）。
3. **路径安全**（Q14）：root 与目标双端 `realpath`，规范化组件包含性判断；越界 / 悬空链接拒绝，root 内合法链接通过。
4. **身份校验**（Q12）：清单 `subject` 为唯一期望；qa-report、两份 playtest result、FA-04 三份、FA-09 supplement 必需字段逐项比较；缺 ⇒ `blocked`，不符 ⇒ `fail`。
5. **一致性**（Q15）：清单期望值 / 证据自述哈希 / 实际文件哈希三方比对；报告间引用可解析（qa-report ↔ evidence ↔ playtest ↔ 审核材料）。
6. **六项重导出**（Q13）：`asset-pack`（`verifyPack`）、`config`、`qa`（`qaVerdict`）、`site`、`playable-smoke`（`playtestSummaryOf` + `mapPlaytest`）、
   `visual-review`（记录完整性 / subject / 与 `delivery.visualReview` 一致，不重判人工结论）；输出 `declared[]` 与 `recomputed[]`。
7. **状态映射**（Q7）：确定性矛盾 → `fail`；必需前置缺失/不可读/身份缺失 → `blocked`；整体用 `deriveDeliveryVerdict`，
   不复制优先级；单项失败不提前退出，尽可能展示全部独立诊断。
8. **报告 schema**（Q8）：pipeline 内本地 zod `delivery-verification/v1`；JSON + Markdown；含输入清单 SHA-256、`subject`、
   `declared`/`recomputed`、逐文件结果、诊断、最终状态、信任边界、已知限制与本次检查范围。
9. **只读**：不对交付根写入；不自动修复；不读清单外的任何证据。

单元测试覆盖每个状态分类、身份缺/错、三方矛盾、六项重导出与 `deriveDeliveryVerdict` 一致。
回归：`pnpm test` / `pnpm typecheck` 全绿；不扩 contracts、不改 `delivery` / `qa-report` schema。
