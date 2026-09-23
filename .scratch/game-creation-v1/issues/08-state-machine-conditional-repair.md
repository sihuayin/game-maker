# 08. 修状态机缺陷：repair 跳过 generate，并记 ADR

Type: task
Status: open
Blocked by: —
Map: ../map.md

## Question

**现状缺陷**：`demo/src/runtime/state-machine.ts` 只允许 `repairing → building`。
但 `RepairPlan` 可以包含 `type: "asset"` 的 action（`ASSET_REGENERATION` /
`STYLE_REGENERATION`），这类 action **必须**重新走 `generate` 阶段才会被执行。

后果：asset repair action 永远不会真正生效。这正是
`demo/src/repair/repair-engine.ts` 的 `execute()` 是个空函数、
注释写着「real adapters should patch/version artifacts here」
却仍然能「跑通」的原因 —— 因为资源从来没被要求重新生成过。

Q12 已决定修法：**条件迁移**
- `repairing → generating`：当 plan 含 asset / scene / ui action
- `repairing → building`：当 plan 只含 code / runtime action

需要落地：

1. `state-machine.ts` 的 `transitions` 表加入 `repairing: ["generating","building","failed","cancelled"]`
2. `assertTransition` 保持原样（它只校验边是否存在）；
   **条件判断放在 `orchestrator.ts` 的 `repair()` 里** —— 
   读 `plan.actions` 的 type 集合决定下一个状态。
   还是说条件应该内建到状态机里（`canTransition(from, to, context)`）？
   **这个归属要定**：状态机该不该知道 RepairPlan 的形状？
3. `orchestrator.ts` 的 `generate()` 目前是
   `this.assets = await this.ports.assets.generate(this.manifest, this.style)` —— 
   全量重新生成。repair 后应该只重新生成**脏的那些**资源。
   `AssetGenerator.generate()` 的签名（`ports.ts`）够不够表达「只重生成这几个」？
   要不要加参数？**加参数就是改契约**，需要慎重。
4. `generate()` 里的 `this.transition(run, "generating")` 在
   `compiled → generating` 假设下写的；从 `repairing` 进来时
   `run.iteration` 已经被 `decide()` 递增过了，要确认没有重复递增或漏递增。
5. **同步更新 `docs/文档.md` 第 8 节的状态迁移表**（加 `repairing → generating`）
   和第 7 节的生命周期图。
6. **写 ADR**（`docs/adr/0001-conditional-repair-transition.md`）。
   三条判据全部满足：
   - **难以回退**：改的是 `CreationStatus` 状态机拓扑，所有 checkpoint 和
     已落盘的 run 状态都依赖它
   - **无上下文会让人困惑**：未来读者看文档第 8 节会说「为什么 repair 会回到 generate？
     这不是应该直接 rebuild 吗」
   - **有真实权衡**：候选方案 A（条件迁移）/ B（build 内部按需 regenerate）/
     C（新增 `regenerating` 状态）各有代价，选了 A 是因为 B 违反单一职责且不可观察
     （违反文档第 58 节「每个阶段都必须可观察」），C 会让语义与 `generating` 重复
7. **补测试**：`demo/tests/state-machine.test.ts` 现在只有 15 行。
   加入条件迁移的测试，含「只含 code action 时不得走 generating」这一负向断言。

调用 `domain-modeling` skill 写 ADR（它会提供 ADR-FORMAT）。

## Answer

_（待填）_
