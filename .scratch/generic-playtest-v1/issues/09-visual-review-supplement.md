# 09 视觉审核补审：§7.3 四项未逐项记录的维度

Type: task
Status: resolved
Assignee: claude
Blocked by: 03

## Question

按 [03 的 Q8 裁定](03-gap-triage-and-strategy-ruling.md#answer)，对冻结 wasteland Demo（`pack/v1 · site/v1 · shell 2`，字节不变）补一次轻量人工审核，覆盖 §7.3 中 FA-04 未逐项记录的四个维度：

1. **画面可读性**：危险、收集物、出口和目标是否容易辨认。
2. **动画表现**：关键动作是否存在明显冻结、错帧或不自然表现。
3. **玩法与视觉对应关系**：可见对象是否与其实际功能一致。
4. **整体完成度**：是否达到可展示、可试玩 Demo 的基本质量。

要求：

- **HITL：人类审核**。复用 FA-04 的 8 个不同画面（`08-goal.png` 与 `09-final.png` 字节相同，报告不得声称 9 个不同画面）；动画表现允许用一次手动浏览器运行观察，不改站点字节。
- **追加记录，不改历史**：不得修改 FA-04 `review-record.json` / `capture.json` / `materials.json`；新记录单独成文件（如 `review-record.supplement.json`），绑定 subject（pack/site/shell/checksum）、reviewer、reviewedAt、逐项结论、problems。
- 每项允许 `pass` / `fail` / `insufficient`；不得把补审冒充为「FA-04 七项全量重审」。
- 不重生成资源、不改站点、不跑付费；失败项如实记录，交 07 聚合。

## Answer

**2026-10-28 已收口（HITL）。** 由人类审核者对冻结 wasteland Demo（`pack/v1 · site/v1 · shell 2`，字节不变）完成 §7.3 四项补审，**四项全部 `pass`**，未提出具体问题。未重生成资源、未改站点、未跑付费、未修改 FA-04 历史记录。

### 一、审核材料与绑定

- **8 个不同画面**（复用 FA-04）：`shots/01-startup.png`、`02-movement.png`、`04-pickup.png`、
  `03-jump.png`、`06-hazard-wait.png`、`07-hazard-cross.png`、`05-chest-open.png`、`08-goal.png`。
  `08-goal.png` 与 `09-final.png` **字节相同**（sha256 `b5cbe0e7…`），因此只算 **8 个不同画面**，不声称 9 个。
- 材料清单与逐帧 sha256：`evidence/09-review-materials.json`（8 个 distinct hash / 9 个文件）。
- 身份核对：pack manifest `sha256:a162942d…`、config `sha256:455d9c7f…` 与 `artifacts/identity.json` 全等；
  capture 的 site-integrity 前后一致；当前 site 四文件哈希与 capture before 一致。
- 动画观察入口：审核会话内启动了**本地只读**静态服务
  `http://127.0.0.1:8766/site/v1/index.html`（游戏根目录），审核结束后已停止；未写站点字节。
- 本次只补审四项，**不是** FA-04 六项的「七项全量重审」；FA-04 的六项按原样继承。

### 二、逐项结论

| 维度 | 问题 | 结论 |
|---|---|---|
| 画面可读性 | 危险、收集物、出口和目标是否容易辨认？ | **pass** |
| 动画表现 | 关键动作是否存在明显冻结、错帧或不自然表现？ | **pass** |
| 玩法与视觉对应关系 | 可见对象是否与其实际功能一致？ | **pass** |
| 整体完成度 | 是否达到可展示、可试玩 Demo 的基本质量？ | **pass** |

- 审核者：`人（本次会话用户）`；审核时间：`2026-10-28T15:42:14Z`；`problems: []`。
- 记录（追加、不改历史）：`.scratch/generic-playtest-v1/evidence/09-review-record.supplement.json`。
- FA-04 三份记录零改动（本轮记录其 sha256 作为基线）：
  `review-record.json a1602021…`、`capture.json 8a27db7e…`、`materials.json 060debc4…`；
  `git status` 对 FA-04 目录为 0 改动。

### 三、给 07 的事实

- 视觉补审 `overall=pass`（四项逐项 pass），与 FA-04 六项 `pass` 合并使用，但**来源必须分开标注**：
  FA-04 六项为历史继承；本票四项为 2026-10-28 补充人工审核。
- 不得把本票写成「七项全量重审」，也不得声称 9 个不同画面（实为 8 个；08/09 同字节）。
- `deliveryBinding.written=false`：按 Q8(b)/03 Q9 A，本轮不改产品审核路径、不写 `delivery`；聚合与报告留给 07。
- 补审结论绑定同一冻结对象（pack/site/shell/config checksum 全等）；若 07 发现身份或哈希漂移，补审不得继承。

### 四、限制

- 动画表现的人工判断基于 8 个静态画面 + 会话内提供的只读运行入口；没有录制视频，也没有可回放的逐帧动画证据。
- 本票没有新增截图/录屏能力；所有画面均来自 FA-04 既有材料。
- 只有一个人工审核者、一次补审；不复核 FA-04 六项的判断本身。
