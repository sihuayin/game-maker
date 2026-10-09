# 20. `QAReport` 装配：判据的 `status` + 观察的清单，两者不许互相污染

Type: grilling
Status: resolved
Owner: claude (2026-10-09)
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

**结论：三个族的**汇合处**落地了 —— `packages/qa/src/assemble.ts` 导出 `qaRunner`（**它就是** `QaRunner`），
`runBuild` **默认**接上它、在**报告落盘之后**按 `failures` 里的 `error` 阻断（退出码 **4**、站点不产），
两个壳把裁决与报告路径露出来。** 14 条裁决 · **+14 条测试** · 套件 **1133/1133**（此前 1119）·
`tsc -b` / `pnpm check`（deps · links · build）干净 · **5 发变异全部验过会红**（见 §6）。

⚠️ **一票没改契约**：`qa.ts` 的六个类型与两个纯函数**一个字都没动** —— 这一票做的是**填上那个空缺**
（`QaRunner` 从票 18 起没有实现者），而形状是契约早就定好的那一份。

### 0. 裁决表

| # | 问 | 裁决 | 落点 |
|---|---|---|---|
| 1 | 合成器的形状与落点 | 新文件 `assemble.ts`，导出 `qaRunner: QaRunner`；三族 `Promise.all` | `qa/src/assemble.ts`（新）· `qa/src/index.ts` |
| 2 | 5 条怎么变 6 条 | **显式逐个取**（六个键写在字面量里）+ 给 `layer-coverage` 补一条 `ran:false` | `assemble.ts` 的 `judgements` 表 |
| 3 | 「不重复」要不要运行时查 | **不查**：三族的键是写死的字面量，同名键与漏键都是**编译错误** —— 再写一条就是永远绿的判据 | `assemble.ts` 文件头一 |
| 4 | 族抛怎么办 | **不接**：`Promise.all` 让它冒出去、**不生成半截报告**；落盘在 runner 返回**之后** | `assemble.ts` §四 · `runBuild` |
| 5 | 观察那一栏今天填什么 | **两条都 `unavailable`**（合成器只装配、不采集），理由说清「**没拿到 ≠ 比过了、没差异**」 | `assemble.ts` 的 `NOT_COLLECTED` |
| 6 | `inspect` 的观察接进链 | 列入地图 **Not yet specified**（在范围内、还没人开；`review` 那条压在票 22 上） | 地图 |
| 7 | 谁来接上合成器 | **`runBuild` 默认用 `qaRunner`**（省略 = 默认；`null` = 关掉；给 runner = 用给的） | `pipeline/src/create-game.ts` |
| 8 | `null` 的语义 | ⚠️ **不许**写 `qa ?? qaRunner`（那条又短又顺的写法**恰好**把 `null` 也换成默认值）⇒ 单开 `qaRunnerOf()` 先认 `null` | 同上 |
| 9 | 闸看什么 | **只看 `failures` 里的 `severity: "error"`**，**不看 `qaVerdict`** —— 后者**恒 `incomplete`**，拿它当闸会让**每一次**运行都红 | `assertQaPassed()` |
| 10 | 阻断的顺序 | runner 返回 → **过 `QAReportSchema`** → **落盘** → 有 error ⇒ 抛 `CommandError("invalid")` → **站点不产** | `runBuild` |
| 11 | 退出码 | 沿用既有的 **4**（产物/清单不合法），**不新增公开值**（新增要同步 USAGE / README / MCP 的 `_exitCode`） | 同上 · USAGE |
| 12 | 报告落盘还是不留 | **先落盘、再抛** —— 与「坏配置**不落盘**」不冲突：坏配置是**输入**，报告是**诊断** | 同上 |
| 13 | 报告的读者 | 第一读者是**下游修复循环**；人 / agent 通过壳读：`data.qaVerdict` · `data.qaReport` · `artifacts[kind=qa-report]` · 摘要一行裁决 + 每条 finding 一行，**观察不打** | `cli.ts` · `mcp/server.ts` |
| 14 | 额外：警告级 | **QA 一条 warning 都不报**，而那是**对的、不是因为没人写**（见 §5） | `gameplay.ts` 注释 · 地图 |

### 1. 合成器：六条判据，而第 6 条的那句理由**不落盘**

```ts
const [visual, gameplay, intent] = await Promise.all([visualQaRunner(ctx), gameplayQaRunner(ctx), intentQaRunner(ctx)]);
const judgements: QAJudgementResults = {
  "constructive-constraint": declared(visual, "constructive-constraint"),
  "palette-binding":         declared(visual, "palette-binding"),
  "layer-coverage":          { ran: false, reason: "归装配期硬失败（pack.ts）—— 没有族声明它" },
  "reference-resolution":    declared(gameplay, "reference-resolution"),
  "reachability":            declared(gameplay, "reachability"),
  "intent-coverage":         declared(intent, "intent-coverage"),
};
return buildQAReport(judgements, NOT_COLLECTED);
```

三处值得记下来：

- **六个键写在字面量里**，目标类型 `QAJudgementResults` 要求六条都在 ⇒ **漏一条是编译错误**
  （与 `QA_JUDGEMENT_LABELS` 同一条纪律）。一个 `...spread` 加一个 cast 能写得更短，
  而那正是本仓库反复砍掉的那类「能被写错的位置」。
- `layer-coverage` 那句 `reason` **不落盘**：`buildQAReport` 只把 `ran: true` 的键投影进
  `checked` ⇒ **5/6 是结构给的，不是手打的**。测试里明写了一句
  「产物里不许出现『没有族声明它』」把它钉住。
- **缺席的那一格不需要任何特殊分支**：它不是「六条里的例外」，它就是**没有族声明它**
  的那一条 —— 换成别的一条，行为一样（`ran:false` ⇒ 不进 `checked`）。

### 2. 闸看的是 `failures`，不是 `qaVerdict`

⚠️ 这是本票**最容易写错的一行**：`checked` 恒 5/6 ⇒ `qaVerdict` **恒 `incomplete`** ⇒
`if (qaVerdict(report) !== "pass") throw` 会让**每一次成功运行都退 4**。

⇒ `assertQaPassed()` 只筛 `severity === "error"`，而 `incomplete` **不是失败**：
它说的是「**有一条没查**」，那是**实话**（层覆盖由装配期的硬失败保证）。
测试里两条钉子对着这件事：

- 干净的一次真运行 ⇒ `qaVerdict` 是 `incomplete` 而**构建成功**（正例）；
- 拾取物摆到跳不到的高处 ⇒ `reachability` 响 ⇒ 抛 `invalid`、**报告已经在磁盘上**（负例）。

**退出码 4 的理由**：`compile-runtime` 的业务校验失败走的就是 `CommandError("invalid")`，
而那一档在 USAGE 里写的正是「**产物/清单不合法**」—— QA 判据说的是同一件事的另一种说法。
新增一个 5 会让「脚本怎么读这个数」多一处要同步的地方，而**没有多出任何可行动的信息**
（「重抽能救」与「重抽救不了」的差别，文案里已经用一句话说死了）。

### 3. 观察那一栏：两条 `unavailable`，而那是**契约给的词**

票面的 §1（观察是引用、不许重算）票 06 早就答了；这一票要答的是**谁来采集、怎么递进来**。
量下来的事实把答案逼得很窄：

| 那个家 | 住哪 | 合成器够得着吗 |
|---|---|---|
| `reviewPack`（视觉差异） | `assets`，**要花一次视觉调用的钱**，且它今天比的是**联系表**（票 22 未落） | ✗ |
| `inspectPack` 的 `summary`（用色观察） | `assets`，本机免费，但要**解全部图集** | ✗（`qa` 的白名单只有 `contracts`） |

⇒ 合成器**只装配、不采集**，两条都写 `unavailable`，理由说清「这次链上没有跑它 ⇒
**没有可原样搬来的观察**，而**空不等于『比过了、没差异』**」。
契约明写「『没试』与『试了没成』的差别**钱已经答了**」⇒ 这个词是它给的，不是我们借的。

⚠️ **两条的理由里不写票号**：票号是**过程**的词，报告是**产物**的词（它跟着产物归档、被人读），
而「哪一天接上」不改变「今天为什么空着」这句话的真假。

### 4. 两个壳

- `createComplete` / `buildComplete`（CLI）与 `create_game`（MCP）都长出 `qaReportOf()`：
  `data.qaVerdict` · `data.qaReport` · `artifacts[]` 里一条 `kind: "qa-report"` ·
  摘要里**一行裁决 + 每条 finding 一行**（`failures[].detail` 本来就是人话）。
- 那一行把「跑了的那几条怎么样」与「哪几条没跑」**分开说**，否则 `incomplete` 会被读成「有问题」：
  `✅ QA：没有一条判据说不行 · 5/6 条由 QA 跑过（裁决 incomplete） —— 没跑的：层覆盖`
- ⚠️ **删掉了两处那句「⚠️ 没有跑 QA（这一版还没有 QA 实现 —— 票 17-20）」**—— 它**从票 17 起
  就是假话**（三个族都落地了），而壳里每一句关于「跑没跑」的话都必须是能信的那一句。
- ⚠️ 两个壳**各自写一遍**那段渲染（`demo` 与 `pipeline` 彼此看不见，没有一处能放共享的壳代码）——
  与 `readIntent` 同一条理由，两边注释互指「**改的时候两处一起改**」。**唯一共用的那份**是
  `qaVerdict()`（契约里那一处；`ledger.ts` 尾注的纪律：别在别处再算一遍）。

### 5. 警告级：**QA 一条都不报**，而那是**对的**

R3 之后 `status: "pass"` 只能意味着「所有判据都过了」，而 `QA_SEVERITIES` 里那个
`"warning"` 是**类型允许、今天无人使用**。查了一遍，这不是「没人写」，是**三条理由各自成立**：

1. **横版这边确实有同款的「判据过了但有话要说」** —— `auditGameConfig` 里那两条
   （台阶高过跳跃顶点 · 周期运动越界），形状与塔防「参考玩家赢不了只报警告」一字不差。
   ⚠️ **而它们已经有家**：`compile-runtime` 与 `site` **都会打出来**。QA 再登记一遍
   = 同一个事实说第二次（票 14 的 Q5 裁过同款），而且两条的措辞会开始漂移。
2. `gameplay.ts` 的 `merged()` 有一个 `warning` 分支，而它**今天是死代码**：
   `auditReferences` / `auditReachability` 两条审计**只产 `error`**（全文只有一处
   `severity: "error"`）。⇒ 那个分支**不是**「qA 报了警告」的证据。
3. 为了让那个分支「有用」而去造一条新判据，就是**为了用上一个形状而发明一个需求** ——
   而 R3 的门槛（「**错了一定不是设计**」）逐条筛下来，够不上的那些**本来就叫观察**。

⇒ 契约里那句「`severity: "warning"` 今天一条都不报」**仍然是真的**，而它现在有了**理由**，
不再只是「还没人写」。

### 6. 测试与验证

- **`packages/qa/tests/assemble.test.ts`（8 条，新）** —— 三份真 fixture 拼出一个五样齐全的现场：
  `format` 是契约那份 + **整份报告过 `QAReportSchema`**（票 17 那两条**跟着出口搬走、没有家**的
  断言在这里**重写**）；`checked` 恰好那五条、`layer-coverage` 不在里面、裁决是 `incomplete`；
  补进去的那句理由**不落盘**；两条观察各一条且都是 `unavailable`；
  ⚠️ **R3 那条底线的两枚钉子**：观察换成「拿到了、有话说」的内容 ⇒ 裁决**一个字不变**；
  判据真响了（改坏一个引用 ⇒ `reference-resolution` 报 error ⇒ 裁决 `fail`）时，
  观察那一栏与干净那次**逐字节相同**；族读不到产物 / 产物不过契约 ⇒ **抛**。
- **`packages/pipeline/tests/create-game.test.ts`** —— 「不给 ⇒ **跑默认的合成器**」（并钉住
  `incomplete` **不阻断**）·「`qa: null` ⇒ 缺席」·「一份过不了契约的报告当场拒」·
  **真链上响一次**（拾取物摆到跳不到的高处 ⇒ 抛 `invalid`、报告已在磁盘上）·
  文案里有报告路径与 `[reachability]` 且**没有**「再抽一次」那类话 ·
  进度条在 `qa: null` 时**根本不报那一步**。
- **`packages/cli/tests/cli-create.test.ts`** —— 壳那一侧：`qaVerdict` / `qaReport` /
  `artifacts` / 那一行摘要可读；硬失败 ⇒ 退出码 **4**、`site/` **不存在**、报告**在**、
  而 `--json` 的 `error` 里带着报告路径与失败详情。
- ⚠️ **MCP 那条路没有测**（诚实记一笔）：MCP server 没有给测试用的 `fetchImpl` 注入口，
  而 `create_game` 要一条活的上游 —— 那一侧的渲染**与 CLI 逐句同源**（同一段注释互相指着），
  但只有 CLI 那一份被测试盯着。要补得先给 MCP 开一个 `CliDeps` 那样的口子，那是**另一件事**。
- **5 发变异，全部验过会红**：

| 变异 | 被谁杀死 |
|---|---|
| M1 把 `layer-coverage` 谎报成 `ran: true`（`checked` 变 6/6） | `assemble.test.ts`（3 条） |
| M2 闸形同虚设（`assertQaPassed` 永 `return`） | `create-game.test.ts` + `cli-create.test.ts`（2 条） |
| M3 两条观察的来源写反 | `assemble.test.ts`（2 条） |
| M4 `null` 关不掉 QA（写成 `q ?? qaRunner`） | `create-game.test.ts`（2 条） |
| M5 壳上不给报告路径 | `cli-create.test.ts`（1 条） |

- **那次真运行**：默认 QA 跑在既有的假上游夹具上 ⇒ **五条判据全跑、零 findings、裁决 `incomplete`**
  —— 也就是说，**默认开不会让既有链变红**（这是「默认跑」这个裁决唯一的风险，实测排除了）。

### 7. 这一票**没有**做的事（边界）

- **不动契约**：`QAReport` / `QaFamilyResult` / `QaRunner` / `QaContext` / `qaVerdict` 一个字没改。
- **不动三个族**：`visual.ts` / `gameplay.ts` / `intent.ts` 一行没改（只动了 `index.ts` 的再导出）。
- **不采集观察**：`inspect` 接进链是**在范围内**的下一步，进地图的雾；`review` 压在票 22 上。
- **不给 `inspect` 找一条「更早的路」**，也**不替票 19 那条恒绿的判据**找早路（票 19 的交接单第 ③ 条）。
- **不改 `compile-runtime` / `site` 的警告**：它们已经有家，QA 不重复登记。
- **`layer-coverage` 不许被删、被伪报、或在装配器里重跑一遍**：它在六条**全集**里，
  只是**不归 QA 跑** —— 报告用 `checked` 的差集说这件事，而不是假装它跑过。
