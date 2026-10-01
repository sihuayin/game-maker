# 05. `RuntimeProfile` = 外壳能力的事实投影 —— 不是一份「声明」

Type: grilling
Status: open
Owner: —
Blocked by: —
Map: ../map.md
> 依据 **R12**（Q14a）。`03 §11` 的「记录 `unsupportedRequirements`」**不采用**。

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

## Answer

（待解）
