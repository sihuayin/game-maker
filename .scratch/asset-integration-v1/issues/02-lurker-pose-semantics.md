# 02. 潜伏者 hang / lunge / retreat 语义修复

Type: task
Status: resolved
Owner: claude (2026-10-20 认领 · 已施工、已关)
Blocked by: —
Map: ../map.md
> 派生自最终包的内容验收：潜伏者形象一致，但倒挂 / 站立语义混用。

## Question

按动作逐帧修 `ceiling-lurker` 的语义：

- `hang`：倒挂在天花板 / 通风管下，头朝下；
- `lunge`：落下并短距离扑击，身体转为前扑；
- `retreat`：回到悬挂位，恢复头朝下。

做法：逐帧重生成语义不符的帧（≤13 发），把新 raw 放进 patch 目录，
其余帧 + 3 drawlist 用 `reuseFrom` 复用重建；不改包结构。

## 验收

- 三个动作的倒挂 / 站立语义在联系表上逐帧可读。
- 重建包 `verifyPack` ok；帧数不变（4 / 5 / 4）；0 母版调用。
- 花费 / 每帧调用数落账。

## 边界

- **付费**：先出书面预算报告 + 逐字点头；本票不预授权。
- 不改母版 / 网格判据；不重跑其他资源的帧。

## Comments

### 2026-10-20 · 06 收口后的色板约束

- 本票后续重建（`reuseFrom`）必须使用 v4 的 `stylespec.json`（34 色，
  `.scratch/asset-integration-v1/runs/2026-10-20a-olive-palette/stylespec.json`），
  否则新帧会被量化回旧棕。
- 付费帧重生成仍须单独预算报告 + 逐字点头；本票不预授权。

### 2026-10-20 · 免费分析完成，待付费点头

- 13 帧逐帧看过：**6 帧语义明确不符** —— `hang1/2/3` 站立、`lunge4` 站立、`retreat2/3` 站立；
  其余 7 帧（`hang4`、`lunge1/2/3/5`、`retreat1/4`）语义可读、复用。
- 建议只重生成这 6 帧；`lunge1` 默认保留（落地/预备），要首帧腾空才 +1。
- 预算报告：[`runs/2026-10-20f-lurker/budget-report.md`](../runs/2026-10-20f-lurker/budget-report.md)。
  6 张成功图 ≈ **$0.20–0.23**；每帧最多 2 次尝试 ⇒ ≤12 发 HTTP；文本 0；墙钟 15 分钟。
- ⚠️ 配置风险：`game-maker.local.json` 当前是 `gemini-3.1-flash-lite-image` + proxy `9098`（本机未监听）；
  3.x 的 Interactions 只回 JPEG，而代码拒绝非 PNG。本次脚本拟**显式覆盖**为
  `gemini-2.5-flash-image` legacy + proxy `7890`（在监听），**不改配置文件**。
- 生成脚本已备好但**未运行**：`runs/2026-10-20f-lurker/generate-patch.mjs`（`RUN_APPROVED=1` 才发）。
- **0 发**生图 / 文本请求；等逐字批准后再发。


### 2026-10-20 · 付费结果与零付费收敛

- 人已逐字批准 **6 帧**（2.5 legacy PNG · proxy 7890 · 每帧最多 2 次尝试 · ≤12 发 · ≤$0.23）。
- 实际：**7 发 HTTP · 6 张成功图**（第 1 发回应前失败；hang1 用掉第 2 发）· 文本 0 · 母版生成 0；
  6 帧合计 102.6s；估算 **$0.20–0.23**。
- 付费结果：**`lunge4` / `retreat3` 采用**；`hang1/2/3` 与 `retreat2` 仍不是头朝下（被拒，
  保留在 `runs/2026-10-20f-lurker/evidence/paid/`）。
- **没有再发付费调用**。被拒的 4 帧改用**原 raw 整图 180° 旋转**（脚/爪在上、头在下，
  锚点 `{0.5,0}` 正好落在脚/悬挂点；原帧无地面线）—— 零付费。
- 重建 **`pack/v7`**：`verifyPack` ok · 19 资源 · **61 动画帧（4/5/4）** · 34 色 ·
  `imageCalls=0` · `ledgerCalls=0`。与 v6 对比只有 lurker 的 6 帧变化。
- 联系表：`evidence/v7-hang.png` / `v7-lunge.png` / `v7-retreat.png` 逐帧语义可读。
- 站点：v7 已重装配为 `2026-10-20e-site/out/.../site/v3`（三族 + 几何 + HUD 全过）。
- 若要求「每帧都带天花管道、且是全新绘制的悬挂帧」，那是另一轮付费决策；本票**不预授权**。

## Answer（2026-10-20 · 施工完成）

**验收达成**：三个动作在联系表上逐帧可读；`pack/v7` `verifyPack` ok；帧数 4/5/4 不变；
0 母版生成；付费与每帧尝试数在 `http-calls.log` / `generate-result.json` 落账。
逐帧判定、旋转理由与出处说明见
[`runs/2026-10-20f-lurker/lurker-report.md`](../runs/2026-10-20f-lurker/lurker-report.md)。
