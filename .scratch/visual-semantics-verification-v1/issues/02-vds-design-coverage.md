# VDS↔design 覆盖 S=D 硬失败补漏

Type: task
Status: resolved
Owner: claude (2026-10-25)

## Question

票 04 契约（`visual-design-v1`）白纸黑字：「缺失 `D∖S` 与悬空 `S∖D` 都是硬失败 ⇒ `S=D`(集合)」，
其中 `D`=设计实体 id、`S`=带 `sourceIntent` 的 VDS id 集。但实现里**两条都没落**：

- `visualConfigCoherence`（`qa/src/visual.ts:221-222`）对 VDS object 的 `sourceIntent` 指向
  **设计里没有的 id**（`S∖D` 悬空）静默 `continue` 跳过，不报。
- 从不遍历设计实体查「设计实体没进 VDS」（`D∖S` 缺失），这一方向没人查。

它没爆是因为确定性 `layout.ts` 读整份 design、每实体产一个 `sourceIntent: e.id` 的 object ⇒ 结构上保证
S=D。所以本票是**防手写/LLM VDS 的纵深**（LLM 生成 VDS 是 P2、已 defer），不是现存 bug。但票 04 承诺了它，
且两条都「精确可算 + 错了一定不是设计」，是标准判据。

要落：

1. **`S∖D` 悬空（error）**：每个带 `sourceIntent` 的 VDS object，其 `sourceIntent` 必须指向设计里真实存在的
   实体 id；否则 error（替换现在 `visual.ts:222` 的静默跳过）。
2. **`D∖S` 缺失（error）**：每个设计实体（四桶，范围见第 4 点）至少一个带该 `sourceIntent` 的 VDS object；
   否则 error（现在没人查）。
3. **落点（倾向）**：挂进 `visualConfigCoherence`（它已读 VDS + design + config，就地加两条，不需新函数）。
   或在 `qa/src/visual.ts` 内独立成一个小函数、被 `visualConfigCoherence` 调用 —— 由实现按可读性定。
4. **D/S 的边界口径（要定）**：
   - `mechanics[]` 不进 D（票 04 明说，归 mechanic-coverage）。
   - `player` 进不进 D/S？VDS 有 player object（`layout.ts` 产 `sourceIntent: player.id`），但现有
     `visualConfigCoherence` 对 `bucket === "player"` 是 `continue` 跳过。**本票不改变 player 的既有待遇**
     （若 player 不进 D，则 `D∖S` 不查 player；与现有 `bucket==="player"` skip 保持一致）。
   - **VDS 是全设计（整份 design，不分关卡）**，所以 `D∖S`/`S∖D` 是**全设计口径**，与
     `auditEntityIdentity` 的「关卡作用域」是两把尺子，别混。
5. **测试**：单测覆盖「悬空 sourceIntent 报 error」「设计实体缺失于 VDS 报 error」「合法 S=D 零 error」
   「无 sourceIntent 装饰 object 不参与」；沿用一条真实 E2E（注入一条悬空/缺失，确认抓到）。
6. **顺带确认**：地图「Not yet specified」里那条「VDS 全设计 / config 单关卡」的潜在错位 ——
   本票落完 D∖S/S∖D 后，跑一遍多关卡夹具，确认现有「VDS→config 缺失」检查没有把别的关卡实体误报；
   若有，**记录、不扩票**（另立票）。

交付物：改动 `packages/qa/src/visual.ts`（可能 `packages/contracts/src/visual-design.ts` 注释）+ 单测 + 真实 E2E 证据。

## Answer

已收口（2026-10-25）。**零付费 LLM** —— S=D 落在 QA 交叉验证里，单测 + 真实产物对账即证。

**实现**（`packages/qa/src/visual.ts` 的 `visualConfigCoherence`，就地加、不新开函数）：
- `S∖D` 悬空：VDS object 的 `sourceIntent` 指向设计里没有的 id → `error`（替换原来 `visual.ts:222` 的静默跳过）。
- `D∖S` 缺失：四桶设计实体没进 VDS → `error`（新增这一方向，此前无人查）。
- 口径：`D`=四桶（`enemies/npcs/interactables/resources`，player/mechanics 不进）、`S`=带 `sourceIntent`
  的 VDS id 集、**全设计口径**（不分关卡，与 `auditEntityIdentity` 的关卡作用域两把尺子）。

**测试**（`packages/qa/tests/visual.test.ts`，+5；`assemble.test.ts` 的 `stage()` 一并改成合法 S=D）：
- 合法 S=D 零 finding · S∖D 悬空（`ghost`）→ error · D∖S 缺失（删 `e-drone`）→ error ·
  无 sourceIntent 装饰不参与 · **真实现场**：VDS 含 player object（`sourceIntent`=player.id）不算 S∖D。

**真实 E2E（零付费，E3）**：真实 `create` 产物 `entity-identity-v1/runs/2026-10-25-e2e-r2/...` 重判 ——
`D∖S=[]`、`S∖D={scavenger-hero}`（= 玩家，正确排除）。真实管线产出的 VDS 本就是 S=D，本判据零误报。

**验证**：`pnpm typecheck` 全绿；`pnpm test` 130 文件 / **1962/1962** 全绿。

**顺带确认（票面第 6 项）**：确认了地图「Not yet specified」那条雾 —— **真·结构性错位**：
`compileVisualDesign` 吃整份 design（`create-game.ts:370`）、`layoutVds` 读全四桶不分关卡，而
`compileRuntime` 只产一关 config。⇒ 当多关卡设计在关卡间**拆分实体**（level-1 ≠ level-2 实体集）时，
现有「VDS→config 缺失」检查会把别的关卡实体误报成「配置没做」。当前夹具（含两关 E2E-C）都是**同一套
实体铺满所有关卡**，故未触发。**已另立票 03，本票不扩。**
