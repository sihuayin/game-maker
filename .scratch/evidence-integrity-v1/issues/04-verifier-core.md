# 正式校验器核心：清单、哈希、路径、身份、一致性、六项重导出

Type: task
Status: resolved
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

## Answer

**已收口（2026-10-29）。** 正式校验器核心落在 `packages/pipeline/src/evidence-integrity.ts`（并从 `src/index.ts` 导出），
只读、无构建/浏览器/付费调用。

### 实现

- **清单**：`delivery-evidence-manifest/v1` 本地 zod schema；`roots` 封闭（files/records 只能引用已登记标识符）、
  文件与记录去重、`records ⊆ files[]` 写前拒绝。
- **路径安全（Q14）**：root 与目标双端 `realpath`；包含性按规范化路径组件判断；拒绝绝对路径、`..` 越界、
  root 外符号链接、悬空链接；root 内合法链接通过；root 不可解析 ⇒ 文件 `missing`（blocked）。
- **文件**：`verified / missing / unreadable / hash-mismatch / path-invalid / optional-missing`；
  `required:false` 缺失不阻断，存在仍校验。
- **身份（Q12）**：11 条记录逐字段比较；`packChecksum` ↔ `manifestChecksum`、09 `siteHashes` ↔ 六字段、
  identity.json 的 `manifestFileSha256/siteConfigSha256` ↔ subject；缺字段 ⇒ blocked，不符 ⇒ fail。
- **一致性（EI-04 / Q15）**：记录可读可解析、三方哈希（清单/自述/实际）、引用解析（qa-report evidence / config /
  evidence.json / materials / 审核材料）、站点前后哈希（capture / playtest / supplement）、
  截图数量与去重（基线 **9 张 / 8 个不同字节**）、playtest 摘要与 attempt 投影、声明 vs 重算 verdict。
- **六项重导出（Q13）**：`asset-pack`（`verifyPack` + manifestChecksum）、`config`、`qa`（`qaVerdict`）、
  `site`（四文件 + site.json 引用 + shell）、`playable-smoke`（`playtestSummaryOf` + `mapPlaytest`）、
  `visual-review`（记录完整性 / 与 `delivery.visualReview` 一致；不重判人工结论）。
- **状态映射（Q7）**：确定性矛盾 → fail；必需前置缺失 → blocked；整体走 `deriveDeliveryVerdict`。
  重算本身 blocked/incomplete 时不把「声明 pass」升级成 fail（否则 Q7 的缺失→blocked 不可达）。
- **报告（Q8）**：`delivery-verification/v1` 本地 zod；JSON + Markdown；含输入清单 sha、subject、declared/recomputed、
  逐文件/身份/一致性结果、诊断、最终状态、信任边界、限制。**不写文件**（落盘归票 05）。

### 测试与回归

- 新增 `packages/pipeline/tests/evidence-integrity.test.ts`：9 个用例覆盖
  完整证据 pass、内容篡改（hash-mismatch/fail）、必需缺失（missing/blocked）、身份不符（fail）、
  身份字段缺失（blocked，不静默跳过）、三方哈希矛盾（fail）、声明/重算 verdict 不一致（fail）、
  路径逃逸（path-invalid/fail）、重复执行确定性。
- `pnpm test`：**148 files / 2216 tests passed**。
- `pnpm typecheck`：全部包 Done。
- `pnpm check:deps`：✅ 10 个包（新增 `zod`，catalog 3.25.76，contracts 已在用；无新第三方包）。
- 真实基线（E3）：`verifyDeliveryEvidence(.scratch/evidence-integrity-v1/manifest/expected-hashes.json)`
  ⇒ **status=pass / exitCode=0**；195 文件（151 required / 44 optional）；11 条身份全 verified；
  六项 declared↔recomputed 全 match；`visual.shots.count = 9 张 / 8 个不同字节`；diagnostics=0；
  清单 sha256 `c168ba6c…b797`。

### 附带修正

- 清单原缺交付侧 `out/<packId>/site/v1/` 四文件（详见票 03 的 Revision）；已补入并重新冻结
  （sha `6efd248c…` → `c168ba6c…`）。这是完成度修正，不改 D1–D12 规则。

### 已知限制

- 报告落盘 / CLI / `pnpm test:evidence` 归票 05；本票不写任何文件。
- 负向测试的完整套件（符号链接逃逸、不可读、审核 subject 错配等）归票 06；本票已覆盖 `..` 越界。
- `visual-review` 只校验记录完整性/一致性，不重判人工结论；单 Demo、无 MCP 镜像、无五态 E2E。
- 工作树未提交（清单修订 + 代码 + 测试）。
