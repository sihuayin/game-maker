# 负向测试：篡改 / 缺失 / 不可读 / 错配 / 路径逃逸 / 符号链接 / 结论过期

Type: task
Status: resolved
Blocked by: 04, 05

## Question

用 `mkdtemp` 合成 3–5 文件的迷你交付 + 迷你清单，逐类证明校验器会拒绝，且**原始 fixture 零修改**：

- 内容篡改（保持预期哈希）⇒ `hash-mismatch` / `fail`；
- 必需文件缺失 ⇒ `missing` / `blocked`，且不从必需清单静默删除；
- 不可读（权限模拟）⇒ `unreadable` / `blocked`，不默认成功；
- 身份错配（哈希正确、身份不符）⇒ `fail`；
- 报告引用错 attempt / 审核 subject 与材料集合不一致 ⇒ `reference-invalid` / `fail`；
- 声明 `pass` 但当前必需证据失效 ⇒ 重算不再继承旧 `pass`；
- 路径五类（Q14）：`..` 越界、绝对路径越界、root 外符号链接、悬空链接（拒绝），root 内合法链接（通过）；
- 重复执行：同输入两次结果一致（确定性）；
- 只读性：运行前后 fixture 全量文件哈希一致。

约束：不得直接改冻结交付（PRD §8）；不得只验证 `07-verify-inherited.mjs` 的退出码；
测试必须断言**正式校验器**的诊断类别与状态映射，以及失败时报告仍可定位到具体文件/引用/规则。

## Answer

**已收口（2026-10-29）。**

### 新增负向/边界用例（`packages/pipeline/tests/evidence-integrity.test.ts`，共 18 个）

- 不可读：用目录冒充必需文件 ⇒ `unreadable` / blocked。
- 符号链接三类：指向 root 外 ⇒ `path-invalid` / fail；悬空链接 ⇒ `path-invalid` / fail；
  root 内合法链接 ⇒ `verified`（不误伤）。
- 绝对路径引用 ⇒ `path-invalid` / fail。
- 报告引用错 attempt（`delivery.playtest.report` + `playtest-result` 同时改到未登记的 v1）⇒ `references.report` fail。
- 审核材料集合不一致（review-record 列了 materials.json 里没有的截图）⇒ `visual.materials.collection` fail。
- 结论过期：声明仍 pass、当前必需证据失效 ⇒ 重算不再 pass（declared 保留 pass，status/recomputed ≠ pass）。
- 只读性：校验前后 fixture 全量文件哈希逐项相等。
- 既有：内容篡改、必需缺失、身份不符、身份字段缺失、三方哈希矛盾、声明/重算 verdict 不一致、
  `..` 越界、重复执行确定性（票 04 已落，票 06 保留并一起跑）。

### 随测试补进核心的检查

- `references.report`：qa-report 的 `config.file` / `playtest.report` / `delivery.evidence[].path` 必须解析到清单；
  未登记 ⇒ fail，必需缺失/不可读 ⇒ blocked，可选日志缺失 ⇒ 通过。
- `visual.materials.collection`：review-record 的材料清单必须是 materials.json 的子集。
- `config` / `site` 重算把 `missing/unreadable` 记 blocked、`hash-mismatch/path-invalid` 记 fail（不再一律 fail）。
- 清单把 `*.log` 以 `required:false` 纳入（Q6/D12）：引用可解析，但不进 git 信任边界。

### 证据与回归

- `pnpm test`：**149 files / 2231 tests passed**（新增 9 个负向/边界用例）；`pnpm typecheck` 全 Done。
- 冻结基线（E3）：`pnpm test:evidence` = **pass / exit 0 / 1,348 ms / 223 文件 / 13 records / diagnostics=0**
  （清单 sha `ba7a485b…`，报告 `e1a829ac…`）。
- 所有负向用例都在 `mkdtemp` 副本上执行；冻结交付零改动（只读性用例证明）。

### 已知限制

- 「不可读」用**目录冒充文件**模拟（跨平台确定）；未用 chmod 权限模拟（CI 用户/root 差异会使其不稳定）。
- 符号链接行为在 macOS 验证；Linux 同一套 realpath 语义；Windows 未在本票验证。
- 冻结基线仍是单 Demo；不扩五态 E2E / MCP。
- 工作树未提交（含第三次清单冻结与新的 test:evidence 运行记录）。
