# 04. inspect 不可用 / 计算失败的语义

Type: grilling
Status: resolved
Owner: claude (2026-10-18 · 人裁离线；第二轮已收口，见 [06](06-round-2-rulings.md))
Blocked by: —
Map: ../map.md
> 第一轮边界：「不得把 inspect 观察的缺失或计算失败悄悄伪装成 ok」；
> 「明确观察不可用时如何表示、是否允许缺失、不得改变既有 QA 判定」。本票定这一格。

## Question

1. `inspectPack` **成功** ⇒ pipeline 传 `{ source:"inspect", outcome:"ok", lines }`。
2. `inspectPack` **抛错**（PNG 解码 / manifest 读不出 / 其它）⇒ 怎么处理？
   (a) pipeline 捕获，传 `{ source:"inspect", outcome:"unavailable", reason:"inspect 不可用：…" }`；
       build 继续，QA 判定不变（推荐；与 review 的 unavailable 同形）。
   (b) build 失败（把观察失败升级为阻断）。
   (c) 传一个空 `ok`（禁止；伪装）。
3. **standalone `qaRunner` 未收到观察**（旧调用方 / 测试）⇒ 保持今天的 `unavailable` 与理由？
   还是要求必传（破坏兼容）？
4. 报告契约要求 `inspect` / `review` **各恰好一条**：pipeline 必须构造一条；不存在“缺失”。
5. `unavailable` 的 reason 要自包含（为什么、哪个阶段）；不得伪造 `lines: []`。
6. 测试：成功 / inspect 抛错 / 未传观察 三档；每种都要断言 `qaVerdict` 与六条判据**不受影响**。


## 第二轮裁定（收口，见 [06](06-round-2-rulings.md)）

见 06 的逐字裁定；本票的接口/内容/失败语义已按 Q9–Q11 收敛。
