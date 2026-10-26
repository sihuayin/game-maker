# 11. 意图提示词：伞状动词分解（探索/寻宝/冒险不单独立条）

Type: task
Status: resolved
Owner: main session · 2026-10-26
Blocked by: 10
Map: ../map.md

## Question

按票 10 裁定实施：改 `analyze-intent` 提示词，教模型「探索 / 寻宝 / 冒险」这类**伞状动词**不是一条机制，
应拆成它实际包含的那几条，不单独立 `explore` 条。修票 05 的 Stage A 卡点（`intent-mechanic-missing`）。

实施范围：

1. **提示词**（`packages/game-design/src/prompts.ts`）：
   - 「先分家」段（`intentPrompt` 的工具说明）加一条：伞状动词（探索/寻宝/冒险…）= 移动 + 寻找/收集 + 抵达，
     拆成那几条，不单独立条。判据口令：这条能不能**单独指向外壳的一条机制**？能才立条，不能就拆。
2. **配套测试**（`packages/game-design/tests/prompts.test.ts`）：加一条会红的测试，钉住提示词里写着
   「伞状动词 / 探索 / 分解」那句（与现有 prompt 测试同款：断特征字面，不断自己）。
3. **验证（免费离线，零付费）**：
   - 全仓 test + typecheck 绿。
   - E3（零付费）：把 `.failed-*` 现场里的 `intent.md` 喂给改后的 `intentPrompt`，肉眼/断言确认提示词含分解规则；
     再把现场 `game-intent.json` 里的 6 条机制对照新规则，确认 `mech-explore` 属于该被拆掉的那类。

边界：只动意图层（`analyze-intent` 提示词 + 其测试）；不动 `compile-design`/R12、不动 `vocabulary.ts` 的 MECHANICS；
零付费（不跑真调用验证模型是否听话，那归票 05 重跑）。

## 收口（2026-10-26 · 代码已落，零付费验证已过）

- `packages/game-design/src/prompts.ts`：`TOOL_DESCRIPTION` 的「先分家」段加「**伞状动词不是一条机制**」——
  探索/寻宝/冒险 = 移动+寻找/收集+抵达的合称，拆成那几条、不单独立 `explore`；
  并显式与第 1 条分界（二段跳是「一条」照样记、探索是「好几条的合称」才拆）。
- `packages/game-design/tests/prompts.test.ts`：+1 会红的测试，钉住「伞状动词不是一条机制 / 探索 / 拆成 / explore / 好几条的合称」。
- 全仓 1981/1981 · typecheck 绿。

**结论**：意图层封死「伞状动词被抽成独立机制」这个口子。模型是否真听话（不抽 `mech-explore`）只有真调用能证，
归票 05 的付费重跑。下一个动作 = 回票 05 重跑付费 E2E（需重新授权，撞 Q4 付费闸）。
