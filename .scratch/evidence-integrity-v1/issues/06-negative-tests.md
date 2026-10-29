# 负向测试：篡改 / 缺失 / 不可读 / 错配 / 路径逃逸 / 符号链接 / 结论过期

Type: task
Status: open
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
