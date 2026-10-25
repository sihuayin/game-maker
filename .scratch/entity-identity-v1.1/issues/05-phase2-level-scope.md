# 实施 Phase 2：关卡作用域

Type: task
Status: resolved
Blocked by: 04

## Question

把票 03 裁定的关卡作用域落进编译期校验：覆盖只针对当前关卡，全局完整性独立，越界引用被拒。

范围（PRD §5 + 票 03 答案）：
- `auditEntityIdentity` 增加作用域参数（显式传入 `levelId` 或已解析作用域；不默认取第一关掩盖缺失）。
- B1 覆盖：覆盖集合 = `design.levels.find(l => l.id === levelId).entities` 解析到四桶；`player` 不计入 `config.entities` 覆盖计数。
- B4 越界：**单独遍历 `config.entities[]`**（不在覆盖循环里做），`sourceIntent` 指向有效四桶 id 但不在当前关卡 `entities[]` → `error`（`wrong-scope`）。
- B2 全局完整性：设计 ID 唯一性、关卡引用完整性等全局结构检查独立（gate ⑥ 已有悬空关卡引用，补齐其余）。
- B3 单关卡：既有合法输入 / 输出不变，不新增作用域参数要求或重复清单。
- 更新调用点：`compileRuntime`（`ops.ts:1036` 已选关）把 `levelId` 传给校验；循环内 + 循环后两处。
- 兼容性（票 04）与作用域（本票）两类错误**分开定位**：kind 不兼容 vs `wrong-scope` 各自独立 error。

验收（PRD §6.2 + §6.4 回归）：
- 单关卡合法映射仍通过；两关各有不同必需实体；关卡 A 不含仅属 B 的实体时 A 覆盖仍通过；A 缺自身必需实体则失败；B 的实体被 A 引用按 B4 拒绝。
- 全局完整性仍能发现无效设计 ID / 关卡关联。
- 缺关卡上下文不静默回退为全局覆盖。
- V1 回归：`Entity.id` / `sourceIntent` 语义、覆盖、悬空、合法 1:N、结构性实体、现有单关卡 fixture 不被无意破坏。

纪律：TDD；改仓库代码但不动 `fixtures/`、`game-maker.local.json`；不提交 / 推送。

## Answer

实施完成（2026-10-25）。`auditEntityIdentity` 增 `levelId?` 作用域参数，覆盖 / 越界 / 兼容按票 03 裁定的顺序落地，两类错误（kind 不兼容 vs `wrong-scope`）分开定位。

落地：
- `auditEntityIdentity(design, config, levelId?)` 四步：① **coverage** 只查当前关卡 `levels[].entities[]` 解析出的四桶（`player` 滤掉、不进 `config.entities` 覆盖计数）；② **悬空** 不变；③ **越界（wrong-scope）** **单独遍历 `config.entities[]`**（不在覆盖循环里做——覆盖只能发现「缺失」、发现不了「配置多出别的关卡的实体」），`sourceIntent` 指向有效四桶 id 但不在本关 → error；④ **兼容** 只查「有效且在本关」的实体，悬空 / 越界不重复报。
- 作用域解析：`levelId` 显式传入；**多关不传 = 缺上下文 → 报 `scope` error（不默认取第一关、也不回退全局覆盖）**；单关（`design.levels` 恰一条）时那条即作用域、免显式传（票 03 B3 单关兼容，现有单关 fixture 不被破坏）。
- 调用点 `compileRuntime` 两处（重采样循环内 + 循环后）都把已选关的 `level.id` 传给校验（`ops.ts`）。
- 全局完整性（设计 ID 唯一 / 关卡引用）仍由 `game-design` schema gate ⑤⑥ 负责（`game-design-gate.test.ts` 已 pin），`auditEntityIdentity` 不重复实现 —— B2「补齐其余」即这两道 gate 已覆盖，不混进关卡覆盖。

验证：`pnpm typecheck` 全绿；`pnpm test` **130 文件 / 1954 测试全绿**（+7 条关卡作用域测试；原 V1 覆盖 / 悬空 / 1:N / 孤儿 + 票 04 兼容回归全过）。无 `fixtures/` 改动、无提交 / 推送。
