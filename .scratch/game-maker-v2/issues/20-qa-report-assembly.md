# 20. `QAReport` 装配：判据的 `status` + 观察的清单，两者不许互相污染

Type: grilling
Status: open
Owner: —
Blocked by: 17, 18, 19
Map: ../map.md
> ⚠️ **包骨架已在[票 07](07-deps-allowlist.md) 里建好并接线**（`check-deps.mjs` 的 `ALLOWED` + 根 `tsconfig.json` 的 `references`）——
> 这一票**只写代码**，不要再建包、也不要再动那两处接线。
> 依据 **R3** + 票 06 定下的形状。这是三个 QA 的**汇合处**。
>
> ⚠️ **2026-10-02（[票 06](06-contract-qa.md) 已关）：§1 已经被答掉了，别再重新问。**
> `packages/contracts/src/qa.ts` 已经落地（v4），`buildQAReport(results, observations)` 是**纯函数**：
>   · **§1 的答案**：观察是**引用**，而且是**原样搬人家渲染好的那批话**
>     （`inspect` 的 `summary` / `reviewPack` 的 `observations`）—— `qa.ts` **不 import 它们**、
>     不扫像素、**不重新调用视觉模型**（`reviewPack` 要花钱）。⚠️ 搬 `summary` **不搬 `CommandResult.data`**
>     （那是同一份数据定型第二次）。
>   · **§2 的一半**：`QAFinding.target` 与账（`LedgerCall.target`）**同词汇** —— 票 21 要的归因已经就位。
>   · **§3**：`severity: "warning"` 这一档**类型允许**，且**只有 `error` 决定裁决**。
>     ⚠️ 但「**哪一条判据真去报警告**」仍然**完全是本票的事** —— 契约的自白里明写着「今天一条都不报」。
>   · **§4（退出码）**仍是本票的。
>   · ⚠️ 装配**不许**顺手去调 `reviewPack`：观察必须**上游算好传进来**。
>
> ⚠️ **2026-10-08（[票 18](18-qa-gameplay-judgements.md) 已关）：出口的形状变了，而本票多了一件非做不可的事。**
> ① **三个族的出口是 `QaFamilyResult`**（`contracts/qa.ts`）：
>    `{ judgements: Partial<QAJudgementResults>; observations }` —— 一个族**只声明自己那几条**，
>    **缺席 = 不归我**（票 18 的 R3-Q1：「该跑却跑不了」是**抛**，不是一条 `ran:false`）。
>    票 17 的 `visual.ts` 与票 18 的 `gameplay.ts` **都已经改成这个形状**（票 18 的 R2-Q4 α）；
>    票 19 的意图族照此办理。
>    ⚠️ 于是 **`QaRunner`（返回整份 `QAReport` 的那个）今天没有实现者** ——
>    「谁当那个合成器、它算不算一个 `QaRunner`」是**本票的第一件事**
>    （票 15 的 `createGame` 收的就是 `QaRunner`，形状别改，改的是谁来填它）。
> ② ⚠️ **一份「族结果」落盘会过不了 `qa-report/v1`**（票 18 实测：`safeParse` ⇒ `false`）。
>    `superRefine` ④ 要求**每个观察来源恰好一条**，而一个族**不产**别人的观察
>    （票 17 的裁定：**不许**拿 `unavailable` 表示「不归我」）⇒
>    **补齐那两条观察是合成器的活**。今天不炸，只因为 `pipeline` 用 `writeJson` 直接落盘、**不 parse**。
> ③ ⚠️ 票 17 有**两条断言**跟着出口搬了过来、现在**没有家**：「裁决是 `incomplete`」与
>    「`format` 是契约那份」—— 它们在**整份报告**上才算得出来 ⇒ 归本票重写。
> ④ 另：票 18 的 [R2-Q3](18-qa-gameplay-judgements.md) 把 `auditGameConfig` 那两条**旧的警告**
>    留在了原处、**没有**并进 QA 的判据 ⇒ 下面 §3 那一问（「哪一条判据真去报警告」）**仍然完全是本票的事**。
>
> ⚠️ **2026-10-09（[票 19](19-qa-intent-coverage.md) 已关）：第三个族到齐了，而你的一件事**收窄**了、另两件要说清。**
> ① ⚠️ **本票不要求「六条判据每条恰好被一个族声明一次」**（那句在数学上做不到）：
>    三个族加起来只声明 **5 条** —— 第六条 `layer-coverage`（层覆盖）由**装配期**的硬失败保证
>    （`pack.ts`），**不属于任何族**。⇒ 报告的 `checked` 恒为 **5/6**，`qaVerdict` 恒为 `incomplete`。
>    ⚠️ 那是**说真话**（有判据没由 QA 跑）—— **不要**为了让它变成 `pass` 去动 `checked`
>    （`contracts/src/qa.ts` 的四① 已按这一条改准）。本票要保证的是**不重复**（没有两条判据被同一个族
>    各声明一次），不是「全覆盖」。
> ② ⚠️ **`QaContext` 从 4 个字段变成 7 个**（票 19 的 Q4/Q11）：`runDir` · `packDir` · `configPath` ·
>    **`intentPath`** · **`designPath`** · **`recipePath`** · `gameId` ——
>    **每一份产物的路径由调用方给，QA 不自己拼文件名**（`RUN_ARTIFACT` 的家在 `pipeline`，
>    而 `packages/qa` 的白名单只有 `contracts`）。`pipeline/src/create-game.ts` 的调用点已经改过，
>    合成器拿到 ctx 要**原样往下传**（漏一个键是**编译错误**）。
> ③ ⚠️ **票 19 那条判据在链上恒绿**（`compile-design` 先拒 ⇒ 链根本走不到 QA），与票 18 的
>    `reference-resolution` 同一个形状 —— 本票**不要**顺手替它找一条「更早的路」。

## Question

票 17/18/19 各自产出一族判据与一族观察。这一票把它们**装成一份东西**，
且必须守住 R3 那条底线：**观察不许影响 `status`**。

### 1. 观察从哪来 —— 不许重算

**今天已经有家**（票 06 §3）：
- `packages/assets/src/review.ts` —— 视觉差异（「只说差异，不说好坏」，`review.ts:6`）；
- `inspect` 命令 —— 用色观察（票 39 把它从「判据候选」搬过来的）。

要答：`QAReport` 的观察那一半是**引用**这两处，还是第三次重算？
⚠️ 重算 = 第二份真相，而这两处的**措辞本身**就是裁决过的东西（`review.ts:6` 那句注释）。

### 2. 报告的**读者**是谁

要答：`qa-report.json` 是给**人**看的、给**agent**看的，还是给**下游程序**看的？
- 若是给人看：今天的 `inspect` 已经有一份人类渲染（`cli.ts` 的 `--json` 之外那半）。
- 若是给 agent（MCP）：`README_zh.md` 说 CLI 的 `--json`、人类输出、MCP 返回是**同一份数据**。
- ⚠️ 若给下游程序（例如票 21 的修复循环）：那 `failures[]` 必须带**足够的归因信息**
  （哪一个资产 / 哪一条判据 / 重跑哪一段）。

### 3. `pass` 的准确含义

R3 之后 `status: "pass"` 只能意味着：**所有判据都过了**。
要答：有没有**警告级**？—— `CONTEXT.md:378` 记着塔防那边的一条先例：
参考玩家赢不了时「**只报警告**」（因为它仍可能是「难而公平」的关卡）。
要答：横版这边有没有同款的「判据过了但有话要说」。

### 4. 退出码

`create` 跑到这一步判据失败 ⇒ 退出码是什么？今天的表是 `0/1/2/3/4`
（`cli.ts:29`）。要答：判据失败是 `4`（产物/清单不合法）还是另开一个。

## Answer

（待解）
