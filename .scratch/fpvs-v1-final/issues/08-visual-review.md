# FA-04 视觉人工审核

Type: task
Status: closed
Owner: main session（材料）+ 用户（人工判断）· 2026-10-28
Map: ../map.md
Blocked by: 07

## Question

由人类对**最终验收版本**做 P0-06 风格一致性人工对照：参考图 vs 实际交付资源 vs 实际运行画面。
这是 HITL 票 —— 我只准备材料，不替人类判断视觉好坏。

1. **材料绑定**：全部材料绑定 FA-01 冻结（若 FA-03 产出新版本，则绑定新版本）的
   `pack/vN` / `site/vN` / config；材料清单记录路径与哈希。
2. **材料包**：原始风格参考图；实际交付资源包（关键资源：角色、巡逻危险物、宝箱、收集物、平台、背景、HUD）；
   实际运行画面（启动、移动/跳跃、收集、宝箱、危险物、到达目标；优先用 FA-02 的截图，必要时从冻结站点补拍）；
   已有 Visual QA 结果与问题记录。
3. **逐项判断**（FR-04 表）：整体风格 / 色彩与明暗 / 角色 / 场景 / 关键物件 / 实际运行效果
   （裁切、比例、错位）。
4. **结论**：`pass` / `fail` / `incomplete`（材料不完整、版本不匹配或无法可靠判断）。
   每项记录：版本、所用参考图与运行画面、结论、判断理由、已发现问题与证据、审核时间、审核者。
5. **不许先 PASS 后补图**；缺材料的项标「无法确认」，不得用历史 PASS 替代。
6. **写回**：用现有 `writeVisualReviewToReport`（或等价）写工作区 `qa-report.json`；快照零写入。

完成条件：P0-06 得到明确、可复核、绑定最终版本的审核结论；不通过时最终验收不得为 pass。

## Answer

**结果：P0-06 人工审核 `pass`（六项全部通过，无问题、无缺材料、无版本不匹配）；已写回工作区，
`delivery.verdict = pass`。**

1. **材料绑定**：全部材料绑 FA-01 冻结身份（`wasteland-scavenger-recipe` · pack/v1 · site/v1 ·
   shell 2 · config `sha256:455d9c7f…7dcd`）。`materials.json` 记录 17 个源材料 + 27 个生成材料的
   逐文件 sha256；reference / deliveredAssets 对快照 **frozen match**；work 的 `qa-report.json`
   只比快照多 FA-02 的 delivery 写回，QA 层（含视觉 failures/observations）字节一致。
2. **材料包**（`runs/2026-10-28-visual-review/`）：原始参考图（`reference.png` = `style.png`）；
   交付资源图集帧（角色 10 帧 / 危险物 6 帧 / 宝箱·收集物·平台·HUD / 4 层背景，均 8×/6×/1× 放大）；
   9 张**真实按键通关**运行截图（启动、移动、跳跃、收集、危险物等待、危险物跨越、宝箱、到达目标、终态），
   由 `capture.mjs` 从冻结工作区站点实拍：`won=true`、collected 6、chests 2、0 reset、0 runtime-error、
   `siteIntegrity.unchanged=true`；已有 Visual QA 记录（视觉通道 unavailable、2 条尺寸 warning）。
   浏览入口：`review.html`。
3. **逐项判断**（审核者 = 人（本次会话用户），2026-10-28）：整体风格 / 色彩与明暗 / 角色 / 场景 /
   关键物件 / 实际运行效果 **六项全部 pass**；未提出具体问题；历史阶段C 的 visual PASS 未继承。
   逐项机器可读记录：`review-record.json`。
4. **写回**：`packages/cli review-verdict --verdict pass` → `writeVisualReviewToReport`
   （只动视觉评审三处）。`delivery.visualReview = { status: "pass", reviewer: "人（本次会话用户）",
   reviewedAt: "2026-10-28T08:12:51.004Z", note: … }`；六项检查全 pass
   （playable-smoke = SUCCESS）；`delivery.verdict = pass`。
   快照 66 条哈希零变化；work 仅 `run/v1/qa-report.json` 变；site/pack/config 字节未改。
5. **产物**：`runs/2026-10-28-visual-review/`（README · review.html · review-record.json ·
   materials.json · capture.mjs · build-materials.mjs · assets/ · shots/ · 运行证据）。
   报告：[runs/2026-10-28-visual-review/README.md](../runs/2026-10-28-visual-review/README.md)。
   → 解除 FA-05 阻塞。
