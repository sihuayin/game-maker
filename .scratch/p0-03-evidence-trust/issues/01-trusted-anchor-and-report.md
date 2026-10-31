# 可信锚点与正式报告：Manifest 摘要 + `verify-delivery --expected-manifest-sha` + `trust.anchor`

Type: task
Status: resolved
Blocked by: —

## Question

落地 P0-03 的可信锚点与正式报告，使“清单来自可信基线”成为正式验收的一部分，而不是 CI 脚本的旁路检查。

必须完成：

1. **独立摘要文件**：在 `.scratch/evidence-integrity-v1/manifest/` 新增 `expected-hashes.sha256`：
   - 固定格式 `sha256:<64 hex>\n`；
   - 只对 Manifest **原始文件字节**计算 SHA-256，不对解析后的 JSON 重新序列化；
   - 初始值 `sha256:ba7a485b195fe3d362fd4cb244d397c844d4e07fb0d2ccc89f914043bf4d36fd`；
   - 入库，后续由 ruleset/CODEOWNERS 覆盖。
2. **扩展 `verify-delivery`**：
   - `--expected-manifest-sha <sha256:...>` 可选：校验 Manifest 原始字节 SHA-256；
   - `--base-manifest <path>` 可选：与当前 Manifest 逐字节比较，记录 `byteEqual`；
   - 报告新增 `trust.anchor` 块：`mode`、`source`、`expectedSha256`、`actualSha256`、`baseManifest`（path/sha256/byteEqual）、`result`；
   - 锚点不匹配 ⇒ 正式验收 `fail`、退出码 1，不能只 warning；参数缺失/格式错 ⇒ usage 2；
   - 不传新参数时保持旧调用与旧报告消费者兼容（`trust.anchor` 可缺省或 `unchecked`）。
3. **只读**：不写回 Manifest、不更新摘要、不生成证据、不修改原始交付。
4. **测试**：摘要格式、原始字节口径、匹配/不匹配、base manifest 字节不等、向后兼容；真实基线 E3：对 223 文件清单跑一次，`trust.anchor.result=matched`，`report.json`/`report.md` 记录锚点来源。
5. **报告**：`trust.anchor` 不得由 PR 输入内容直接决定；可信期望值由 base 侧执行逻辑提供。

## Research 07 约束

- Manifest 摘要已固定为“原始文件字节”口径；证据哈希仍沿用现有工作区字节口径。checkout 必须固定 `core.autocrlf=false`，并确认 PR 没有自定义 `filter`/`working-tree-encoding`；若发现 `.gitattributes` 会让工作区字节与 Git blob 不一致，记录为假失败风险，不把差异解释成篡改。
- 锚点比较只使用 base 侧提供的期望值；PR 的 `.gitattributes`、路径或文件名都视为不可信输入。

## Answer

**已收口（2026-10-31）。**

### 实现

- `packages/pipeline/src/evidence-integrity.ts`
  - `trust.anchor` 报告块：`mode` / `source` / `expectedSha256` / `actualSha256` / `baseManifest{path,sha256,byteEqual}` / `result`；旧报告缺该字段仍合法。
  - `verifyDeliveryEvidence(manifestPath, { expectedManifestSha256?, baseManifestPath? })`：对 Manifest **原始字节**算 SHA-256；摘要不匹配或 base 字节不等 ⇒ `status=fail`、`exitCode=1`、`diagnostics` 新增 `anchor` 分类；摘要格式错 ⇒ usage 2；base 读不出 ⇒ invalid 4。
  - `trust.anchor` 只记录调用方给出的摘要；来源可信性由 base/CI 负责；不写回清单、不自动更新摘要。
- `packages/cli/src/evidence.ts` / `packages/cli/src/cli.ts`
  - `verify-delivery` 新增 `--expected-manifest-sha`、`--base-manifest`；`--base-manifest` 必须与摘要同时给；USAGE、summary、`data.trustAnchor` 同步。
- `.scratch/evidence-integrity-v1/manifest/expected-hashes.sha256`
  - 内容 `sha256:ba7a485b195fe3d362fd4cb244d397c844d4e07fb0d2ccc89f914043bf4d36fd`，对原始 Manifest 字节计算；**当前未提交**（按图纪律，提交需单独授权）。

### E2

- `pnpm test`：**156 文件 / 2297 用例通过**。
- `pnpm typecheck`：全包通过。
- 新增 8 个 pipeline 锚点用例 + 5 个 CLI 锚点用例（匹配、mismatch、base 字节不等、base 读不出、缺参数、格式错、无锚点向后兼容、Markdown 记录）。

### E3（真实 223 文件基线）

- 正例：`runs/2026-10-31-anchor-e3/summary.json` —— exit 0 / `status=pass` / 223 文件（151 required / 72 optional）/ 13 records / diagnostics 0 / `trust.anchor.result=matched`（`digest+base`，expected=actual=base=`sha256:ba7a485b…36fd`，`byteEqual=true`）/ 2s。
- 反例：`runs/2026-10-31-anchor-e3-negative/summary.json` —— exit 1 / `status=fail` / `trust.anchor.result=mismatch` / `anchor.manifest-digest` + `anchor.base-manifest` 两条诊断 / 报告仍落盘。
- 运行前后未修改证据、交付或历史报告。

### 限制

- `pnpm check` 仍红，仅由 6 条既有断裂链接导致（08 票）；01 未改这些文件。
- `expected-hashes.sha256` 未提交；03 的 CI 读取它之前需要入库。
- `pnpm test:evidence` 目前仍不传锚点（保持向后兼容）；03 会在 CI 中显式传 `--expected-manifest-sha` / `--base-manifest`。
