# 97. `audit.ts:73-84` 的 `layers` 三字段比较**也在「没有独立信息增量」那一侧** —— 撤、留、还是换个守法

Type: grilling
Status: open
Owner: —
Blocked by: —
Map: ../map.md
> 派生自[票 92](92-asset-spec-anchor-not-reconciled.md) 的 **`## Answer §四`** ——
> 那不是一轮问答的产物，是**人答那句边界自己推出来的读数**。人裁（2026-10-16）逐字：
> 「**Q1–Q4 全部采纳推荐项；认同「恒等就不该有对账」，但仅限于没有独立信息增量的字段比较。**」
> ⚠️ 票 92 的 §四 逐字记着：**「本轮不据此改动任何东西」**（人只裁了四问，这一条是本轮自己推出来的）⇒
> **本票就是那次「只登记、等人开」之后的「开的那一张」。**
> ⚠️ **立票 ≠ 批准施工**（票 65 / 71 / 82 / 90 / 91 / 92 先例逐字沿用）：本票面**只登记现场与射程**，
> 动手要**另一次独立点头**。

## Question

**`audit.ts:73-84` 拿 `entry.layers` 去对 `spec.layers`，而 `entry.layers` 是
`spec.layers.map(toPackLayer)` 的逐字节产物 ⇒ 零独立信息增量 ⇒
这一族判据要不要撤？要留的话，凭什么留？**

## 1 · 现场（推导逐行）

`packages/contracts/src/audit.ts:70-84` 逐字：

```
// ── 分层背景：层与帧一一对应（票 42）────────────────────────────────────
// ⚠️ 这一族必须先算出来，因为下面那条「非 animation 不该有多帧」要**避开**分层背景 ——
//    否则一个完全正确的三层背景会被报成问题（票 42 实测：它当时既产不出来，也过不了对账）。
const wantLayers = spec.kind === "background" ? spec.layers ?? [] : [];
const gotLayers = entry.layers ?? [];
if (wantLayers.length !== gotLayers.length)
  at(`声明了 ${wantLayers.length} 层，产物却有 ${gotLayers.length} 层`);
else
  wantLayers.forEach((l, i) => {
    const g = gotLayers[i]!;
    if (g.name !== l.name) at(`第 ${i} 层应当是 "${l.name}"，产物是 "${g.name}"`);
    if (g.parallax !== l.parallax) at(`层 "${l.name}" 的视差应当是 ${l.parallax}，产物是 ${g.parallax}`);
    if (JSON.stringify(g.tileable) !== JSON.stringify(l.tileable))
      at(`层 "${l.name}" 的平铺声明与 spec 不一致（…）`);
  });
```

而交付清单那一份是怎么来的 —— `packages/assets/src/pack.ts:1095` 逐字：

```
...(b.spec.kind === "background" && b.spec.layers ? { layers: b.spec.layers.map(toPackLayer) } : {}),
```

`toPackLayer`（`pack.ts:151`）逐字：

```
const toPackLayer = (l) => ({ name: l.name, parallax: l.parallax, ...(l.tileable ? { tileable: l.tileable } : {}) });
```

⇒ ⭐ **被比的三个字段（`name` / `parallax` / `tileable`）三个全是逐字节搬运**，
`description` 是**唯一**被剥的那个 —— **而 audit 恰恰不比较它**。
⇒ **零独立信息增量** ⇒ 按人裁那句话，**这一族与 `anchor` 同一种形状**。

## 2 · ⚠️ 但它与 `anchor` 那一格**有两处真差别**（本票的题眼）

1. ⭐ **它是「已存在」的判据，撤是减、不是加**。票 92 问的是「要不要**加**一条」，
   本票问的是「要不要**撤**一条」—— 两者**代价不同**：加一条恒等判据是**净增一个假保证**；
   撤掉一条，是**净减一个（今天只在手工路径上有牙的）保护**。
2. ⭐⭐ **对账只能证明「两处不符」，不能证明「哪一处错」** —— 而这一条**盘上已经有现场**：
   [票 92 读数 E](../clarifications/92-round-1.md) 第四行（`fixtures/recipes/counter-siege-derived.json`
   ＋ `fixtures/packs/counter-siege/v4`）里，清单说 `ui-icon-scrap` 是 `{0.5,0.5}`、包里是 `{0,0}`
   —— **谁对说不出来**（那份清单是**旧命名时代**的，21 件里 15 件的 id 在包里根本不存在）。
   ⇒ 这正是 **R3 那道门**（「错了一定不是设计」）在这一族上的**具体难点**：
   对不上时**分不清是产物错了、还是清单过时了**。

## 3 · ⚠️ 三条**不受**本票影响的（写在这里，免得被顺手带走）

1. **`:73` 算出的 `wantLayers` 还要被 `:86` 用** —— `:86` 拿 `wantLayers.length === 0` 去
   **豁免分层背景**（不然「一个完全正确的三层背景会被报成问题」）。⚠️ **那是「用」，不是「比」**
   ⇒ 撤 `:75-84` **不动它**。
2. **`assetpack.ts` 的 superRefine 另有四条层规则**（`:225-240`：只有 `background` 能有 layers（`:228`）·
   层名重复（`:231`）· `layers.length === frames.length`（`:235`）· 帧名必须是 `<背景 id>.<层名>`）。
   ⚠️ 它们**住契约、不住 audit**，且与 audit 那几条**不是同一条**
   （superRefine 查的是 entry **内部**自洽，audit 查的是 entry **对 spec**）。
3. ⚠️ **`layers` 是壳子真读的东西** —— `packages/demo/src/draw.ts:201` 逐字
   `const layers = res.asset.layers ?? [];`，且 `:202-206` 还拿 `layers.length !== res.frames.length`
   报 `scene.background` 的 error ⇒ **交付清单里那份载荷是实的**。
   ⭐ **本票问的不是「要不要这个字段」，是「要不要拿它对账」** —— 两件事。

## 4 · 要裁的三格（本票**只作裁定**）

1. **撤、留、还是换？**
   - **(a) 撤掉 `:75-84`**（保留 `:73`）—— 与 `anchor` 同一把尺子，一致性最强。
   - **(b) 留着** —— 人答那句是**限制**不是**清扫令**；且 `:81-83` 是**全仓唯一**检查
     `parallax` / `tileable` 与 spec 是否一致的地方。
   - **(c) 留着，但把「为什么留」写进文件头** —— ⚠️ 与[票 95](95-audit-header-promise-reconcile.md)
     **改同一段文字**，两票**会撞**。
   - **(d) 别的。**
2. ⚠️ **若撤**：`packages/contracts/tests/asset-spec.test.ts:161-219` 那一整个
   `describe("auditAssetSpec —— 分层背景（票 42）")`（五条测试）怎么办？
   —— 它们**全是手搓 `bgEntry`**（`over` 一份 `Partial<AssetPackEntry>`）⇒
   判据一撤，那五条**全部失去意义**（删掉？改成测别的？）⚠️ **别把它当成「顺手的事」**。
3. ⚠️ **若留**：这一条与[票 95](95-audit-header-promise-reconcile.md) 那句文件头**怎么接**？
   —— **票 95 要往清单里补 `layers`**（因为函数今天真在查它）。若本票判**留**，两票一致；
   若本票判**撤**，票 95 就**不该补 `layers`** ⇒ ⭐ **两票有先后依赖，本票在前**
   （⚠️ 已把[票 95](95-audit-header-promise-reconcile.md) 接上 `Blocked by: 97`）。

## 5 · 边界

- **立票 ≠ 批准施工**：本票是 `Type: grilling` ⇒ **只出裁定**（本票**尚未认领**）。
  `audit.ts` / `pack.ts` / `packages/contracts/tests/**` **一行不碰**，直到**另一次独立点头**。
- **不与[票 92](92-asset-spec-anchor-not-reconciled.md)（已关）· [票 95](95-audit-header-promise-reconcile.md) ·
  [票 96](96-verify-promise-vs-honor.md) 合并** —— 四张各自独立授权。
- **不动 R 表**（R17）· `packages/qa` 一行不碰 · `fixtures/**` 不碰 ·
  `game-maker.local.json` 一个字不动 · **不执行任何付费真跑** · **不提交**。
- ⚠️ **免费证得了的**：§1 的逐行读数 · §3 的三条「不受影响」· 测试那一族的形状。
  **免费证不了的**：撤掉之后**会不会真的少挡住什么**（要造成一份「清单与包不同源」的现场 ——
  ⚠️ 那**造不出来**，除非走 R9 那条**人可改**的手工路，见票 92 读数 H）。
