# I-05 时序 NB/PU 案例缺口与 fixture 授权

Type: grilling
Status: open
Owner: —
Blocked by: —
Map: ../map.md
Class: V1.1-CLOSURE / DECISION

## Question

`01-coverage-inventory` 已证明：现有 21 configs / 19 moving hazards 在**时序层**全部是 `INSUFFICIENT_EVIDENCE`，没有任何真实 config 产生 `nb-candidate` 或 `pu-candidate`；表内 11 个 `NO_PROVEN_BLOCKER` / 3 个 `PROVEN_UNPLAYABLE` 都是 V1 静态层结论。

Q8=A 已冻结「I-05 只筛现有 19 个 config，不自建 fixture；某类缺失时另开 fixture 授权票」。现在该类确实缺失，必须裁定：

1. **I-05 的验收口径**：要求「真实时序 NB / PU / IE 各一例」，还是接受「时序层仅 IE；NB/PU 只作 V1 静态层支持证据」并写入已知限制？
2. **若要求真实时序 NB/PU**：另开一张 fixture 授权票（不在本图执行），冻结它必须交付什么——真实 pack + config、NB witness、PU witness、IE 负例、确定性、独立复核、R2 式授权；本图只定义路径与前置。
3. **若降低口径**：V1.1 closure 是否因此只能判 `INCOMPLETE`？PRD DoD「真实关卡案例」如何措辞？会不会把「时序能力未在真实关卡验证」掩盖成 PASS？
4. **禁止**：用静态层 NB/PU 冒充时序 NB/PU；用合成 `PU_WORLD` 冒充真实案例；在 I-05 内新建 fixture 绕过授权。
5. **与 I-05 brief / PU-ADMIT 的关系**：本票结论如何进入 `05-i05-brief` 与 `07-pu-admit-brief`；fixture 授权票的产出如何被 I-05 消费。
6. **成本与顺序**：fixture 授权票在 Wave 中的位置（必须在 I-05 前）；若它失败，I-05 与 closure 如何降级。

产出：I-05 案例口径裁定 + fixture 授权票的路径/前置（不创建 fixture、不执行 I-05）。
