# 票 10 抢救出包：66 张原图零付费复用 —— 成功报告

- **状态**：**包已产出、`verifyPack` 通过、0 次上游调用**。
- **依据**：[票 18](issues/18-frames-salvage-vs-regen.md) 的 A 裁定；[逐帧失败报告](report-10-real-frames-failure-2026-10-19.md)。
- **包**：`runs/2026-10-19j-salvage/ruin-scavenger-extraction-assets/pack/v1/`
- **结果**：`verifyPack` **ok** · `problems` 空 · provenance `mixed` · **imageCalls 0 / ledgerCalls 0**。

## 0 · 一句话

用逐帧失败现场的 **66 张原图 + 3 个 drawlist** 零付费重建了整包：
**19 个资源 · 61 帧动画 · 2 sprite + 7 import · 3 层背景 · 3 UI**；
`office-debris` 用 `minLargestShare: 0.5` 通过了「桌子 + 椅子 + 弹簧」的多部件判据。

## 1 · 交付内容

| 资源 | 帧数 / 形态 |
| --- | --- |
| scavenger-actor | 16（idle 4 · run 8 · jump 4） |
| wasteland-enemy | 15（patrol 6 · charge 6 · halt 3） |
| ceiling-lurker | 13（hang 4 · lunge 5 · retreat 4） |
| extraction-point | 9（standby 3 · active 6） |
| scrap-resource / clean-water | 各 4 |
| 2 sprite（hazard / office-debris） + 7 import | 各 1 |
| ruined-city-backdrop | 3 层 |
| 3 UI（hud-panel / scrap-icon / health-icon） | drawlist |

图集：animations **256×760** · backgrounds **640×1080** · sprites **96×488** · ui **48×64**。

## 2 · 复用 / 施工

- `BuildPackOptions.reuseFrom`（票 18）：现场 `authoring/generated/*` 与 `authoring/drawlist/*`
  存在就直接读，**缺文件即抛**，不偷偷重发；复用项**不计入 ledger / imageCalls**。
- `ImageSource.minLargestShare`（票 18）：只给 `office-debris` 设 **0.5**；其余单帧仍用 0.6。
- 3 张母版 import（0 母版调用）；7 张 import 原样；3 个 drawlist 复用。
- 全量测试 **104 文件 / 1633 条**；`pnpm build` / `check:deps` / `check:links` 通过；
  `typecheck` 仅两条既有、无关的红。

## 3 · 内容验收（人工看包）

- **玩家 / 敌人**：帧间一致性很好；跑 / 跳 / 巡逻 / 冲锋姿势连贯。
- **废料 / 净水**：物件正确（废料卷、玻璃瓶），不再画成人。
- **终端**：大部分正确；**standby3 仍是一个人**（模型偶发内容错）。
- **潜伏者**：形象一致，但 **hang / lunge / retreat 的倒挂 / 站立语义混用**。
- **小瑕疵**：多张图脚下有地面线 / 细虚线；32 色把外套的绿映射成棕。
- **office-debris**：桌子 + 椅子 + 弹簧卷完整交付（多部件，判据 0.5 合理）。

## 4 · 下一步

- **A · 接受此包**：结构 / 帧数 / `verifyPack` / 风格都已满足；内容瑕疵记录在案。
- **B · 定向修复**：
  - `standby3`：1 发（≈$0.039）；用 `reuseFrom` 的 patch 目录只替换这一帧，其余 65 张 + 3 drawlist 复用。
  - 潜伏者：按需 ≤13 发；可只修语义不符的帧。
  - 地面线：可做零付费的底部清理（源码改动），再复用重建。
- 任何重建都写到**新目录**（现有 `v1` 不覆盖）。

## 5 · 需要你裁

逐字一句即可：

> **收下这个包，关票 10**

或

> **修 standby3：1 发 / ≤4 发 / 15 分钟，修完复用重建**

或

> **先修潜伏者语义，按帧数另出预算报告**
