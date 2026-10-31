# N01–N17 负向测试矩阵

Type: task
Status: resolved
Blocked by: 01

## Question

把 P0-03 PRD §6.3 的 N01–N17 落成可执行的负向测试矩阵；不重复实现校验器。

1. 先建立本 effort 的 `negative-test-matrix.md`：每行记录 N ID、场景、现有测试文件/用例（若已有）、缺口、隔离 fixture、预期退出码/状态/失败分类/定位信息。
2. 复用 `evidence-integrity-v1` 已有 18 个 pipeline 用例 + 6 个 CLI 用例；只补缺口：
   - **N06 Manifest 篡改**：改 expected hash，锚点校验失败；
   - **N07 双重篡改**：同时改证据与 Manifest，锚点校验失败；
   - **N15 Manifest 重复记录**：验证正式入口拒绝；若 schema 已拒绝，记录实际入口与错误，不新增重复校验代码；
   - 其余 N01–N17 逐项映射，缺什么补什么。
3. 每个失败测试至少断言：退出码、报告状态、失败分类、失败文件/记录定位、历史 verdict 是否失效、原始文件哈希不变；不能只断言非零退出码。
4. 所有破坏性测试只在 `mkdtemp`/隔离 fixture 中运行；不修改冻结 Demo、不写历史 run、不调用模型/网络。
5. E2：`pnpm test` 全绿；E3：至少 N06/N07 走正式 CLI，真实失败并留下日志/报告。

## Research 07 约束

- 在 N 系列之外补一条数据面检查：PR head 的 `.gitattributes` / `working-tree-encoding` 是否改变证据工作区字节；若会，记录为已知限制并在报告中区分“字节口径差异”与“真实篡改”。
- 符号链接/路径逃逸继续由 CLI 的 `realpath` + 根目录包含性检查拒绝；checkout 目录本身不提供隔离保证。

## Answer

**已收口（2026-10-31）。** 矩阵：[negative-test-matrix.md](../negative-test-matrix.md)。

### 覆盖

- N01–N17 全部映射到具体测试；N01/N02/N04/N05/N08/N09/N10/N11/N12/N13/N14/N16/N17 复用 `evidence-integrity-v1` 已有用例；只补缺口：
  - **N03** Playtest 报告字节篡改（新）；
  - **N06** Manifest 期望哈希篡改、可信摘要不变（新）；
  - **N07** 证据 + Manifest 同时篡改、可信摘要不变（新；被改文件在改后清单下仍 `verified`，只有锚点能发现）；
  - **N15** Manifest 重复 file / record（pipeline 抛 invalid；CLI 侧 duplicate file ⇒ exit 4 且不写报告）。
- 新增 `expectFailure(report, status)`，让 21 处失败断言同时检查 `exitCode=1` 与报告 `status`；每个用例另行断言具体结果/诊断/定位。
- N11 额外断言历史 `declared=pass` 与当前 `recomputed/status` 不一致；N16 断言除 `generatedAt` 外报告全等；N17 断言校验前后 fixture 全量 SHA-256 不变。

### 运行结果

- `pnpm test`：**156 文件 / 2303 用例通过**。
- `pnpm typecheck`：全包通过。
- E3 N06：真实 223 文件基线 + 临时 Manifest（期望哈希改全零，证据未动）→ **exit 1 / status fail / `trust.anchor.result=mismatch`**，诊断含 `anchor.manifest-digest`、`anchor.base-manifest`、`file.hash-mismatch`。产物 `runs/2026-10-31-n06-n07/n06/`。
- E3 N07：隔离 fixture（改证据 + 同步改 Manifest，可信摘要不变）→ **exit 1 / status fail / `trust.anchor.result=mismatch`**，被改文件 `verified`。产物 `runs/2026-10-31-n06-n07/n07-clean/`。

### 限制

- 所有破坏性用例只在 `mkdtemp` / effort 临时目录；未修改冻结交付、历史 run 或真实证据。
- `pnpm check` 仍红，仅由 08 票的 6 条既有断裂链接导致。
- N07 曾尝试复制真实 `out` root，复制导致材料自述路径诊断；已改用隔离 fixture，真实基线 N06 证明同一机制。
