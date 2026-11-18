# I-05 时序 NB/PU 案例缺口与 fixture 授权

Type: grilling
Status: resolved
Owner: claude (wayfinder session 2026-11-18)
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

## Answer

**Q1–Q8 = 用户裁定（2026-11-18）。** I-05 口径冻结为 **Q1=A：真实时序 NB / PU / IE 各一例为硬要求**，由新增独立单元 **FIX** 生产；fixture 失败不降标准。

交付：

- `docs/v7.8/移动-收口.md` 新增 **§5.1 FIX · I-05 真实时序案例 fixture**；§0 / §1 / §1.1 / §1.4 / §2 / §9 / §12 同步接线（5 单元、5 行 Ledger）；包 hash `ea95d329…`。
- `05-i05-brief` 与 `07-pu-admit-brief` 各加 Context 段引用 FIX 与证据归属。

| # | 冻结 |
| --- | --- |
| Q1 | 三案例硬要求；I-05 在 FIX 签署后才可 PASS；fixture 失败 ⇒ closure `INCOMPLETE` |
| Q2 | 真实案例四条件：真实 pack + manifest；至少一条正式流程完整跑通；确定性（含两档 lag）；零付费上游。合成 `PU_WORLD` / 内存 config / 单点判定调用不算 |
| Q3 | FIX 交付 NB witness / PU witness / IE 负例 + 逐项证据 / hash / fresh 复核 / 用户签署 / R2 式授权；PU witness 必须挂条件 5 |
| Q4 | 可行性门先行；`INFEASIBLE` 或实现失败均不降标准，I-05 与 closure `INCOMPLETE` |
| Q5 | FIX 是 I-05 前置；不阻塞 PU-ADMIT；可与 I-04 / PU-C5 并行 |
| Q6 | 证据归属隔离：FIX 的 PU witness → I-05；条件 5 → PU-C5；六条件资格 → PU-ADMIT；不得重复计入 |
| Q7 | 固定禁止项（静态冒充、合成冒充、I-05 自建、改判据 / 算法 / 已签署文档、付费上游）与 `INCOMPLETE` 措辞 |
| Q8 | I-05 / closure 状态矩阵固定：全签署且 DoD 十项可勾 ⇒ `PASS`；否则 `INCOMPLETE`；任一单元 `FAIL` ⇒ `FAIL` |

**规划层解冻 ≠ 授权**：FIX 已列入授权包，但仍 `NOT_AUTHORIZED`；实施前需 FIX 增量授权记录、白名单、复核、签署与 Ledger 行。未创建任何 fixture、未执行 I-05。

**下游**：`05-i05-brief` 与 `07-pu-admit-brief` 解锁；`08-sequencing` / `09-closure-dod` 仍等这两张票。
