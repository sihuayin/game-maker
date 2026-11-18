# 收口授权包与 Ledger 拓扑

Type: grilling
Status: open
Owner: —
Blocked by: —
Map: ../map.md
Class: V1.1-CLOSURE / DECISION

## Question

冻结 `docs/v7.8/移动-收口.md` 的结构，使 I-04 / I-05 / PU-C5 / PU-ADMIT 四个单元可以各自独立授权、实施、复核、签署与记账。

必须裁定：

1. **包的范围与非目标**：只覆盖 4 个收口单元；P2–P7 只作为前置引用 Phase-2 annex，不重复授权；不改变 `PUBLIC_NB` / `PUBLIC_PU` gate。
2. **单元表与依赖**：4 个单元的定义、输入、输出、启动条件、复核门。
3. **Ledger**：4 行，字段至少含单元 / 文件（操作/目的）/ 增量授权状态 / 实施 SHA / 复核证据路径+hash / 批准人 / 日期 / 回滚目标 SHA / 回滚演练证据 / 备注；与 Phase-2 Ledger 的格式一致。
4. **白名单与证据路径**：每单元的允许文件、只读输入、证据落点、复核报告路径、STOP 条件；具体白名单以 `04-i04-brief` / `05-i05-brief` 为准，本票只冻结格式与默认值（默认产品代码零改动）。
5. **签署与闭合模型**：增量授权记录 → 用户签署 → docs-only PR → 分支 → 实施/证据 → fresh 复核 → 用户签署 → 合并/归档 → Ledger；最终收口报告与 V1.1 closure 声明的关系。
6. **基线与回滚**：baseline SHA、回滚目标、纯 audit 单元（PU-C5）与产品单元（I-04/I-05/PU-ADMIT 若改代码）的不同回滚方式。
7. **不可变边界**：不修改已签署的 I-00 / I-02 / I-03 / Phase-2 annex 正文；不把 `NOT_RUN` 写成 PASS。

产出：授权包草案（可在本票 Answer 中给结构 + 关键条文，或直接落 docs 草案）；不签署、不授权任何单元。
