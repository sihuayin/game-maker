# 06. 静态 HTML 评估报告长什么样？

Type: prototype
Status: open
Blocked by: —
Map: ../map.md

## Question

Q13 决定了交付形态是「CLI + 静态 HTML 报告」，Q14 的验收标准里明确要求
「HTML 报告展示评分与至少一轮让分数上升的自我修复」。

这张票**不被任何东西阻塞**，因为要渲染的数据结构已经完整存在：
`demo/src/contracts/index.ts` 里的 `CreationEvaluationReport`
（含 requirement / assets / visual / gameplay / runtime / interaction /
quality / gate / evidence 九个部分）+ `CreationRun`（iteration / best）+
`RepairPlan[]`。可以先对着**现有 MockEvaluator 的真实输出**把报告做出来，
等真实 adapter 落地后直接换数据源。

要回答：

1. **报告要让人判断什么？** 核心是 Q14 的验收：一眼看出
   「AI 自检发现了什么问题、修了什么、分数有没有真的上升」。
   所以**迭代曲线**（iteration 1 → 2 → 3 的分数变化）大概是主角，
   而不是单次评估的雷达图。这个主次判断对不对？
2. **展示哪些内容**？候选：
   - Hard Gate 的逐项 pass/fail（文档第 38 节的 5+5 条）
   - Quality Score 与各维度权重贡献
   - Blockers 与 Recommendations
   - Visual Issues（含 severity）+ 对应截图 Evidence（**内嵌还是链接文件？**）
   - Gameplay 测试逐条结果，critical 的要突出
   - Requirement 覆盖矩阵（哪条 requirement 由哪个测试覆盖、过没过）
   - Repair 历史：每轮改了什么 action、targetId、strategy、前后分数
   - Best State 标记（哪一版是最好的、当前是不是最好的）
   - **Fixture Mode 标注**（Q8/票 14：一个不知道自己是 fixture run 的 PASS 是虚假的 PASS）
3. **截图怎么进 HTML**？base64 内嵌（单文件、可邮件发送、但体积大）
   还是相对路径链接（体积小、但报告不能脱离 run 目录移动）？
   Q9 决定了报告落在 `demo/projects/<id>/runs/<runId>/`，截图在同目录下，
   相对路径是可行的。
4. **单文件还是多文件**？「静态 HTML、无框架、无服务器」已定，
   但是一个自包含的 `report.html`（含内联 CSS/JS）还是一个目录？
5. **要不要交互**？纯静态（全部展开）还是允许少量原生 JS
   （折叠面板、切换 iteration 对比）？
6. **生成方式**：字符串模板拼接、还是引入一个模板库？
   考虑到 Q15「手写固定」的原则，这属于手写代码，不该让 AI 每次生成。

调用 `prototype` skill：**用现有 `demo/src/example.ts` 跑出来的真实
MockEvaluator 输出**做一个报告原型，让人类看着实物 react。
产出物链接到本票。

## Answer

_（待填）_
