# 05. `RuntimeProfile` = 外壳能力的事实投影 —— 不是一份「声明」

Type: grilling
Status: resolved
Owner: amber
Blocked by: —
Map: ../map.md
> 依据 **R12**（Q14a）。`03 §11` 的「记录 `unsupportedRequirements`」**不采用**。
> ⚠️ **2026-10-01（票 28）：本票造的是 V2 契约 —— 请用 `import { z } from "zod/v4"` 写**（不是 `from "zod"`）。
> 理由与代价见[票 28 的 Answer](28-structured-call-substrate.md)：`toolInputSchema` 只能转 v4 的 schema，而 v3/v4 的 schema **不许互相嵌套**。
> 另：**封口用 `z.strictObject`** —— 普通的 `z.object` 不产出 `additionalProperties: false`。

## Question

`01-contracts.md` §8 给的 `RuntimeProfile`：

```ts
{ id, version, genre, capabilities[], inputModel, cameraModel,
  entityTypes[], mechanics[], winConditions[], loseConditions[] }
```

R12 定死了它的**性质**：**外壳能力的事实投影** —— 与 `shell.js` **同源同算**
（像 `anchor` / `layers` 与图集那份「同源同算，不构成第二份真相」，`CONTEXT.md:96-98`）——
构建期拿它**拒绝**不支持的 `GameDesignSpec`。

这一票要答**怎么做到「同源同算」**。

### 1. 事实的来源是什么

仓库里**已经有**最接近它的东西：`EntityKind` 与 `Motion` 两个**闭合枚举**，
`packages/contracts/src/game-config.ts:35` 的注释写着它就是「**「外壳实现了哪些行为」的清单**」。

- **(a) 从那些闭合枚举派生** —— `RuntimeProfile` 是它们的**投影产物**，一处改两处动，
  派生函数是**唯一实现**（学 `derivePackMode`，`CONTEXT.md:194-195`：写入侧与校验侧共用一份，
  「两边各写一份必然漂移」）。
- **(b) 手工声明 + 一条守卫测试**（拿 `RuntimeProfile` 与实际外壳的行为表对拍）。
- **(c) 让外壳**导出**它** —— `shell.js` 构建时产出一份 `runtime-profile.json`。

⚠️ (a) 与 (c) 的区别是**谁在什么时刻**算它。要选一个，并说清**漏了会怎样**
（症状是「声明说有、外壳没有」⇒ 构建期过、运行时坏 —— 而这正是 `CONTEXT.md:281-286` 明说不要的）。

### 2. 它与「外壳版本号 + `format` 判别式」既有机制的关系

今天加一种玩法的代价是「加一个场景 + 一个纯层 + 一行分派」（`CONTEXT.md:409-421`），
`site.json.config` + `format` 是**唯一**的分派处（`packages/demo/src/assemble.ts`）。
R4 定了 `RuntimeProfile` 要**成族**。要答：**族成员与 `format` 是一对一吗**？
`platformer/v1` 与 `game-config/v1` 是不是同一个坐标轴上的两个名字？

### 3. 第一阶段只列 `platformer/v1`

R4：只实现 `platformer/v1`。这一票**要产出**那份 profile 的实际内容：
`capabilities[]` 到底列哪些（`03 §20` 给了一张：movement · jump · collision · camera ·
pickup · hazard · goal · parallax）。**逐条对着外壳的实际实现过**，列不出实现的不许写。

> ⚠️ **2026-10-02（[票 03](03-contract-intent-and-design.md) 已关）：词表已经定了，别另立一份。**
> `packages/contracts/src/vocabulary.ts` 的 `MECHANICS` / `CAPABILITIES` 就是本契约
> `mechanics` / `capabilities` 的取值域（票 03 Q4(b)：三份契约的**公共依赖**，谁也不拥有它）。
> ⚠️ **两张表的来源是 `game-config/v1` 的四条构造**（`EntityKind` / `Motion` / `PlayerMove` / `Objective`），
> 不是许愿单 —— `RuntimeProfile` 是**外壳能力的事实投影**（R12）。
> 漏了某一项就**改 `vocabulary.ts`**，不要在 `runtime-profile.ts` 里开第二张表。
> 另：`GameDesignSpec.game.runtimeProfile` 现在是 **`{id, version}` 引用**（票 03 Q5）——
> 本契约的 `id` / `version` 要与它对得上，否则票 14 的拒绝说不出是哪一代的能力。

## Answer

**结论：`RuntimeProfile` 落地成契约（`packages/contracts/src/runtime-profile.ts`，v4）——
**四个字段**（`id` · `version` · `mechanics[]` · `capabilities[]`）+ 一张族注册表 + 一个解析函数，
并把它的「事实性」从注释升级成**可证伪的判据**。
判据全绿：**25 条新测试**（其中**七发变异验过会红**）· 套件 **682/682**（此前 657）·
`tsc -b` 干净 · `check:deps` / `check:links` 绿。**

### 0. 裁决表（三轮共 12 条）

| # | 裁决 | 落点 |
|---|---|---|
| Q1 | **「事实」的源只能是源码，不可能是一份 `shell.js`** —— 契约住 `contracts`，外壳**不 import** 它 | 文件头 §一 |
| Q2 | 词表是**名字的家**，profile 是**「这一代实现了其中哪些」的断言语** | 文件头 §二 |
| Q3 | profile 与 `format` **正交**；`version` **自己一根计数器**，不复用 `SHELL_VERSION` | 文件头 §三 |
| Q4 | §8 那十个字段**砍六个留四个**（`inputModel` / `entityTypes` / 两个 `Conditions` 零消费者） | 见下行 |
| Q5 | **不落盘** —— `01 §13` 九项里没有它，也不该有 | `01 §13` 加了一句说明 |
| Q6 | 两个数组**字面引用**词表（全集），并在契约里**自带那句自白** | 文件头 §二 + 判据 |
| Q7 | **`cameraModel` / `genre` 也砍**（**可派生的副本**，不是零消费者）⇒ **4 留 / 6 砍** | 文件头 §四 |
| Q8 | **身份冻结**：`id: "platformer"` · `version: "1"` · `platformer/v1` 是**拼出来的** · **不加** `format` 判别式 | `RuntimeProfileRefSchema` |
| Q9 | **建注册表 + 解析函数**（`resolveRuntimeProfile`），`undefined` **就是**拒绝的素材 | 同文件 |
| Q10 | 「外壳 import 它 ⇒ 漂移是编译错误」**量下来立不住**，改由**测试**保证 | 见 §3 |
| Q11 | 见证判据＝**读剥掉注释后的源码**里的**行为串**（不记行号） | `demo/tests/shell-capability-witness.test.ts` |
| Q12 | 「同源同算」落地成**同源 + 转录 + 见证判据**；**不**把 profile 钉到 `SHELL_VERSION` | 文件头 §一 |

### 1. 落地物

```text
packages/contracts/src/runtime-profile.ts        ← 新（v4 · strictObject）
packages/contracts/src/game-design.ts            ← runtimeProfile 改用共享的 RefSchema
packages/contracts/src/index.ts                  ← 一行导出
packages/contracts/tests/runtime-profile.test.ts ← 新（14 条）
packages/demo/tests/shell-capability-witness.test.ts ← 新（11 条）
packages/contracts/tests/{game-design,vocabulary}.test.ts ← fixture 去掉写死的 "v1"
packages/contracts/src/structured-call.ts        ← 文件头那段的「还不存在」已过期
docs/v2/01-contracts.md                          ← §8 重写（按 R17）· §13 加一句
docs/v2/03-claude-code.md                        ← §20 那张八项单子出局 · §28 目录树划掉它
docs/v2/02-implementation-plan.md                ← Phase 11 改为「已落地」· 两处目录树
docs/v2/00-overview.md                           ← 架构图补一句箭头澄清（票 01 对账表第 7 条）
CONTEXT.md                                       ← 补「RuntimeProfile（运行档）」（此前没有条目）
```

### 2. 判据（**七发变异验过会红**）

| 变异 | 结果 |
|---|---|
| 拿掉 `setScrollFactor(l.parallax)`（视差没了） | **2 条红** |
| `setScrollFactor(l.parallax)` → `setScrollFactor(1)` | **1 条红** |
| 全仓 `setScrollFactor(0)` → `(1)`（HUD 离开屏幕空间） | **1 条红** |
| 删掉 `createCursorKeys()`（键盘输入没了） | **1 条红** |
| 把 needle **藏进行尾块注释**（实现删了、注释留着） | **2 条红** ⚠️ 见 §3 第一条 |
| `PLATFORMER_V1` 瘦成真子集（拿掉 `jump`） | **1 条红** |
| 拿掉身份正则（`/` 又混得进来）· `version` 写成 `"v1"` | **1 条 / 3 条红** |

### 3. 落地时**量到的**（别重新量）

- ⚠️ **见证判据的第一版被一句行尾块注释骗过**：它读源码原文 + 只判**行首**注释，
  于是 `true /* this.collected < world.objective.pickupCount */` 这种「实现删了、注释留着」
  照样通过 —— **而那正是这条判据要抓的东西**。⇒ 改成**剥掉注释之后**再找 needle。
  **这条是本票最有价值的一发变异**：判据自己长什么样，不改一遍看不出来。
- ⚠️ **`shell/scene.ts` 第 7 行 `import Phaser`** ⇒ 在 node 的 vitest 里 **import 不动**。
  八条能力里**七条**住在 `scene.ts`（能 import 的只有 `draw.ts` / `world.ts`）——
  所以「逐条对着实现过」**只能**读源码文本。这直接砍掉了 Q1 里 (c) 的字面读法。
- ⚠️ **外壳对实体种类的穷尽性早就有了**：`scene.ts:140-161` 那个五分支 switch 对 `EntityKind`
  自动穷尽（v3 的 `z.infer` 就是判别联合）—— **不需要** import profile。
  而 `capabilities` / `mechanics` 是**不可分派的字符串**，import 进来也无处可 switch。
  ⇒ Q1 里承诺的「漂移是编译错误」这半个机制**不成立**，已当场收回（Q10）。
- ⚠️ **`out/*/site/*/shell.js` 至少有 14 个不同的 hash**：站点快照永不覆盖、而 `dist/shell.js`
  不进 git（`.gitignore:5`），所以**没有任何一份 `shell.js` 是事实源** ——
  「所有站点共用同一份字节」只在**同一版 bundle** 之内成立。
- ⚠️ **`03 §20` 那张八项单子既不全也不准**：八项都能对上外壳，但它**漏了外壳真做的
  `gravity` 与 `moving-platform`**（外加 `motion:cyclic` / `objective:collect-then-reach` /
  `hud:screen-space` / `coord:delivery-pixels`）。⇒ 它是一份**独立声明**，已出局。
  **完整对账**：`capabilities` 8/8 与 `mechanics` 8/8 **逐条都有实现**，一条不空。
- ⚠️ **`vocabulary.test.ts` 那条注释名不副实**：它写「`Record<EntityKind, …>` 是穷尽的，
  加一种 kind 这里当场编译不过」，而**实际标注是 `Record<string, string | null>`** ——
  编译期不拦，只有测试期拦。⇒ 本票新加的见证表**写成 `Record<Capability, …>`**（真穷尽），
  并在注释里点了这一处。**没改那张表**（它仍然拦得住，只是不靠编译器）——
  ⚠️ 若你希望把它一并改成真穷尽，说一声，那是一行的事。
- ⚠️ **`{ id: "platformer", version: "v1" }` 这个字面量散在两个测试文件、三处** ——
  身份一冻结就全成了噪音。三处已改成从契约取常量。

### 4. ⚠️ **一处由 Q8 的内部张力逼出来的决定，请你过目**

Q8 同时冻结了「`version: "1"`」与「渲染形式是 `platformer/v1`」—— 而 `{platformer, 1}`
纯拼接给的是 **`platformer/1`**，与 `01 §8` · `03 §11` · 地图 **R4** 全篇的 `platformer/v1` 对不上。
落地时被 `runtime-profile.test.ts` 当场逮到。两条收口：

- **①（已按此落地）** 渲染时补 `v` 前缀（semver 惯例：存 `1.2.3`、显示 `v1.2.3`）——
  **对外的名字一个字不动**，只在 `runtimeProfileRef` 里加一个字符。
- ② 正名为 `platformer/1` —— 要改 `01 §8` · `03 §11/§20` · 票 14/15/31，并且**重开 R4**
  （R17：改 R 表必须重新开票）。

选了 ①。若你要 ②，这一票当场重开。

### 5. 播下的种子

- **[票 10](10-design-compiler.md)**：Q7 砍掉 `cameraModel` / `genre` 之后，
  `compile-design` 要相机 / 题材的取值时**从 profile 的 `id` 与 `capabilities[]` 现取** ——
  别再往 profile 里补字段。
- **[票 14](14-runtime-compiler.md) §4**：它问的「两个成员而只有一个在新链，这个不对称怎么表达」
  **已被 Q3(b) + Q9 答掉** —— 正交 + 注册表；票面已就地更新，那一条不再是开放问题。
- **[票 15](15-pipeline-create-game.md) §1**：它草稿里那张目录树有 `runtime-profile.json`，
  而 `01 §13` 定稿的九项没有 —— **是有意的**（Q5），票面已加注。
