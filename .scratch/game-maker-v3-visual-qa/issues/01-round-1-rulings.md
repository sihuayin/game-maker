# 01. 第一轮裁定（视觉 QA 接口）

Type: grilling
Status: resolved
Owner: claude (2026-10-18 · 人裁离线回传)
Blocked by: —
Map: ../map.md
> 本轮确定终点形态、观察范围、落点、计算/装配分工、review 与 site 边界、是否带执行、观察/门禁分离。
> 以下裁定逐字保留。

## Question

所谓「视觉 QA 接口」到底交付什么；哪些观察；落在哪；谁算谁装；review/site 的位置；是否带执行；观察与门禁的边界。

## Answer

> 裁定结论：Q1–Q8 全部接受推荐方案，采用 Phase 1「免费 inspect 观察接线」路线。
> 本图的目标是让现有视觉诊断结果进入 QA 报告，而不是建立新的视觉评分系统。
> 保持现有报告契约、判据和付费边界不变，只完成 pack 级观察的计算、传递与装配。
>
> | 问题 | 我的裁定 |
> | --- | --- |
> | Q1 终点形态 | 接受 (a)。在 create/build 链中接入免费 `inspectPack`，将 summary 作为 `qa-report.json.observations` 的 `inspect` 条目；`review` 仍为 `unavailable`。不改报告 schema 和判据。 |
> | Q2 观察范围 | 接受 (a)。覆盖现有 palette usage、色板外像素、背景层覆盖率，以及图片实际宽高比、输出尺寸与预期差。仅记录，不评分、不阻断。不加入风格相似度、剪影可读性、构图或材质相似度。 |
> | Q3 落点 | 接受 (a)。唯一持久化载体为 `run/v<N>/qa-report.json` 的 `observations`。保持预渲染 `lines` 的契约，原样搬运。不新增 `asset-observations.json`，不扩展 plan sidecar。 |
> | Q4 计算/装配 | 接受 (a)。由 pipeline 调用 `packages/assets` 中的 `inspectPack`，将观察输入传入 `qaRunner`。`packages/qa` 继续只负责装配，依赖白名单仍只有 `contracts`。 |
> | Q5 review | 接受 (a)。`game-maker review` 保持人工主动调用、付费抽查，不接入自动创建链。报告中的 `review` 继续为 `unavailable`，沿用 v2 票 78 的既定边界。本图不增加外部 review 结果注入接口。 |
> | Q6 site 级 QA | 接受 (a)。本图只覆盖 pack 级观察。站点渲染、浏览器截图、像素检查另开图，不纳入本轮施工。 |
> | Q7 是否带执行 | 接受 (a)。本图包含 inspect 接线、测试与文档更新，不仅停留在接口裁定。 |
> | Q8 观察/门禁 | 接受 (a)。观察只观察，不评分、不阻断。现有六条判据与 `qaVerdict` 保持不变；`review` 仍不阻断。任何观察升级为门禁，均须另行裁定。 |
>
> ### 补充依据与施工边界
>
> **1. 最小数据流**：create/build pipeline → pack 生成完成 → `inspectPack`（免费）
> （计算现有指标及新增尺寸观察）→ `qaRunner`（接收已计算的观察，原样装配 lines）→
> `qa-report.json`（inspect：ok · review：unavailable）。不要求新增中间文件或公共契约。
>
> **2. 必须守住的边界**：
> - **观察与判据分离**：新增观察不得改变 `qaVerdict`，不得引入阈值、综合分或自动修复。
> - **计算与装配分离**：PNG 解码、指标计算留在 assets；qa 不得绕过上游直接读取 PNG，
>   也不得顺手调用 `reviewPack`。
> - **报告契约不变**：保持 `inspect` / `review` 两条观察、预渲染 `lines` 和原样搬运语义，
>   不把结构化诊断数据重新定型为新的报告契约。
> - **付费边界不变**：自动 create/build 链不得因本图新增视觉模型调用。
> - **失败语义必须明确**：不得把 inspect 观察的缺失或计算失败悄悄伪装成 `ok`。
>   实施前应依据现有报告契约明确：观察不可用时如何表示、是否允许缺失，
>   以及它不得改变既有 QA 判定的保证。
>
> **3. 验收范围**：
> 1. create/build 成功后，QA 报告包含免费 inspect 观察。
> 2. 现有 inspect 指标进入观察文本；宽高比和输出尺寸差有明确、可复现的记录。
> 3. 报告中的观察文本与上游计算结果一致，不在 qa 层重新解释或计算。
> 4. review 不被自动调用，仍为 `unavailable`。
> 5. 原有六条判据、`qaVerdict` 和 QA 依赖白名单保持不变。
> 6. 覆盖成功、观察不可用及失败路径的测试；补齐必要文档。
> 7. 全程不调用付费视觉上游。
>
> **最终裁定**：本图按 Q1–Q8 的推荐方案收敛，并带执行。交付物是 pack 级免费视觉观察进入 QA 报告的完整接线，
> 不包含 site 级视觉 QA、review 注入、结构化观察新契约或任何新的阻断判据。
