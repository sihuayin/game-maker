# U1-R1 独立复核

Type: task
Status: open
Owner: independent reviewer subagent · 2026-11-12
Blocked by: 06
Map: ../map.md
Class: U1 / REVIEW

## Task

由**未参与 U1 编写**的独立复核会话，按授权包 §9.1 的 R1 清单复核 U1，并写正式报告。

### 输入包（只给这些）

- 授权包 `docs/v7.8/移动-I02.md` @ `797cd6fc…`；
- U1 白名单；
- R1 清单（授权包 §9.1）；
- 测试命令；
- `git diff ed02339..<head>` 与 head SHA；
- U1-05 的证据路径。

**不得**提供：作者总结、作者的 PASS 结论、作者的调试笔记。

### 必须自行执行

1. 检查 diff 与全部变更文件；
2. 运行定向 vitest 与 `pnpm test`，记录退出码；
3. 检查 T-57 / T-58 / T-61 / T-62 / T-64；
4. 逐项判断 R1：运动模型、AABB 语义、连续求交、ε、数值稳定性、反例、范围与确定性；
5. 检查 U1 预算边界：只实现 U1 范围，未提前实现 U2/U5；
6. 检查无公共导出 / 无生产接线 / 无 JSON fixture / 无新依赖。

### 报告

写入唯一权威路径：

```text
.scratch/level-playability-v1.1-i02/reports/R1-review.md
```

报告必须含：

- 逐项 `PASS / FAIL / NOT_RUN`；
- 每项的命令、退出码、原始输出摘要或 hash；
- diff scope、未覆盖项；
- 复核人、日期；
- 末尾**用户签署栏**（由 U1-SIGN 填写）。

### 失败处理

任一 `FAIL` 或必要项 `NOT_RUN` ⇒ R1 不通过；U1 不得标记完成，R1 PASS 也不能替代用户签署。

### 验收

报告完整、可复核；未修改任何产品文件。
