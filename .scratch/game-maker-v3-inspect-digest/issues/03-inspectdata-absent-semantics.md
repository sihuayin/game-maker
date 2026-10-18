# 03. inspect 观察为 ok 但 inspectData 整体缺席时，摘要显示什么

Type: grilling
Status: resolved
Owner: claude (2026-10-18 · 人裁逐字「选择 (a) 整块省略」)
Blocked by: —
Map: ../map.md
> 第二轮边界 3 已定「部分字段不可用 ⇒ 省略对应摘要段」；本票只收口**整份 `inspectData` 缺席**
> 这一条退化路径。它是 05 的最后一个未决语义。

## Question

`b.qa.observations` 里的 inspect 条目是 `outcome: "ok"`，但 `b.inspectData` **整体不存在**
（生产链不会发生；只可能来自测试注入口的旧/假实现，或未来某个调用方没传）。CLI 终端该显示什么？

- (a) **整块省略**：不显示 header、不显示指针；`qa-report.json` 仍在 artifacts 列表里。
- (b) 只显示 header + 指针（让人知道去哪看全文），不显示任何数值。
- (c) 显示一行「inspect 观察数据不可用」——但它与报告里 `outcome: "ok"` 的语义冲突。
- (d) 把这种情况当作 `unavailable` 处理（理由从观察里借）——同样与 `ok` 冲突。

相关但**已定**的三条（不要在本票重开）：
- 部分字段缺失 / 类型不符 ⇒ 省略对应段，不抛错、不解析文本、不以 `0` 冒充缺失（第二轮边界 1、3）。
- `outcome: "unavailable"` ⇒ 一行同源、脱敏的原因（第一轮 Q5、第二轮边界 3）。
- `qa` 整体缺席（调用方显式 `null`）⇒ 没有 inspect 观察，天然没有摘要行（不是本票要改的）。

➡️ 推荐 **(a)**。没有数据就没有摘要；指针只对一份存在的摘要负责，`qa-report.json` 已经由 artifacts 列出。
(b) 会让人以为「摘要正在加载/数据为空」，而 (c)(d) 会把一份报告里的 `ok` 说成不可用 —— 两处语义打架。

## Answer

人裁逐字：

> 裁定：选择 (a) 整块省略。
>
> 当 `qa-report.json` 中 inspect 观察为 `ok`，但 `BuildResult.inspectData` 整体不存在时，终端不显示观察摘要块：无 header、无指针、无占位文案。
>
> 理由与边界：
>
> - `inspectData` 缺失意味着当前没有可用于汇总的结构化数据，不代表 inspect 失败或不可用。
> - 不得把报告中的 `ok` 改写成“观察不可用”，也不得暗示摘要正在加载或稍后出现。
> - 不解析 `qa-report.json` 的文本或 `inspectPack.summary` 来补齐数据，不在 CLI 重新执行 inspect，也不重新计算指标。
> - `qa-report.json` 仍由既有 artifacts 列出，完整观察信息保留。
> - 只有存在可用的结构化 `inspectData` 时，才展示相应摘要；数据字段局部缺失时，仍按既定规则省略受影响的指标或行。
> - 真正的 inspect 失败仍走原有路径：从 QA observation 读取 `reason`，显示“inspect 观察不可用：`<reason>`”。
>
> 关键区分： `inspect` 的执行结果、QA 报告中的观察状态、`BuildResult.inspectData` 是否存在，是三个不同层次。不能用最后一项缺失推断前两项失败。
>
> 无需新增状态字段或修改生产链；补充一条 CLI 渲染测试，验证 `inspect=ok` 且 `inspectData` 缺失时摘要块整体不出现，artifacts 指针仍正常输出即可。

⇒ 05 按此实现：**整块省略**；新增那条 CLI 渲染测试。
