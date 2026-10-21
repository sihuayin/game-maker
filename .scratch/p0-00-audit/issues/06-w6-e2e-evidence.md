# 06. W6 真实产物验证（HEAD 零付费重放）

Type: task
Status: resolved
Owner: claude（2026-10-20 认领 · task/HITL）
Blocked by: —
Map: ../map.md

## Question

按第一轮 Q2 = (c)、Q7 = (b) 执行证据计划：

1. **归档上游清点**：把 2026-10-17 的真跑（`run-2026-10-17{a,b,c}.json` 与 `run-out-2026-10-17{b,c}/`）
   登记为上游 E3，明确标注相对 HEAD 的 commit 漂移。
2. **HEAD 下游重放（零付费）**：
   - `verifyPack` 校验 `pack/v7`（19 资源 / 61 帧）。
   - 用现有手写 config 在 HEAD 重新装配站点（`site` 命令或既有装配路径）。
   - 本地起服务，复用 `.scratch/asset-integration-v1/runs/2026-10-20e-site/drive-cdp.mjs`
     CDP 驱动，记录移动 / 跳跃 / 拾取 / 到达撤离点，留存截图。
3. **记录**：命令、环境、退出码、产物路径、预算 / 账本、失败与重试（遵守现有账本契约）。
4. **判定**：明确写出「HEAD 上没有单跑到达可玩站点」；不得宣称 HEAD E2E 已通过。

人工检查（任务书 W6）：

1. 主角是否清晰可辨、动画帧是否一致。
2. 资源是否与参考图的色彩、轮廓、细节密度、材质表达相符。
3. 参考图未出现的新实体是否仍属于同一视觉世界。
4. 资源是否完整、正确引用且进入游戏场景。
5. 玩家是否可以移动、与目标交互，并完成一段核心循环。
6. QA 的通过 / 失败结果是否与实际观察一致。

## 验收

零付费可复现；失败样例也保存并登记；产出可供 `P0-00-e2e-evidence.md` 直接引用。

## 边界

- **零付费**：任何需要生图 / 文本上游的步骤立即停下，记录阻塞点，改为登记缺口。
- 不改源码 / 配置 / `game-maker.local.json`；只写 `research/w6-e2e-evidence.md` 与截图。
- HITL：人工观察项由用户或本会话在屏幕上确认；代理不得替人声称「玩起来了」。

## 产出

`research/w6-e2e-evidence.md` + `research/e2e-shots/`。

## Evidence（2026-10-20 · 执行完成，主观两项待人工确认）

完整证据：`research/w6-e2e-evidence.md`。运行目录：`runs/2026-10-20a-head-replay/`。

**客观结论**

1. HEAD 下游重放可玩：`verify` exit 0（157 checksum）→ `site` exit 0（shell 2 / pack v7 / 19 资源）→
   CDP 驱动：3/3 pickup、到达终点、`won=true`（t=5990ms）。截图 `15-won.png`。
2. 但没有 HEAD 单跑 E2E：上游是归档真跑，config 是手写的，`compile-runtime` 未参与。
3. 归档的完整链路单跑（第二十跑 `run-2026-10-17d`，exit 0，`qa-report.failures: []`）站点能启动，
   **却不可玩**：6 个 pickup 全部收不到，走到 gate 仍 `won=false`；背景全黑，敌人 y=-125722。
   运行后 `bf3e11f` / `a3ac8d8` 才修了背景落位与实体交互。
4. 新 P0：危险物在空中重置玩家 ⇒ 掉穿地面、不可恢复（`hazard-repro-trace.json`）。
5. `site` 不生成 `qa-report.json`；`inspect` 的观察值不阻断。

**待人工确认**

- 第 2 项：站点截图与 `reference.png` 的风格一致度。
- 第 3 项：参考图未出现的新实体是否仍属于同一视觉世界。

确认后本票转 `resolved`，并把结论索引到地图。

## Answer（2026-10-20 · task/HITL · 用户裁定后收口）

### 用户裁定（逐字）

| 问题 | 裁定 | 理由与边界 |
| --- | --- | --- |
| Q1 风格一致度 | (c) 不确定，补充并排对照后再裁 | 当前材料描述了棕灰底、橙红点缀和像素语言，但我尚未直接查看参考图与站点截图，不能据此替你确认色彩、轮廓、细节密度和材质表达是否达到可接受标准。 |
| Q2 新实体同世界 | (c) 不确定，逐件对照后再裁 | ceiling-lurker、wasteland-enemy、extraction-point 是否融入同一视觉世界，需要检查实际渲染结果，不能只凭色板和像素密度推断。 |
| Q3 接受 W6 结论并关票 | (a) 接受客观结论并关票，但保留两项视觉裁定待补 | W6 已取得足够的客观运行证据来完成当前阶段的取证。视觉主观项未裁定，不应阻止客观审计结论收口，但必须明确保留。 |

### 收口内容

- **客观结论已收口**：HEAD 下游重放可玩（3/3 pickup · 到达终点 · `won=true`）；归档完整链路单跑
  站点装配成功但不可玩；危险物空中重置 ⇒ 掉穿地面；没有 HEAD 单跑 E2E；`site` 绕过 QA；
  `inspect` 观察不阻断。证据：`../research/w6-e2e-evidence.md`，运行目录
  `../runs/2026-10-20a-head-replay/`。
- **两项视觉裁定保留**：Q1 / Q2 未裁，移入 [视觉对照裁定](08-visual-comparison-rulings.md)。
  对照材料已生成：
  - `../runs/2026-10-20a-head-replay/visual-compare/q1-reference-vs-site.png`
  - `../runs/2026-10-20a-head-replay/visual-compare/q1-reference-vs-site-mid.png`
  - `../runs/2026-10-20a-head-replay/visual-compare/q2-entities-vs-world.png`
  - 逐件：`q2-ceiling-lurker.png` / `q2-wasteland-enemy.png` / `q2-extraction-point.png`
- **边界遵守**：零付费；未改源码 / Schema / `game-maker.local.json`；未提交。

> 本票只关客观取证；**视觉能力是否达标仍未裁定**，不得在审计文档里写成「风格一致」。

### 后续（2026-10-20）

保留的两项视觉裁定已由 [08](08-visual-comparison-rulings.md) 收口：
**Q1 = (a)** 整体风格可接受；**Q2 = (b)** 世界观兼容但有局部缺口
（`ceiling-lurker` 剪影可读性、`extraction-point` 像素尺度与材质分块；`wasteland-enemy` 不定性为漂移）。
W6 的客观结论与证据边界不变；危险物掉穿地面仍是独立高优先级候选。
