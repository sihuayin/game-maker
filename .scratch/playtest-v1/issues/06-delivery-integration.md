# 06. 交付接入（取代 playable-smoke）

Type: grilling
Status: open
Map: ../map.md
Blocked by: 04

## Question

裁定新 harness 的试玩报告怎么接入现有 QA / delivery（范围内第 5 条；方向已定：取代 smoke、交付契约只加性扩展、
不破坏 `playable-smoke` 键）。至少定：

1. **取代 vs 兼容**：`playable-smoke.mjs` / `mapPlayableSmoke` 的退役时序 —— 新 harness 上线后，交付报告里那个
   `playable-smoke` 键是**继续叫这名**（消费者换成新产物、旧报告仍解析）还是**新增 `playtest` 键**（旧 `playable-smoke`
   退役）？`result.json` 形状变了，`mapPlayableSmoke` 怎么演进（加性扩字段 / 换新映射函数）？
2. **交付契约加性扩展**：`qa-report/v1` 的 `delivery` 要加什么字段（试玩场景列表 / 五态归因 / 事件观测引用 /
   回归基线引用）？沿用 fpvs-v1-p1「可选子对象 + 固定注册表 + 不升版」的加性纪律吗？
3. **命令与入口**：`pnpm test:playable` 变成 `pnpm test:playtest` 还是保留旧命令做别名？新 harness 的 CLI/入口
   长什么样（是否复刻 smoke 的 `--negative` / `--scenario` 开关）？
4. **消费者重算**：五态归因（票 04）如何进 `deriveDeliveryVerdict` —— `playable-smoke` 检查项的状态/归因怎么算、
   最终 verdict 重算对不对。
5. **零付费验收**：本图最后如何像 fpvs-v1-p1 的 `acceptance.mjs` 那样，用现有真实产物做一次零付费端到端报告验收。

> **与票 04 的接口（2026-10-27 补）**：票 04 已定——五态 → 交付状态映射（`SUCCESS→pass` / `GAMEPLAY_FAILURE→fail` /
> `ENVIRONMENT_FAILURE·not-executed→blocked` / `TIMEOUT·AGENT_LIMITATION·UNKNOWN→incomplete`）、多场景聚合
> （执行结果按总序、执行资格单独判：必需场景未执行不得 pass，确定性 fail 不降级）、`mapPlaytest` 纯映射 +
> `buildDeliveryReport` 重算、写前一致性不变量、证据一律可追溯本次执行的 E3、`UNKNOWN` 结构化缺口记录。
> 本票只裁定**键名（`playable-smoke` 保留 vs 新增 `playtest`）、schema 条件校验、命令改名、兼容迁移与真实产物验收**，
> 不重开归因语义。

HITL：用户逐字裁定。
