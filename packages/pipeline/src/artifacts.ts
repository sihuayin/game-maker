// `run/v<N>/` 里那**九项**的写与读（票 15 的 Q1 / Q2 / Q3 / Q14）。
//
// ⚠️ **九项里那五份「有人返回、没人落盘」的产物由本模块写**（票 15 的 Q3）：
//   理解层那四步（票 08/09/10/31）**都不写文件** —— 那是有意的（它们**不知道落点**），
//   而落点正是票 15 定的。⇒ 序列化**只有这一处**，四个包谁也别自己写。
//
// ⚠️ **`asset-recipe.json` 是唯一的人工编辑点**（R10）：本模块写它的**初稿**，
//   而人在检查点改的就是**磁盘上那一份**；构建段读回来的是同一份（票 15 的 invariant 3）。
import fs from "node:fs";
import path from "node:path";
import type { CharacterDNAFile, GameDesignSpec, GameIntentSpec, VisualWorldSpec } from "@game-maker/contracts";

/** 九项的文件名（`docs/v2/01-contracts.md §13`）。⚠️ **只此一处** —— 别在别处再拼一遍。 */
export const RUN_ARTIFACT = {
  intentMd: "intent.md",
  visualWorld: "visual-world.json",
  gameIntent: "game-intent.json",
  gameDesign: "game-design.json",
  characterDna: "character-dna.json",
  recipe: "asset-recipe.json",
  config: "game-config.json",
  qaReport: "qa-report.json",
  ledger: "ledger.json",
} as const;

/** ⚠️ 与 `pack` 的 `jstr` **同一条规矩**（两处都在写产物 JSON，格式必须一样）：
 *  两空格缩进 + **末尾一个换行**。 */
export const jstr = (o: unknown): string => JSON.stringify(o, null, 2) + "\n";

export function writeJson(p: string, o: unknown): void {
  fs.writeFileSync(p, jstr(o));
}

/**
 * 理解段**随步落盘**（票 15 的 invariant 5 的落点）。
 *
 * ⚠️ **不是最后一次性写**：每一步的产物一出来就写进 staging —— 那样中途挂掉时，
 *   **失败现场里就是「已经跑完那几步」的产物**，看一眼就知道断在哪一步。
 *   （最后一把写的话，前面挂掉时现场是空的，那条 invariant 就成了一句空话。）
 *
 * ⚠️ **`intent.md` 存原样字节、不做规范化**（§13 的原话）—— 否则复现的不是同一次输入。
 */
export function writeIntentMd(dir: string, requirement: string): void {
  fs.writeFileSync(path.join(dir, RUN_ARTIFACT.intentMd), requirement);
}

/**
 * 写 `visual-world.json`：**并把风格参考图也拷进来、把路径改写成同目录的 basename**。
 *
 * ⚠️ 契约写着「`styleReferences[].path` **相对于 `visual-world.json` 自身**」，而这份 VWS
 *   定稿之后住在 `run/v<N>/` —— 不把图带过来、不改写路径，那个相对路径就指到别处去了
 *   （票 12 把世界风格图拷进配方目录是同一条理由）。⇒ 定稿之后的 run 是**自包含**的。
 *
 * @returns **改写过路径**的那份（与落盘的那份逐字相同 —— 它就是被写下去的那一份）
 */
export function writeVisualWorld(dir: string, vws: VisualWorldSpec, cwd: string): VisualWorldSpec {
  const world = copyStyleReferences(dir, vws, cwd);
  writeJson(path.join(dir, RUN_ARTIFACT.visualWorld), world);
  return world;
}

/** 拷参考图 + 把路径改写成**同目录的 basename**。⚠️ 撞名时加后缀（同一张图拷两次也只有一个文件）。 */
function copyStyleReferences(dir: string, vws: VisualWorldSpec, cwd: string): VisualWorldSpec {
  const used = new Set<string>();
  const styleReferences = vws.styleReferences.map((r) => {
    const src = path.resolve(cwd, r.path);
    const ext = path.extname(r.path) || ".png";
    const stem = path.basename(r.path, path.extname(r.path)) || "reference";
    let name = `${stem}${ext}`;
    for (let i = 1; used.has(name); i++) name = `${stem}-${i}${ext}`;
    used.add(name);
    fs.copyFileSync(src, path.join(dir, name));
    return { ...r, path: name };
  });
  return { ...vws, styleReferences };
}

/**
 * **注入 `characterRef`**（票 15 的 Q13：DNA 的唯一通道）。
 *
 * ⚠️ 模型**不会**写这一格（它不知道落点），所以由这一层填 ——
 *   而相对路径是**常数**（`character-dna.json`）：它俩永远住在同一个目录里。
 * ⚠️ **已经有 `characterRef` 的清单不动它**：那是人（或上一趟）自己指的，而 `parseRecipe`
 *   允许它指到别处（`InputPath` 本来就有 `..`）—— 那是**人的选择**，不是我们要盖掉的。
 */
export function injectCharacterRef(recipe: Record<string, unknown>): Record<string, unknown> {
  return recipe["characterRef"] === undefined
    ? { ...recipe, characterRef: RUN_ARTIFACT.characterDna }
    : recipe;
}

/** 从 staging 把 planner 那几份收拢到**根**（`v<N>.json` → `asset-recipe.json`）。
 *
 * ⚠️ planner 是**文件进出**的（它按配方 id 建 `<id>/recipes/`），而 run 里**没有那一层** ——
 *   所以这里把它摊平：清单改名、`stylespec.json` / `reference.png` 跟着搬（`styleRef` 与
 *   `referenceImage` 写的是**同目录**的相对路径，摊平之后依然成立）。
 */
export function flattenPlannerOutput(stagingDir: string, recipeId: string, recipeFile: string): void {
  const from = path.join(stagingDir, recipeId, "recipes");
  for (const name of fs.readdirSync(from)) {
    if (path.join(from, name) === recipeFile) continue;   // 清单由调用方改名另写
    fs.renameSync(path.join(from, name), path.join(stagingDir, name));
  }
  fs.rmSync(path.join(stagingDir, recipeId), { recursive: true, force: true });
}

/** 读回 `run/v<N>/` 里那份清单的**原始 JSON**（未解析）—— 构建段的第一件事。 */
export function readRunJson(runDir: string, name: string): unknown {
  const p = path.join(runDir, name);
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    throw new Error(`读不出 \`${name}\`（${p}）：${(e as Error).message}`);
  }
}
