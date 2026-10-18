# 06. 第二轮裁定（视觉 QA 接口 · 02/03/04 收口）

Type: grilling
Status: resolved
Owner: claude (2026-10-18 · 人裁离线回传)
Blocked by: —
Map: ../map.md
> 本轮接受 Q9–Q11 推荐方案；02/03/04 据此收口，05 进入施工授权。以下裁定逐字保留。

## Question

qaRunner 的 inspect 观察输入接口；观察来源/格式/落点；inspect 抛错与未传观察的语义。

## Answer

> 裁定结论：Q9–Q11 全部接受推荐方案。采用窄输入接口 `QaContext.inspectObservation?`，
> 从原始生图与目标规格计算可复现的尺寸观察，失败时显式记录 `unavailable`，始终不阻断 build。
>
> | 问题 | 我的裁定 |
> | --- | --- |
> | Q9 输入接口 | 接受 (a)。在 `QaContext` 增加可选字段 `inspectObservation?: Observation`。由 pipeline 构造并传入 `qaRunner`；未传时保持现有 `unavailable` 行为。仅接收 `source: "inspect"` 的观察，不开放 review 注入。 |
> | Q9 字段/校验 | 接受窄字段 `inspectObservation`。`qaRunner` 只负责原样装配观察，不校验、不改写、不重新生成 `lines`。输入类型与持久化报告契约分离，不改变报告 schema。 |
> | Q10 观察来源 | 接受 (a)。观察原始生图与目标规格之间的尺寸关系，覆盖 animation、background layer、single sprite、master、import；drawlist 无位图，跳过。交付帧不作为主要比较来源。 |
> | Q10 行格式 | 接受推荐格式：`资源标识 · 源图 WxH (ar) → 目标 WxH (ar) · 长宽比差 Δ%`。统一使用「源图 → 目标」顺序，不设置阈值，不判定通过或失败。 |
> | Q10 落点 | 接受 (a)。新观察段并入 `inspectPack.summary`，由报告原样搬运。`inspectPack.data` 可以保留结构化诊断值，但不新增持久化契约或独立观察文件。 |
> | Q11 inspect 抛错 | 接受 (a)。pipeline 捕获 inspect 异常，构造 `source: "inspect"`、`outcome: "unavailable"` 和自包含的 `reason`；build 继续，六条判据与 `qaVerdict` 不变。禁止伪装成 `ok`。 |
> | Q11 未传观察 | 接受保持旧行为。standalone `qaRunner` 未收到观察时，继续生成现有的 `unavailable` 观察及理由；报告始终恰好包含一条 inspect 观察。 |
> | Q11 测试范围 | 接受三档测试：成功、inspect 抛错、未传观察。每档都断言六条判据和 `qaVerdict` 不受影响；使用 fake 和固定 fixture，零付费。 |
>
> ### 长宽比差的统一定义
>
> `r_s = W_s / H_s`，`r_t = W_t / H_t`；`Δ_AR = (r_t / r_s - 1) × 100%`。
> `Δ > 0` 目标长宽比高于源图；`Δ < 0` 低于；`Δ = 0` 相同。
> 例：源图 1184×864（1.370）→ 目标 144×108（1.333），Δ ≈ -2.7%。
> 显示一位小数，计算用未舍入值；尺寸始终 `WxH`，顺序始终源图→目标。
>
> ### 各类资源的比较口径
>
> | 资源类型 | 源尺寸 | 目标尺寸 |
> | --- | --- | --- |
> | Animation | 原始动画 PNG 实际宽高 | `size.w × frames`、`size.h` |
> | Background layer | 原始图层 PNG 实际宽高 | 资源 `size` |
> | Single sprite | 原始 PNG 实际宽高 | 资源 `size` |
> | Master | 母版 PNG 实际宽高 | 既有 `master-ratios.json` 的 canonical（`requested`），不另推一套 |
> | Import | 导入 PNG 实际宽高 | 资源 `size` |
> | Drawlist | 无位图 | 跳过 |
>
> ### 失败语义
>
> - `ok`：inspect 成功，`lines` 为真实观察文本。
> - `unavailable`：inspect 未执行成功或调用方未提供观察；使用对应的真实原因。
> - 不允许失败→空 `ok`，不允许 `lines: []` 伪造成功。
> - 异常中的敏感路径/堆栈/内部细节不应无条件写入持久化报告；`reason` 足以解释原因即可。
>
> ### 验收边界
>
> - `QaContext` 新增的是可选输入，不扩展持久化 QA 报告 schema。
> - `qaRunner` 只装配观察，不读取 PNG、不调用 `inspectPack`、不调用 `reviewPack`。
> - inspect 成功与否不影响 build 成败，不改变现有判据或 `qaVerdict`。
> - 新增尺寸观察必须确定性生成；同一输入得到一致的尺寸、长宽比与文本。
> - 不新增评分、阈值、自动修复、付费调用或 site 级截图检查。
>
> **最终裁定**：本轮按 Q9–Q11 推荐方案收敛。实施重点是可选观察输入、原图到目标规格的确定性尺寸诊断，
> 以及明确且非阻断的 `unavailable` 语义。
