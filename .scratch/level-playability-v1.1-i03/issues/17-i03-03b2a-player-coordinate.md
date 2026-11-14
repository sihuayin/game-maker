# I03-03B2a 玩家脚点 / 锚点坐标约定裁定

Type: grilling
Status: open
Owner: —
Blocked by: —
Map: ../map.md
Class: I-03 / DECISION

## Question

`config.player.at` 到底表示**锚点落点**还是**脚点**？D2 自身两句话冲突（`08-i02-d2…:96` 用 `footOf`，`:97` 说 `at` 按脚点），`profile.ts` / demo 与 `temporal-witness.ts` 各按一边；last-train 的 anchor `.95` 使 player / graph 的几何行在零容差下无法冻结。

### 必须裁定

- 规范约定：`at` = 锚点（`footOf`） / `at` = 脚点（`boxFromFoot(at)`） / 新增显式 `playerFoot` / `playerBox`；
- player audit box 的派生公式与取整规则（D2 说不取整）；
- `temporal-witness` 的 spawn 是否改为 `footOf`；若改，需列出受影响的测试与真实关卡；
- runtime body 与 audit box 的零容差比较；若 Phaser 取整导致 delta，是否 STOP（推荐 STOP，不引入容差）；
- 是否需要在 I-03 实施单元中修正 `temporal-witness.ts`，以及该修正是否超出 `temporal*.ts` 白名单；
- 不修改 I-02 原文；只在 I-03 授权包里记录裁定与影响。

### 禁止

- 在本票自行选择归一化方式继续 B2；
- 修改产品代码 / fixture / Runtime / `profile.ts` / `graph.ts`；
- 开放公共能力 / 推送 / PR / 合并。

### 验收

规范约定、公式、取整规则、测试影响、实施边界、负向场景；B2 可据此继续。

## Answer

（resolved 时填写）
