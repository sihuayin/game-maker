# U2-R2 独立复核

Type: task
Status: open
Owner: —
Blocked by: 08
Map: ../map.md
Class: U2 / REVIEW

## Task

由**未参与 U2 编写**的独立复核会话，按授权包 §9.2 的 R2 清单复核 U2，并写正式报告。

### 输入包（只给这些）

- 授权包 `docs/v7.8/移动-I02.md` @ `797cd6fc…`；
- U2 白名单；
- R2 清单（授权包 §9.2）；
- 测试命令；
- `git diff <U2 base>..<head>` 与 head SHA；
- U2-07 的证据路径。

**不得**提供：作者总结、作者的 PASS 结论、作者的调试笔记。

### 必须自行执行

1. 检查 diff 与全部变更文件；
2. 运行 U2 定向 vitest 与 `pnpm test`，记录退出码；
3. 检查 T-55 / T-57 / T-58 / T-61 / T-62 / T-64；
4. 逐项判断 R2：Witness 模型、S1–S4、残差等待、U9、完整性、Witness 形状、双档、反例、范围与模型条件；
5. 检查未提前实现 U3 / U4 / U5（无门区 / 图割 / 性能证据 / A–J）；
6. 检查无公共导出 / 无生产接线 / 无 JSON fixture / 无新依赖。

### 报告

写入唯一权威路径：

```text
.scratch/level-playability-v1.1-i02/reports/R2-review.md
```

报告必须含：

- 逐项 `PASS / FAIL / NOT_RUN`；
- 每项的命令、退出码、原始输出摘要或 hash；
- diff scope、未覆盖项；
- 复核人、日期；
- 末尾**用户签署栏**（由 U2-SIGN 填写）。

### 失败处理

任一 `FAIL` 或必要项 `NOT_RUN` ⇒ R2 不通过；U2 不得标记完成；R2 PASS 也不能替代用户签署。

### 验收

报告完整、可复核；未修改任何产品文件。
