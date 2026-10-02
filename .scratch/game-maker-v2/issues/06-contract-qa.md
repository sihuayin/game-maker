# 06. `qa.ts` 的形状：判据会阻断，观察只报 —— 两种东西不许混成一个 `score`

Type: grilling
Status: resolved
Owner: amber
Blocked by: —
Map: ../map.md
> 依据 **R3**（Q3b/Q13）。`03 §9-12` 的那些 `similarity` 数值**一个都不进判据**。
> ⚠️ **2026-10-01（票 28）：本票造的是 V2 契约 —— 请用 `import { z } from "zod/v4"` 写**（不是 `from "zod"`）。
> 理由与代价见[票 28 的 Answer](28-structured-call-substrate.md)：`toolInputSchema` 只能转 v4 的 schema，而 v3/v4 的 schema **不许互相嵌套**。
> 另：**封口用 `z.strictObject`** —— 普通的 `z.object` 不产出 `additionalProperties: false`。

## Question

`01-contracts.md` §9-12 给的形状里，**有四处与 R3 直接冲突**，这一票就是改它们：

```ts
QAReport { status: "pass" | "fail"; visual?; gameplay?; intent?; failures[]; repairAttempts }
VisualQAResult { styleSimilarity; paletteSimilarity; silhouetteSimilarity;
                 compositionSimilarity; characterConsistency; materialConsistency;
                 animationConsistency }        // ← 七个数值
IntentQAResult { coverage: Record<string, boolean>; score: number; missingRequirements[] }
QAFailureCode = "STYLE_MISMATCH" | "COLOR_MISMATCH" | ... // ← 十二个码，多是数值越界的名字
```

### 1. 一个报告装两种东西，形状上怎么表达

R3 说判据**阻断**、观察**只报**。今天这两者在仓库里**已经分开住**：
`inspect`（观察，票 39 搬过去的）与 `verify`（判据，构建期红）。
要答：`QAReport` 是**一个**报告装两半，还是**两个**东西（判据一份、观察一份）？
⚠️ 如果装成一个，`status: "pass" | "fail"` 只能由**判据**决定，**观察不许影响它** ——
那 `score: number` 与七个 `similarity` 就**没有位置**了，要说清它们去哪（见 §3）。

### 2. 判据的那张表（R3 已给，要落成枚举）

| QA | 判据 |
|---|---|
| Visual | 色板绑定四值自洽（票 36）· 尺寸/锚点/九宫格三条构造性约束 · **层覆盖**（不平铺的层 ≥ 视口） |
| Gameplay | **引用族**（`hud.panel` 必须 `ui` · 砖的三条 · 资源解得到）· 冒烟 boot→spawn→goal |
| Intent | **集合差**：`GameIntentSpec` 里每个实体/机制在 `GameDesignSpec` 里有对应项 |

要答：`QAFailureCode` 的**十二个码**里，哪些**留**（并各自对应上表哪一条）、哪些**删**。
⚠️ `Camera` / `Silhouette` / `Material` / `Animation` / `Scale` 那几个码今天**没有判据撑着**
—— 留着它们就是留一个「谁来触发」都答不出的枚举值。

### 3. 观察项去哪

**已经有家**：`review.ts`（视觉差异，只说差异不说好坏）+ `inspect`（票 39 搬过去的用色观察）。
要答：`QAReport` 是**引用**它们，还是重算一份？⚠️ 重算 = 第二份真相。

### 4. `repairAttempts` 属于谁

它只有修复循环（票 21）用得上。要答：它进 `QAReport` 还是进 `run/v<N>/` 的另一份账。

## Answer

**`packages/contracts/src/qa.ts` 落地（v4 · `strictObject`）** —— 21 问全解，形状如下：

```ts
QAReport {
  format: "qa-report/v1";
  checked: QAJudgement[];        // 跑过哪几条
  failures: QAFailure[];         // 判据的全部结论。空 = 通过
  observations: Observation[];   // 只报，不阻断
}
```

### 一、三处「不给能被写错的位置」（Q1 / Q7 / Q13 / Q21）

- **`status` 不是字段**，是 `qaVerdict()` 派生的三值。理由是本仓库现成的规矩：**可派生的
  副本不进契约**（票 04 砍 `bodyProportions`、票 05 砍 `cameraModel`/`genre`）。R3 那条
  「观察不许影响通过与否」的底线，**唯一的落点是这个函数根本不看 `observations`**。
- **`JudgementResult` 只有二态**，`{ran:true,findings}` / `{ran:false,reason}` ——
  「成功/失败」是**读出来的**（`findings` 空不空）。⇒ 变异⑦（往里放一个 `ok`）**会红**。
  ⚠️ 本票第 1 轮把它叫成「三态槽」，那是**措辞错了**；Q21 把正确叫法钉进了契约。
- **六条判据的「漏跑」落在装配函数的入参类型上**（`Record<QAJudgement, JudgementResult>`）
  —— 缺一个键是**编译错误**；文件保持扁平，`checked` 由装配器**投影**出来，不手打。

### 二、十二个码 → 六条判据（Q2 / Q10 / Q18 / Q19）

**一个枚举两用**：`QA_JUDGEMENTS` 既当 `checked[]` 的取值、又当 `QAFailure.judgement`
的取值 ⇒「码的条数 = 判据的条数」**在类型上只有一份**。

| `QAJudgement` | 旧码 |
|---|---|
| `palette-binding` | `COLOR_MISMATCH` |
| `constructive-constraint` | `SCALE_MISMATCH`（**asset 侧那一半**） |
| `layer-coverage` | `TRANSPARENCY_ERROR` |
| `reference-resolution` | `GAMEPLAY_READABILITY_ERROR` ＋ `SCALE_MISMATCH`（**config 侧**）＋ `CHARACTER_DRIFT` 真正那条 |
| `reachability` | `GAMEPLAY_RUNTIME_ERROR` |
| `intent-coverage` | `INTENT_MISSING` |

**出局六个**：`STYLE_MISMATCH` · `SILHOUETTE_MISMATCH` · `MATERIAL_MISMATCH`（与 R3 正面
冲突）· `ANIMATION_ERROR`（「解得到」已在引用族）· `CHARACTER_DRIFT`（同上）·
`CAMERA_MISMATCH`（**R12 在设计编译那刻已拒绝**，留码等于把一次拒绝再说一遍）。

⚠️ **尺寸那条判据是劈开的**（Q2 的当场后果）：config 侧归引用族、asset 侧归构造性约束 ——
于是**每条判据恰好住一侧**，票 21 的映射每一行都指得到一个确切的落点。

### 三、失败与观察（Q6 / Q8 / Q9 / Q11 / Q12 / Q14 / Q16 / Q17）

- `QAFinding { target, detail, severity }`；落盘那层 `QAFailure = QAFinding & {judgement}`
  —— 内层**不带** `judgement`（**由键说**，让它写不出来）。
- **`target` 复用 `LedgerCall.target` 的词汇** ⇒ 失败与账能**对齐**（票 21 要的正是这个）。
  ⚠️ 明确**不用** `ConfigIssue.where` 那种人话：票 21 解析不了。
- `severity: "error" | "warning"` —— 把 `auditGameConfig`「精确的硬失败、上界的报警告」
  那一档搬过来。**只有 `error` 决定裁决**。类型允许、**今天一条都不报**（报不报是票 20 §3）。
- 同一 `(judgement, target)` **不许重复**（Q16(ii)）· `checked` 不许重复 ·
  **没跑过的判据产不出失败**。
- 观察：**两个来源各恰好一条**（忘了写进去 ≠ 比过了没差异）· `unavailable` **必须说为什么**。
- 删 `repairAttempts`（描述的是**循环**，落点归票 21）· 不要 `createdAt`（目录答了）。
- **`inspect` 那三行层覆盖改措辞**（Q12）：只报数、不判，明说判决在 QA 那边 ——
  ✅/⚠️ 的判据口吻去掉了，`pack.ts` 的硬失败**不动**。

### 四、⚠️ 三处**当场偏离**了轮次里的字面（都请复核）

1. **观察改成了按 `outcome` 判别的二态联合**，不是第 2 轮 Q9 那个扁平四字段。
   **为什么**：落盘前当场撞上自己的病 —— 扁平形状逼着 `unavailable` 带一个**无意义的
   `lines: []`**，而那正是 `ledger.ts` 明令禁止的「**不许填 0 冒充「测到了 0」**」。
   联合让那个字段**根本不存在**，且与 `JudgementResult` 同一条纪律。
2. **枚举值用 kebab-case**（`"palette-binding"`），不是第 3 轮 Q18(a) 里的 SCREAMING_SNAKE
   —— 那是**语气**的选择，而仓库同款的闭集（`CALL_FAILURES` · `LedgerStep`）都是 kebab。
3. **装配键直接用枚举值**（`results["palette-binding"]`），不另立一套 `paletteBinding` 驼峰名
   —— 那会多一处「两套名字必须一一对应」。

### 五、⚠️ 一处**信息在落盘时被丢掉**（请确认或否决）

`{ ran: false, reason }` 的 **`reason` 不落盘**：落盘的形式是「**不在 `checked` 里**」，
而**为什么**不在，**今天只可能是静态的**（链要么走到 QA、要么在到达之前就死了），
所以它写在契约 §四那段自白里，不逐次记。
⇒ **若票 18 把「可达性判不了」变成有理由要逐次记的事**，那要么加一个字段、要么把自白拆开。

### 六、判据

- **31 条新测试**（`packages/contracts/tests/qa.test.ts`）· 套件 **713/713**（此前 682）。
- `tsc -b` 干净 · `check:deps` 9 包绿 · `check:links` 144 份文档 704 条链接绿。
- **七发变异全部验过会红**：① 投影丢掉 `judgement`（6 红）② 去掉 `(judgement,target)` 去重
  ③ 去掉「每个来源恰好一条」④ 去掉「没跑过的判据产不出失败」⑤ `qaVerdict` 不看 `checked`
  （「没查」读成 `pass`——**一行假绿**）⑥ `qaVerdict` 把 warning 当阻断 ⑦ `JudgementResult`
  里放进 `ok`。⚠️ 第一版变异脚本有一次没匹配上就跑了，**重写成逐发确认「真的改了」再跑**
  （票 03 吃过同一个亏）。
- **R17 回填**：`01 §9-12` 整段重写（§9 删 `status`、§10 换成六条判据表、§11 换成观察、
  §12 换成失败形状 + 十二码去留表）；`§3 GameIntentSpec` 里两处指向旧 §11 的交叉引用就地更正
  （`§11`→`§10`），并补一句「集合差的已知噪声」；
  `02` 的 Phase 14 / Phase 15 按 R3 重写（那张十项单子不采用、`IntentQAResult` 不采用）。
- **下游票面就地更新**：`20` §1 已答（观察 = 原样引用；`warning` 的**类型**已允许、报不报仍是它的）、
  `21`（`repairAttempts` 的落点归它 · `target` 与账同词汇）、`19` §2（`IntentQAResult` 不采用，
  要答的变成 `target` 写什么）。

### 七、播下（不改本票的边界）

- **票 17/18/19 拿到了它们的形状**：三条判据函数各自的返回类型、`QAFinding` 的三个字段、
  「成功是空数组」。
- **票 20** 的汇合点：`buildQAReport` 已可用，装配只需接上；`warning` 报不报是它的事。
- **票 21**：`target` 与账同词汇 ⇒ 失败能对上账；`repairAttempts` 的落点归它。
- **票 22**：`Observation` 的 `unavailable + reason` 就是「原图没参与」要报成的样子。
- ⚠️ **票 18 §2 的「横版有没有纯层」现在是唯一能造出 `incomplete` 的东西** ——
  契约的自白里明写着它。
