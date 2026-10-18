// 票 03：**planner 的母版兜底** —— 每个带 `characterId` 的 animation 都必须有一张母版。
//
// ⚠️ **这不是提示词的替身，是它的确定性那一半**：B 跑（`runs/2026-10-18d/`）量到 3 个角色、
//   0 张母版，而当时的提示词逐字允许「母版不必每份清单都有」⇒ 模型照许可省略。
//   提示词已改硬（`PLAN_TOOL_DESCRIPTION` 第 4 条 + `assetPlanPrompt`），但模型的遵守率
//   没有免费验证手段 ⇒ 这一层保证「漏写」不会把 DNA → 母版 → 动画那条链静默跳过。
//
// ⚠️ **纯函数、不碰 I/O、不读 DNA**：母版的**身份**由 `pack` 用 DNA 渲染（`master.ts`），
//   这里只补「账面上必须有这一行」。`size` 取被引用动画的 `size`（同一比例 ⇒ 契约那条
//   零容差判据当场过；不同比例 ⇒ 各建一张）。
//
// ⚠️ **只补 `animation`**（票面原话「每个有 `characterId` 的动画资源」）：`sprite` 上写
//   `characterId`（比如角色身上的道具）仍走它自己的路，不在这里长母版。
import type { AssetRecipe, AssetSpec, AuthoringAsset } from "@game-maker/contracts";

export type EnsureCharacterMastersOptions = {
  /** **不补**这些资产（`import` 的 mustReuse 资产用的人给的位图，`masterAsset` 在那里没有意义）。 */
  skipAssetIds?: ReadonlySet<string>;
};

const sameAspect = (a: { w: number; h: number }, b: { w: number; h: number }): boolean =>
  a.w * b.h === a.h * b.w;

/**
 * 补齐「每个角色一张母版」那条边。**纯函数**：没东西要补时原样返回同一个对象。
 *
 * 规则：
 *  - 已经指着**本角色、同比例**的母版 ⇒ 不动；
 *  - 本角色已有同比例的母版（模型的、或上一轮补的）⇒ 复用它；
 *  - 否则新建一张 `master-<characterId>`（撞 id 自动让开），`source.kind = "image"`；
 *  - 同一角色的多个动画只要比例相同就**共用**一张母版。
 */
export function ensureCharacterMasters(
  recipe: AssetRecipe,
  opts: EnsureCharacterMastersOptions = {},
): AssetRecipe {
  const authoring: AuthoringAsset[] = [...(recipe.authoring ?? [])];
  const used = new Set<string>([...recipe.assets.map((e) => e.spec.id), ...authoring.map((m) => m.id)]);
  const uniqueId = (base: string): string => {
    let id = base, n = 2;
    while (used.has(id)) id = `${base}-${n++}`;
    used.add(id);
    return id;
  };

  let changed = false;
  const assets = recipe.assets.map((entry) => {
    const spec = entry.spec;
    if (spec.kind !== "animation" || spec.characterId === undefined) return entry;
    if (opts.skipAssetIds?.has(spec.id)) return entry;

    const current = spec.masterAsset === undefined ? undefined : authoring.find((m) => m.id === spec.masterAsset);
    if (current !== undefined && current.characterId === spec.characterId && sameAspect(current.size, spec.size))
      return entry;

    // ⚠️ 模型可能写了**别的角色**的母版（契约只验存在性与比例，不验 characterId）——
    //   `current` 不合用就重新找，找不到就新建；不删它（可能还有别的资产指着）。
    let master = authoring.find((m) => m.characterId === spec.characterId && sameAspect(m.size, spec.size));
    if (master === undefined) {
      master = {
        id: uniqueId(`master-${spec.characterId}`),
        role: `角色母版（${spec.characterId}）`,
        description: `同一角色的所有动作共用这张形象参考：${spec.role}`,
        source: { kind: "image" },
        characterId: spec.characterId,
        size: { w: spec.size.w, h: spec.size.h },
      };
      authoring.push(master);
    }
    changed = true;
    const next: AssetSpec = { ...spec, masterAsset: master.id };
    return { ...entry, spec: next };
  });

  if (!changed) return recipe;
  return { ...recipe, assets, authoring };
}
