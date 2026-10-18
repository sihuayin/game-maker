# 04. 「同一输入可重复」的判据：归一化输入与 resolver 的纯函数性

Type: grilling
Status: resolved
Owner: claude (2026-10-18 · 人裁离线；第四轮已收口，见 [13](13-round-4-rulings.md))
Blocked by: —
Map: ../map.md
> 第一轮验收要求「同一份资源规格与能力输入，路由结果可重复、可测试」。
> ⚠️ 整份 design/VWS 原文的可重复性不在本票承诺内 —— 模型负责资源发现，本票只约束 resolver。

## Question

「归一化输入」的确切边界是什么？

1. 输入是否 =（模型产出的资源规格集合 + 能力对象 + 既有素材引用），而不含模型原文？
2. `resolveRoute` 是否必须是**纯函数**：同输入 ⇒ 同字节结果，无随机、无时间、无环境读取？
3. 模型路线候选是否进入归一化输入（若进入，候选变化就会改变结果，违背可重复）？
4. 重复性测试怎么构造：同一 fixture 跑 N 次、比较什么（sidecar 的 route/reason/inputs？整份 Recipe？）；
   是否允许模型的资源清单本身不同（不在本判据内）？
5. 与 `planAssets` 现有的 `STRUCTURED_CALL_ATTEMPTS` 重采样的关系：重采样后 resolver 仍应给出同一结果。


## 第四轮裁定（收口，见 [13](13-round-4-rulings.md)

- 归一化输入 = `spec + context + capabilities + existingAssets + candidate`；同一份输入 ⇒ 同一输出。
- 模型资源清单/候选生成过程不在确定性承诺内；整份 Recipe 不要求字节级一致。
- resolver 纯函数；ref `accessible` 预检查；无 I/O/时间/随机/环境。
- 重复性比较 `route / reason.code / inputs / candidate / participated`（固定文案的 text 也比）；
  sidecar route === Recipe source.kind；id 集合一致；旧 Recipe 可无 sidecar。
- 确定性按 `plannerVersion` 承诺。
