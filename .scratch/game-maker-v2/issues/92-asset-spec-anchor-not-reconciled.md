# 92. `auditAssetSpec` **从不读 `anchor`** —— 而它文件头点名承诺会读

Type: grilling
Status: open
Owner: —
Blocked by: —
Map: ../map.md
> 派生自[票 82](82-hud-anchor-convention-ownership.md) 的 **Q6 = (a)**。人裁（2026-10-16）原话逐字：
> 「作为**独立的契约对账缺口**登记。它**涉及所有资源类型的 `anchor`**，**不是 HUD 专属问题**。
> **立票不等于批准施工。**」
> ⚠️ 与本票同批的另外两张：[票 90](90-anchor-convention-to-authoring-side.md)（Q2）·
> [票 91](91-contract-anchor-prose-false-claim.md)（Q5）。**三张各自独立授权。**

## Question

**「spec ↔ 产物对账」的文件头逐字承诺它会读 `anchor`，而函数体一次都没读 ——
它今天不会红，是因为 `pack.ts` 把 `spec.anchor` 逐字节复制了过去。
这个缺口要不要补、以什么形状补？**

## 1 · 现场

`packages/contracts/src/audit.ts:35-43` 逐字：

> **spec ↔ 产物对账**：`AssetSpec` 说要做成什么样，包里实际做出的是什么。
>
> 这是「需求 vs 产物」**唯一**的对账点。没有它，`AssetSpec` 里的
> `size` / `animations` / `anchor` 就只是写给自己看的注释。

而 `auditAssetSpec`（`:45`）逐条查的是：`kind`（`:49`）· `size`（`:51`）· 动画名与帧数（`:56-68`）·
`layers`（`:72-86`）· drawlist 的 `viewBox` vs 声明尺寸（`:89-94`）。
⇒ **`anchor` 一次都没读**（`grep -n "anchor" packages/contracts/src/audit.ts` ⇒ 只有 `:40` 那句注释）。

## 2 · ⚠️ 为什么它今天**不会红**（缺口被**构造**遮住）

`packages/assets/src/pack.ts` 把配方里声明的锚点**逐字节复制**进清单：

- `:1032` 动画：`b.frames.map((f) => ({ name: f.name, image: f.image, **anchor: b.spec.anchor**, … }))`
- `:1089` 非动画：`anchor: b.spec.anchor,`

⇒ `entry.anchor` **恒等于** `spec.anchor`（新链里）。**两者不可能对不上，所以没人会发现没人查。**
⚠️ 而这份文件**正是为「防它变成注释」而建的** —— 文件头的原话就是「没有它…就只是写给自己看的注释」。

## 3 · ⚠️ 要裁的三格（本票**只作裁定**）

1. **补不补？** 缺口是真的，但今天**被构造遮住**、**零观测损失** ⇒
   补它是「把构造保证变成判据」（好，但**今天不会有人受益**）还是「加一条永远不响的判据」？
   ⚠️ 票 81 的教训（逐字记在那一票里）：**新判据自己零判据 —— 谁把它删掉，什么都不会红。**
2. **若补，比什么？** `spec.anchor` vs `entry.anchor` 相等？⚠️ 而 `assetpack.ts:11` 的注释里
   `anchor` 属**三项例外之一**（另两项是 `scale9Borders` / `layers`）——
   ⚠️ **那个「例外」到底豁免了什么**，要先读清楚，否则判据会与该例外打架。
3. **射程**：`auditAssetSpec` 是**唯一**的对账点，它服务的不止新链 ——
   ⚠️ `fixtures/packs/**` 那些**导入**的包（`imported/` 目录）走的是另一条路，
   判据加进去会不会**误伤入库夹具**？（票 64 的教训：`fixtures/**` 动它要另一次授权。）

## 4 · 边界

- **立票 ≠ 批准施工**：本票是 `Type: grilling` ⇒ **只出裁定**。`audit.ts` / `pack.ts` /
  `fixtures/**` **一行不碰**。
- ⚠️ **不与票 90 / 91 合并**（人裁逐字：「**不是 HUD 专属问题**」）—— 它涉及**所有 `kind` 的 `anchor`**。
- **不动 R 表**（R17）· `packages/qa` 一行不碰 · `game-maker.local.json` 一个字不动 ·
  **不执行任何付费真跑** · **不提交**。
- ⚠️ **免费证得了的**：§1 的逐行读数 · §2 的两处复制点 · `grep` 的「零命中」。
  **免费证不了的**：这个缺口**会不会真的漏掉一个错**（要造一个 spec/entry 锚点不一致的包 ——
  ⚠️ 那在今天的构造下**造不出来**，除非绕过 `pack.ts`）。
