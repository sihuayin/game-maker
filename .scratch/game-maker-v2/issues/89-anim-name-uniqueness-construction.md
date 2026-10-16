# 89. 动画名唯一性落地：**创作侧 + 交付侧两条判据** · 散文六条→七条 · 两处注释 —— 票 79 裁定出的**施工票**

Type: task
Status: resolved
Owner: claude (2026-10-16 · **立票 → 同日施工 → 同日收口**（人裁三步：「立施工票」→「授权施工 89」→「关票 79 和 89」）；
见 `## 施工记录` 与 `## 收口`。⚠️ 本票是[票 79](79-duplicate-animation-names.md) 裁定出的施工票，那张同日关)
Blocked by: —
Map: ../map.md
> 派生自[票 79](79-duplicate-animation-names.md) 的
> **Q1 = (甲) 立 · Q2 = (c) 两处都补 · Q3 = (乙) 不加运行时判据、但记录结论 · Q4 = (甲) 逐字对齐 · Q5 = (甲) 添加**。
> 人裁（2026-10-16）五问逐字（裁定材料与探针在 [`clarifications/79-round-1.md`](../clarifications/79-round-1.md)
> 与 [`experiments/79-anim-name-dup/`](../experiments/79-anim-name-dup/README.md)）：
>
> | 题 | 裁定 | 结论（逐字） |
> | --- | --- | --- |
> | Q1 判据是否成立 | (甲) 立 | animations[].name 在同一个资源内必须两两不同。现有覆盖不足，import 路径的实测产物证明重复动画名可以通过 parseAssetPack。 |
> | Q2 判据落在哪层 | (c) 两处都补 | 创作侧 AssetSpecSchema.superRefine 负责花费前拦截；交付侧 AssetPackEntry.superRefine 负责拒绝不符合契约的产物。两处针对不同对象，不是重复写同一层的规则。不用升版。 |
> | Q3 是否修读者侧歧义 | (乙) 不加运行时判据，但记录结论 | 与 Q2 的 (c) 绑定。交付侧拒绝同名动画后，生产调用点不应再能遇到这种合法包；不添加一条预期永远不可达的运行时判据。需记录这一依赖关系及其成立前提。 |
> | Q4 报文和位置 | (甲) 逐字对齐 | 使用 动画名重复："idle"，与相邻的层名、帧名重复判据同形，放在同一段 superRefine 的相邻位置。机制解释写入注释，不塞进错误报文。 |
> | Q5 是否添加模型辅助散文 | (甲) 添加 | PLAN_TOOL_DESCRIPTION 清单由六条增至七条，沿用票 58 的句式，并明确声明该散文不是防线；实际拒绝仍由 schema 契约保证。 |
>
> ⚠️ **立票 ≠ 批准施工**（票 62 / 65 / 66 / 73 / 87 / 88 同款）—— 本票面**只写清楚要做什么、落在哪、
> 以及验收条件**；动手要**另行授权**（「授权施工 89」）。

## 0 · 一句话

票 79 量到：「一个资源里两条动画同名」今天**没有任何一条判据叫这个名字**；而票面原来那句
「后果会被另一条判据抓到」**只在 `drawlist` / `image` 上成立** —— `import` 那条进路上，
那份**真产物过了 `parseAssetPack`**（探针 ③）。本票就是把那两条判据补上，
外加**散文一条**与**注释两处**（其中一处是人裁 Q3 点名要的那句「依赖关系及其成立前提」）。

## 1 · 要做的（四条施工 + 两处注释）

### ① 创作侧：**花费前的那条**（人裁 Q1/Q2 的 (a)）

`packages/contracts/src/asset-spec.ts` · `AssetSpecSchema.superRefine`（`:162-189`）——
在**层名那条**（`:173-178`）的**隔壁**加一条，`path: ["animations"]`：

```ts
if (s.kind === "animation") {
  const seen = new Set<string>();
  for (const a of s.animations) {
    if (seen.has(a.name))
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `动画名重复："${a.name}"`, path: ["animations"] });
    seen.add(a.name);
  }
}
```

- ⚠️ **报文逐字 `动画名重复："<name>"`** —— 与 `层名重复："…"` · `帧名重复："…"` **同形**（人裁 Q4 逐字）。
- ⚠️ **必须在 union 层**：`.superRefine()` 会把成员变成 `ZodEffects`，而 `discriminatedUnion` 只接受
  `ZodObject` —— 同一条理由文件头 `:158-161` 逐字记着，层名那条就是这么落地的。
- ⚠️ 加在这里**零新增通路**：`recipe.ts:198` 直接引用 `AssetSpecSchema` ⇒ 配方闸**天然跟着收紧**，
  判据不重写第二遍；而在链上它落在 `ops.ts:303` 的 `parseRecipe` ⇒ 退 `schema`、走**现成的**重采样。

### ② 交付侧：**契约自我描述的那条**（人裁 Q2 的 (b)）

`packages/contracts/src/assetpack.ts` · `AssetPackEntry.superRefine`（`:194-234`）——
与**帧名**（`:195-199`）· **层名**（`:212-215`）两条**并排**加同形一条（`a.animations ?? []`，`path: ["animations"]`）。

- ⚠️ **它是探针 ③ 那条进路的唯一堵点**：`import` 策略的帧名是**配方自己写的**（`pack.ts:903`
  `src.sheet?.names`），**不由动画名派生** ⇒ 交付侧今天**没有任何一条**碰得到同名动画。
- ⚠️ **不动**那三条既有判据（帧名重复 · 层与帧一一对应 · 每帧必须属于某个动画）。

### ③ 散文：**六条 → 七条**（人裁 Q5）

`packages/assets/src/prompt.ts` · `PLAN_TOOL_DESCRIPTION`：
- `:695`「**六条**线形状表达不出来的规矩」→「**七条**」；
- 在**第 6 条**（`:718-720`，票 58 的**层名**那条）**之后**加第 7 条，**照第 6 条的句式**：
  现象 + 落点字段 + ⚠️ **逐字声明「这一条不是防线」**（拒绝一律由契约保证）。

### ④ 镜像清单：**⑤ → ⑥**（票 58 的同款收尾，别漏）

`packages/contracts/tests/recipe-tool.test.ts`：
- 明示例外清单加**⑥**（照 `:148` 那条 ⑤ 的体裁与注释）；
- `:171` 那句 `expect(text).not.toContain("层名")` 隔壁加 `not.toContain("动画名")`。

### ⑤ 注释 A —— **机制**（人裁 Q4 逐字：「机制解释写入注释，不塞进错误报文」）

写在那条新判据旁，内容是票 79 §2.1 量到的那件事：两条同名 ⇒ `pack.ts:930`
`frames.filter((f) => f.state === a.name)` **按状态名过滤** ⇒ **两条都变成同一条**（合体），
**不是「一条多余」**。

### ⑥ 注释 B —— **依赖关系及其成立前提**（人裁 Q3 逐字点名）

落在 `packages/contracts/src/assetpack.ts:377`（`resolvePackRef` 那处
`animations.find((a) => a.name === ref.anim)`），写清楚两半：

- **依赖**：这里 first-match-wins **是安全的**，因为交付侧那条动画名判据不收同名；
- ⚠️ **成立前提**（**必须写出来**，不能只写「这里安全」）：**每一个生产调用点都先过 `parseAssetPack`**。
  本轮量得出来、且可枚举：

  ```text
  packages/demo/src/world.ts:97    不过 ⇒ pack = null，resolvePackRef 根本不跑
  packages/qa/src/gameplay.ts:72   不过 ⇒ 直接抛
  packages/assets/src/ops.ts:817 / :1144 / :1568 / :1716   链上每一步各自 parse 一遍
  ```

- ⚠️ **只加注释，不加判据**（人裁 Q3 逐字：「不添加一条预期永远不可达的运行时判据」）。
  `:377` 的**行为一个字不改**。

## 2 · 测试（六条，各管一件事）

| # | 管什么 | 体裁先例 |
| --- | --- | --- |
| ① | 创作侧：两条同名 ⇒ `AssetSpecSchema` 拒，报文含「动画名重复」 | `contracts/tests/asset-spec.test.ts:118`（票 58 那条） |
| ② | 创作侧阴性对照：名字两两不同 ⇒ **照旧过** | 同上一条的阳性半边 |
| ③ | 交付侧：一份两条同名动画的 manifest ⇒ `parseAssetPack` 拒 | `contracts/tests/assetpack.test.ts:249` |
| ④ | ⭐ **真跑 packer**（`import` 策略）：两条同名 ⇒ `pack` 抛 · 退出码 4 · 正式版本目录**没出现** | `assets/tests/pack-selfcheck.test.ts`（**两层结构现成**：先证入口那道也拒，再故意绕过入口撞生产函数那道） |
| ⑤ | 散文：第 7 条在、且**逐字声明「不是防线」** | `assets/tests/prompt.test.ts:198-206`（票 58 那条） |
| ⑥ | 镜像：明示例外 ⑥ ＋ 顶层 7 键那句 `not.toContain("动画名")` | `contracts/tests/recipe-tool.test.ts:148` 与 `:171` |

⚠️ **阴性 / 变异**（施工时逐条做、**读数记进施工记录**，不是提交成测试）：
把创作侧那条抽掉 ⇒ ① 当场红；把交付侧那条抽掉 ⇒ ③ 与 ④ 当场红。
**否则它们恒真，不证任何东西**（先例：票 88 的验收 2 · 票 87 的 P5）。

## 3 · 不动的 / 边界

- **不动 R 表** · `packages/qa` **一行不碰** · `game-maker.local.json` **一个字不动** · **零付费真跑**。
- **不升版**（人裁 Q2 逐字）—— 依据是本轮量过的：盘上 85 份 manifest · **275** 个动画声明**零重复**（探针 ⑥）。
- ⚠️ **不收窄也不取消**：票 46 的交付侧自校验 · 票 58 的层名判据 · 票 61 的 `playerAnimationGate`
  （它 ② 逐字「多出来的路不管」）· `game-config.ts:312-330` 那条「**三格**互不相同」。
  ⇒ **声明**的唯一性（本票）与**引用**的唯一性（票 61）**互不顶替**。
- **不碰** `resolvePackRef` 的行为 · **不加运行时判据**（人裁 Q3 逐字）。
- **不碰** `framePlan`（`prompt.ts:148-155`）与 `pack.ts` 的命名 / 过滤逻辑 ——
  那两处只是**注释的素材**，不是要改的东西。
- **不改**票 79 的裁定与票面 · **不顺手处理**票 82 / 票 86。
- **不加重试 / 修复循环 / 自动重生成**（R13）。

## 4 · 施工完之后应当成立的（票 79 量过的那些数）

- 一份 `animations: [{name:"idle",frames:2},{name:"idle",frames:2}]` 的配方**在花钱之前**被拒
  （`parseRecipe` ⇒ 退 `schema` ⇒ 走现成的重采样，最多 3 发；图一张都没买）。
- 交付侧：这种 manifest **过不了** `parseAssetPack`。
- ⭐ 探针 ③ 那份**今天合法**的产物**变成非法** —— 「合法的包」与「读起来对的包」重新合一。
- 两条既有清单同步：散文**六条 → 七条** · 明示例外**五条 → 六条**。
- ⚠️ **不承诺任何模型行为的变化** —— 散文改了之后模型守不守新表述，属**票 23**
  （真跑 · 另出报告 + 逐次明确同意）。票 79 的免费读数到此为止。

## 5 · 验收（施工时逐条钉住）

1. **五闸**：`pnpm test` · `pnpm typecheck` · `pnpm build` · `pnpm check:deps` · `pnpm check:links`
   全绿，且**基线先量**。⚠️ 改契约**必须先 `pnpm build`**（consumers 读 built `dist`）。
2. **探针复跑**（一条命令、零付费）：`node .scratch/game-maker-v2/experiments/79-anim-name-dup/probe79.mjs`
   —— ① 从「过」翻成「拒」· ③ 从「过 `parseAssetPack`」翻成「**不过**」；
   ⚠️ 而 **⑥ 照旧是 0**（盘上零重复 ⇒ 一份现存产物都不该被判死）。
3. **阴性 / 变异**读数逐条记进施工记录（见 §2 末尾）。
4. **注释两处**（⑤ 机制 · ⑥ 依赖及其前提）**在盘上可查**，且 ⑥ **逐字写出前提**、附那四个调用点。

## 免费证不了的

模型会不会**真**写重复动画名 —— 那要一次真跑（**票 23**，另出报告 + 逐次明确同意）。
今天的答案是**未知**：盘上零复现，而**零复现不代表写不出来**（票 58 立案时也是零复现）。

---

## 施工记录（2026-10-16 · 人裁「授权施工 89」）

⚠️ **只施工**：**没提交** · **没关票** · **没跑真上游**（**零付费**）· **R 表没动** · `packages/qa` 一行没碰 ·
`game-maker.local.json` 一个字没动。**8 个文件 · +205 / −5 行**。

### 一 · 四件事 + 两处注释逐条落地

| 处 | 文件 | 改了什么 |
| --- | --- | --- |
| ① 创作侧判据 | `packages/contracts/src/asset-spec.ts` | `AssetSpecSchema.superRefine` 里、**层名那条（`:173-178`）的隔壁**加「动画名不许重复」（`if (s.kind === "animation")`）；报文逐字 `动画名重复："…"`、`path: ["animations"]`。文件头那句「哪几条住 union 层」的清单跟着加了一行 |
| ② 交付侧判据 | `packages/contracts/src/assetpack.ts` | `AssetPackEntry.superRefine` 里、**「动画引用的帧在不在」那个循环之后**加同形一条（`const animNames`，`:208-220`） |
| ③ 散文 | `packages/assets/src/prompt.ts` | `PLAN_TOOL_DESCRIPTION`：`六条线形状表达不出来的规矩` → **`七条…`**；第 6 条之后加**第 7 条**，照第 6 条句式，逐字声明「**这一条不是防线**…**只为少一次返工**」 |
| ④ 镜像清单 | `packages/contracts/tests/recipe-tool.test.ts` | 明示例外 **⑤ → ⑥**（新用例，注释照 ⑤ 的体裁）· 顶层 7 键那条加 `not.toContain("动画名")` · describe 头「这五条」→「这六条」 |
| ⑤ 注释 A（机制） | `packages/contracts/src/asset-spec.ts` | 新判据旁：帧名**由动画名派生**（`framePlan`）⇒ `drawlist`/`image` 上「帧名重复」本来也拒、而 `import`（帧名是配方自己写的）逃得掉；**后果不是「多一条」而是「两条合体」**（按状态名过滤）—— 逐字照人裁 Q4「解释写进注释、不塞进报文」 |
| ⑥ 注释 B（依赖） | `packages/contracts/src/assetpack.ts` | `resolvePackRef` 那处 `find`（`:377` → **`:405`**）上加一段：**依赖** = 交付侧那条判据不收同名；⚠️ **前提**逐字写出 = **每一个生产调用点都先过 `parseAssetPack`**，并附那四个落点（`demo/src/world.ts` · `qa/src/gameplay.ts` · `assets/src/ops.ts` 链上每一步）＋「前提一破正确做法是**报错**，不是加一条不可达判据」。**`:405` 的行为一个字没改** |

### 二 · 测试（六条）与**阴性 / 变异**读数

六条新用例（`+6` 条测试，与全量读数对得上）：

| # | 文件 | 用例 |
| --- | --- | --- |
| ① | `contracts/tests/asset-spec.test.ts` | 两条同名 ⇒ 拒、报文含「动画名重复」；**PLAYER（idle/walk/jump）照旧过** |
| ② | 同上一处 | （阳性半边并进 ①，照票 58 那条的体裁） |
| ③ | `contracts/tests/assetpack.test.ts` | 两条同名但**帧名两两不同**的 manifest ⇒ 拒、报文含「动画名重复」 |
| ④ | `assets/tests/pack-selfcheck.test.ts` | ⭐ **真跑 packer（`import` 策略）**：入口也拒 · 绕过入口 ⇒ 抛、**退 4**、`pack/` 不出现、失败现场那份 manifest 里**两条同名都还在**且**帧名确实是 4 个不同**（这条断言把本用例与分层背景那组**分开**） |
| ⑤ | `assets/tests/prompt.test.ts` | 第 7 条在、且逐字声明「不是防线」；⚠️ 顺带把票 58 那句 `六条` 断言改成 `七条`（不改它会当场红），并数「这一条不是防线」**出现两次** |
| ⑥ | `contracts/tests/recipe-tool.test.ts` | 明示例外 ⑥ ＋ 顶层 7 键那句 `not.toContain("动画名")` |

**阴性 / 变异**（逐条做、逐条记，**不是**提交成测试）：

| 变异 | 期望 | 实测 |
| --- | --- | --- |
| **M1** 抽掉**创作侧**那条（交付侧留着） | 创作侧那两条红、交付侧那条**照旧绿** | ✅ **3 红**：`asset-spec.test` 的票 89 用例 · `recipe-tool.test` ⑥ · `pack-selfcheck.test` 阳性（红在**入口那半句**）。⚠️ 而 `assetpack.test` 那条**照旧绿** |
| **M2** 抽掉**交付侧**那条（创作侧留着） | 交付侧那两条红、创作侧那两条**照旧绿** | ✅ **2 红**：`assetpack.test` 的票 89 用例 · `pack-selfcheck.test` 阳性。⚠️ 而 `asset-spec.test` 与 `recipe-tool.test` **照旧绿** |

⇒ ⭐ **两条判据各自都有「只有它能弄红」的测试** —— 人裁 Q2 那句「两处针对不同对象，**不是重复写同一层的规则**」
**在变异读数上成立**（若它们是同一件事，抽掉任一条都会把两边一起弄红）。

### 三 · 闸门（零付费）+ **基线**

- **基线先量**（`git stash push -- packages/` → 重建 → 全量）：**86 文件 / 1470 测试绿** · 随后恢复并重建。
- 施工后：`pnpm test` **86 文件 / 1476 测试全绿**（**+6**，与上表六条对得上）· `pnpm typecheck` 9 包干净 ·
  `pnpm build` 干净 · `pnpm check:deps` ✅ 9 包 · `pnpm check:links` ✅（293 份文档 · 1711 条链接）。
- ⚠️ **改契约先 `pnpm build`** 照做（consumers 读 built `dist`）。

### 四 · 探针复跑（验收第 2 条）—— 读数留在 `raw-output.after.txt`

| # | 施工前 | 施工后 |
| --- | --- | --- |
| ① | `parseRecipe` **两份配方都过** | ⭐ **两份都被拒**（`assets[0].spec.animations: 动画名重复："idle"`） |
| ③ | 真产物**过 `parseAssetPack`** | ⭐ **`buildAssetPack` 直接抛** —— 比「过不过契约」**更前一步** |
| ⑤ | drawlist：抛，**2 处** | 抛，**3 处**（多出来那处正是新那条 ⇒ 两条**各成一条**） |
| ⑥ | 零误杀 **0 份** | ⭐ **0 份**，与施工前**一模一样** |

⚠️ 脚本只补了一处 `try/catch`（③ 现在会抛），**其余一字未改** ⇒ 两份原始输出在 ③ 之前逐字相同；
`raw-output.txt`（施工前）**逐字保留**，它是本票立案的证据。

### 五 · 边界（照实记）

- ✅ **不升版**（人裁 Q2 逐字）：`asset-recipe/v1` 与 `assetpack/v4` 都没动；依据在施工后**复核过** ——
  探针 ⑥ 照旧 0 份现存产物会被拒（85 份 manifest · 275 个动画声明，零重复）。
- ✅ **票 46 的交付侧自校验**、**票 58 的层名判据**、**票 61 的 `playerAnimationGate`**、
  `game-config.ts` 那条「三格互不相同」：**一条都没收窄、也没取消**（`pack-selfcheck.test.ts`
  票 46 那两条用例照旧绿）。
- ✅ **`resolvePackRef` 的行为一个字没改**（人裁 Q3：只加注释、不加运行时判据）。
- ✅ **不碰** `framePlan` 与 `pack.ts` 的命名 / 过滤逻辑 · **不改**票 79 的裁定 · **不顺手处理**票 82 / 86 ·
  **不加重试 / 修复循环 / 自动重生成**（R13）。
- ⚠️ **免费证不了的照旧免费证不了**：模型会不会**真**写重复动画名 —— 属票 23（另出报告 + 逐次明确同意）。
- ⚠️ **提交与关票都没做** —— 它们和票 79 一样，要人另外说。

---

## 人核 · 裁定后的证据更新（2026-10-16 · **原话逐字**）

> ⚠️ 这一节是**人对四个读数的核对**（施工记录 §四 那张表的原话版），**未删改**。

| 验证点 | 施工前 | 施工后 | 结论 |
| --- | --- | --- | --- |
| ① parseRecipe | drawlist、import 均通过 | 两份均被拒绝 | 创作侧防线生效 |
| ③ parseAssetPack | import 产物通过契约 | buildAssetPack 直接抛错，未形成可交付包 | 交付侧防线生效，拒绝发生得更早 |
| ⑤ drawlist | 2 处错误 | 3 处错误 | 两条判据分别产生可观察的拒绝结果 |
| ⑥ 现存产物扫描 | 0 份误杀 | 0 份误杀 | 本轮基线未发现回归 |

⚠️ 本 session **逐条复核过**这四行与盘上原始输出一致（`experiments/79-anim-name-dup/` 的两份 `raw-output*.txt`）。
⚠️ **它不改变任何边界**：本票**仍未提交 · 仍未关票**（`Status` 停在 `claimed`），地图那一行索引也没落。

---

## 收口（2026-10-16 · 人裁逐字：「**关票 79 和 89**」）

⚠️ **三句分开的话**（本仓规矩：施工 → 判据 → 收口；票 78 / 84 / 85 / 87 / 88 同款）：
「**授权施工 89**」落了源码、六条测试与两处注释（见 `## 施工记录`）；「**关票 79 和 89**」= 本票
`Status` → `resolved` ＋ 本图落一行。

- `Status`：**`claimed` → `resolved`**。
- 本图 `## Decisions so far`：**加一行索引**（它 gist 的是结论，细节**住这一份票**）。
- ⚠️ **本票不阻塞任何票**（核过：没有一张写着 `Blocked by: 89`）。

### 关票时的状态（**收口前逐条回盘上重新实测过**）

| # | 票面验收 | 读数 |
| --- | --- | --- |
| 1 | 五闸 + **基线先量** | ✅ 基线（`git stash push -- packages/` → 重建 → 全量）**86 文件 / 1470 测试** → **1476 全绿** · `typecheck` **0 error** · `build` **0 error TS** · `check:deps` ✅ 9 包 · `check:links` ✅ 293 文档 / 1712 链接 |
| 2 | 探针复跑四个读数 | ✅ 复跑与 `raw-output.after.txt` **逐字相同**（只差 tmp 路径那一行）：① 拒 · ③ `buildAssetPack` 抛 · ⑤ 3 处 · **⑥ 照旧 0** |
| 3 | 阴性 / 变异读数记进施工记录 | ✅ 已记；**本轮重跑了两组**：M1 = **3 红**（同三条）· M2 = **2 红**（同两条）—— 读数可复现 |
| 4 | 两处注释盘上可查 · ⑥ 逐字写出前提 + 四个调用点 | ✅ 两处都在。⚠️ 见下「收口前查出的一处事实错误」 |

### ⚠️ 收口前查出并已改正的一处事实错误（照实记）

施工记录与票 79 里，那条「依赖**成立前提**」的四个调用点中，`qa/src/gameplay.ts` 我写的是 **`:74`** ——
**实际是 `:72`**（`:74` 是紧邻的 `parseGameConfig` 那一行）。**两处都已改正**（票 79 的 `## Answer` ·
本票 §1 ⑥）。另三个落点复核无误：`demo/src/world.ts:97` · `assets/src/ops.ts:817 / :1144 / :1568 / :1716`。
⚠️ 而 `packages/contracts/src/assetpack.ts` 里那段注释**本身只写文件名、不带行号** ⇒ 盘上的注释**不受这处错误影响**。

### 边界（照实记 —— 关票**不扩大**任何一条）

- ✅ **不升版**（人裁 Q2 逐字）· **不动 R 表**（R17：改 R 表要另开票）· `packages/qa` **一行没碰** ·
  `game-maker.local.json` **一个字没动** · **零付费真跑 · 零网络**。
- ✅ **不收窄也不取消**：票 46 的交付侧自校验 · 票 58 的层名判据 · 票 61 的 `playerAnimationGate` ·
  `game-config.ts` 那条「三格互不相同」。
- ✅ **`resolvePackRef` 的行为一个字没改**（人裁 Q3：只加注释、**不加运行时判据**）。
- ⚠️ **免费证不了的照旧没证**：模型会不会**真**写重复动画名 ⇒ 属[票 23](23-e2e-fixture-wasteland.md)，
  另出报告 + **逐次明确同意**。
