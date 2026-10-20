# 02 · 潜伏者 hang / lunge / retreat 语义修复 —— 施工报告（2026-10-20）

> 付费闸：人已逐字批准「6 帧 · gemini-2.5-flash-image legacy PNG · proxy 7890 · 每帧最多 2 次尝试 ·
> ≤12 发 · ≤$0.23」。本报告记录实际花费与结果；**没有再发任何未批准的调用**。

## 结果一句话

6 张付费新帧里 **2 张采用**（`lunge4` / `retreat3`），4 张被拒（`hang1/2/3` / `retreat2`）；
被拒的 4 帧用**原 raw 整图 180° 旋转**（零付费）补足。重建 **pack/v7**：
`verifyPack` ok · 61 动画帧（4/5/4）· 34 色 · **0 上游 / 0 ledger**。三个动作在联系表上语义可读。

## 付费跑账

| 项 | 值 |
| --- | --- |
| 授权 | 6 帧 · 2.5 legacy PNG · proxy 7890 · 每帧最多 2 次尝试 |
| 实际 HTTP | **7 发**（第 1 发在回应前失败；hang1 用掉第 2 发） |
| 成功图 | **6 张**（hang1/2/3、lunge4、retreat2、retreat3） |
| 文本 / 母版生成 | **0 / 0** |
| 生成墙钟 | 6 帧合计 **102.6 s**（单帧 16–19 s） |
| 计费估算 | 6 × $0.0336–0.039 ≈ **$0.20–0.23**（失败那一发没有图，按不计费处理） |

证据：`http-calls.log`（逐发 URL / 状态）、`generate-result.json`（每帧 ms / attempts / model）。
⚠️ **没有隐藏重试**：生成器 `attempts=2` 已写进预算；第 1 发失败后重试 1 次，之后正常。

### 逐帧判定

| 帧 | 付费结果 | 采用？ | 最终来源 |
| --- | --- | --- | --- |
| `hang1` | 有管道，但头不在最低点、姿态含混 | ❌ | **原 raw 180° 旋转** |
| `hang2` | 头朝上、身体下垂（直立悬挂） | ❌ | **原 raw 180° 旋转** |
| `hang3` | 头朝上、身体下垂 | ❌ | **原 raw 180° 旋转** |
| `lunge4` | 腾空前扑、身体前倾、四肢伸展 | ✅ | 付费新帧 |
| `retreat2` | 头朝上、直立悬挂 | ❌ | **原 raw 180° 旋转** |
| `retreat3` | 头朝下、倒挂 | ✅ | 付费新帧 |

被拒的 4 张付费帧保留在 `evidence/paid/`（不删）；原始证据见 `new-*.png` 与 `after-*.png`。

## 为什么敢用 180° 旋转（零付费）

- 原始 `hang1/2/3`、`retreat2` 是**直立**姿态；整图旋转 180° 后：
  **脚/爪在画面上方、头在下方** —— 正是 hang / retreat 要的「头朝下倒挂」。
- 资源锚点是 `{x:0.5, y:0}`（顶边中心）⇒ 旋转后的顶边正好是脚/悬挂点，落位语义对。
- 票 03 的 30 张地面线命中里**没有** `ceiling-lurker` ⇒ 旋转不会把地面线带进来。
- 画面里没有管道（原 raw 没有），但角色由顶边锚点挂在通风口下，游戏里读作悬挂；
  这是本票用零成本换语义可读的取舍。若要求「每帧都有管道」，那是另一轮付费 / 另一张票。

## 施工

- patch：`patch/` = `2026-10-19k-patch` 全量副本 + 6 张付费帧（其中 4 张被旋转覆盖）+ 旋转说明
  `rotation-notes.txt`；其余 60 张 raw 与 3 张 drawlist 原样复用。
- 色板：v4 的 **34 色** `stylespec.json`（否则橄榄外套会退回棕色）。
- 重建脚本：`run-rebuild.mjs`（`reuseFrom: patch`，两个上游桩都抛）→ `ruin-scavenger-extraction-assets/pack/v7`。
- `verifyPack` **ok**（0 problems）· 19 资源 · **61 动画帧**（总 76）· 34 色 · `imageCalls=0` · `ledgerCalls=0`。
- ⚠️ `patch/`（84MB：`2026-10-19k-patch` 的全量副本）**不随本次提交入库**；最终 raw 在
  `pack/v7/authoring/generated/`，6 张修改帧的来源见 `rotation-notes.txt` 与 `evidence/paid/`。
- 与 v6 对比：**6 帧变化、55 帧逐字节相同**（正好是 lurker 的 6 帧）。

## 语义证据

- `evidence/v7-hang.png` —— 4 帧全部头朝下（hang1/2/3 旋转 + hang4 原倒挂）。
- `evidence/v7-lunge.png` —— 5 帧全部前扑（lunge4 是新付费帧）。
- `evidence/v7-retreat.png` —— 4 帧全部头朝下（retreat2 旋转 + retreat3 付费新帧 + retreat1/4 原倒挂）。
- `evidence/contact-sheet-v7.png` —— 整包联系表。
- `evidence/site-v7.png` —— 用 v7 重装配的站点 `site/v3`（校验全过）。

## ⚠️ 出处说明（别把小账本读成完整真相）

- 包内 `authoring/generated/*.prompt.txt` 对**复用 / 旋转**的帧写的是「基础逐帧提示词」，不是它们真正的来源；
  这是 `reuseFrom` 的既有行为。**真正的事实**在 run 目录：
  `http-calls.log`、`generate-result.json`、`rotation-notes.txt`、`evidence/paid/`。
- 付费帧的实际提示词在 `patch/authoring/generated/{lunge4,retreat3}.prompt.txt`（基础提示词 + 逐帧语义句）。

## 边界

- 未改母版 / 网格判据 / 其他资源；未重跑其他资产的帧。
- 未再发任何未批准的付费调用；无文本上游。
- v7 取代 v6 成为当前集成包；站点 `site/v3` 已用 v7 重装配（零上游）。
