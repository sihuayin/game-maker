# 票 79 探针 · 「两条同名动画」今天到底被哪条判据拦住、拦在哪一步、报文说什么

**只读 · 零付费 · 零网络**。一条命令：

```bash
node .scratch/game-maker-v2/experiments/79-anim-name-dup/probe79.mjs
```

原始输出逐字留在 [`raw-output.txt`](raw-output.txt)。用的是**出货的** `packages/assets/dist` 与
`packages/contracts/dist`，不是本脚本重写的等价物。

⚠️ 它**真跑了一次 `buildAssetPack`** —— 走的是 `import` 策略，**只读盘上一张 PNG，一次调用都没发出去**
（探针里那个 `generate` 桩一旦被调用就会抛，而它一次都没被调用过）。
⚠️ 产物落在 **`os.tmpdir()`** 里（输出里印了路径，跑完不清理，供复核）——**仓库一个字节没动**。

## 它量六件事

| # | 问的 | 读数 |
| --- | --- | --- |
| ① | `parseRecipe` 收不收「两条同名动画」 | **两份配方都过**（`drawlist` / `import`）· `AssetSpecSchema` 单独跑也过 |
| ② | `framePlan` 派生出什么帧名 | `hero.idle1 · hero.idle2 · hero.idle1 · hero.idle2` —— **4 个帧名只有 2 个不同** |
| ③ | **真跑 packer（`import`）**那份 manifest **过不过 `parseAssetPack`** | ⭐ **过** —— 两条动画，各列**同一批四帧** |
| ④ | `resolvePackRef` / `auditAssetSpec` 说什么 | 静默解到第一条（**不报歧义**）· audit 报的是**帧数**（`要 2 帧，实际 4 帧`）**两遍** |
| ⑤ | 对照组：同一个 spec 走 `drawlist` | **抛了** —— `帧名重复："hero.idle1"`（在账单写完之后、`renameSync` 之前） |
| ⑥ | 零误杀：盘上有几份会被新判据拒 | **0 份** —— 85 份 manifest · **275** 个动画声明，零重复 |

## ⭐ 一句话读数

票面写「后果会被另一条判据抓到（帧名重复）」—— **这句话只对了一半**：

```text
drawlist / image   帧名由动画名派生 ⇒ 必撞帧名 ⇒ 交付侧拒它（但**钱花完了**，报文点的是**帧名**）
import             帧名是配方自己写的 ⇒ **交付侧一个字都拦不住** ⇒ 那份真产物**过了契约**
                   ⇒ 唯一会说话的是**链尾 QA**，说的是**帧数**
```

## 关键落点（行号本轮复核过）

```text
packages/assets/src/prompt.ts:148-155      framePlan：`<资源 id>.<动画名><序号>`   ← 派生
packages/assets/src/pack.ts:884            stateOf.set(plan[k++].name, a.name)       ← 派生那条路
packages/assets/src/pack.ts:903            const names = src.sheet?.names ?? [spec.id] ← 自己写的那条路
packages/assets/src/pack.ts:930            frames.filter(f => f.state === a.name)     ← *按状态名过滤* ⇒ 合体
packages/contracts/src/assetpack.ts:197    「帧名重复」（交付侧唯一沾边的那条）
packages/contracts/src/assetpack.ts:377    resolvePackRef 的 find（first match wins）
packages/contracts/src/assetpack.ts:395-398 同一个函数里「必须指明 anim」那条口径
packages/contracts/src/asset-spec.ts:173-178 创作侧的「层名重复」（票 58）
packages/contracts/src/recipe.ts:319-320   sheet 分组名 ↔ spec 动画名**用 Set 比** ⇒ 同名是隐形的
packages/contracts/src/audit.ts:58         对账那一侧**也是 Set**
```

---

## ⭐ 施工之后复跑（票 89 · 2026-10-16）

判据落地之后**同一个脚本**再跑一次，读数留在 [`raw-output.after.txt`](raw-output.after.txt)。
⚠️ **脚本只补了一处 `try/catch`**（③ 那一跑现在会抛，不接住它就崩了）—— 除此之外**一个字节没改**，
所以 `raw-output.txt`（施工前）与 `raw-output.after.txt`（施工后）在 ③ 之前**逐字相同**。

| # | 施工前（`raw-output.txt`） | 施工后（`raw-output.after.txt`） |
| --- | --- | --- |
| ① | `parseRecipe` **两份配方都过** | ⭐ **两份都被拒** —— `assets[0].spec.animations: 动画名重复："idle"` |
| ③ | 真产物**过 `parseAssetPack`**（交付侧收下了它） | ⭐ **`buildAssetPack` 直接抛** —— `包不过自己的契约（1 处）：assets[0].animations: 动画名重复："idle"`。⚠️ 它比「过不过契约」**更前一步**：那份 manifest 压根没机会成为一份包 |
| ⑤ | drawlist：抛，**2 处**（两条帧名重复） | 抛，**3 处** —— 多出来的第 3 处正是新那条（两条判据**各成一条**，谁也不顶替谁） |
| ⑥ | 零误杀：**0 份** | ⭐ **0 份**，与施工前**一模一样**（85 份 manifest · 275 个动画声明，零重复 ⇒ 一份现存产物都不该被判死） |

⚠️ 而 **④ 那一问今天量不到「活的那一支」**（③ 已经抛了）⇒ 脚本改用**手搓的那份 manifest** 演示
同一件事 —— 那份手搓的形状**逐字取自施工前 packer 真的写出来的那一份**（见 `raw-output.txt` 的 ③）。

⚠️ **行号随施工漂了一处**（上面那份「关键落点」是**立案时**的快照，不改）：`resolvePackRef` 那处
`find` 从 `:377` 挪到 **`:405`** —— 因为票 89 在它上面加了那段「依赖关系及其成立前提」的注释；
新那条交付侧判据在 **`:208-220`**（`const animNames` 在 `:217`）。
