// 票 17 的落点：**Visual QA 的判据那一半**（`docs/v2/03-claude-code.md §21`）。
//
// ⚠️ **本票的射程只有一句话**：把**当前 QA 包边界内可达**的构造性约束接进 Visual QA。
//   不新增 similarity 判据 · 不重算上游判据 · 不跨包抓视觉数据 · 不负责 review observation。
//
// ─────────────────────────────────────────────────────────────────────────────
// 一、`§21` 那七项**一条判据都不加**（票 17 的 Q1）
//
//   `style similarity` · `palette similarity` · `silhouette` · `composition` ·
//   `character consistency` · `material consistency` · `animation consistency`
//   —— **全是观察**。理由是 R3 那半句门槛（「**错了一定不是设计**」）逐项都说不出来：
//     · `style` / `silhouette` / `composition` / `material`：**没有可算的形式**
//       （票 22 已经量过：连「数值的比例指令」模型都不执行，遑论「像不像」）；
//     · `character` / `animation consistency`：唯一可算的是**逐帧外接矩形**，
//       而**跳跃帧本来就该变** ⇒ 拿它当判据会误伤正例（票 13 的 Q7 裁过同一条）；
//     · ⚠️ `palette similarity` **别和 `palette-binding` 混**：后者是「颜色 ∈ 色板」（**判据**），
//       这一条是「这个色板像不像参考图」（人眼）。
//   ⚠️ 于是 **`similarity` 这个词一次都不许进契约** —— 它是「分数」的影子（R3 砍掉的那个东西）。
//
// ─────────────────────────────────────────────────────────────────────────────
// 二、判据吃**交付态**（票 17 的 Q3）
//
//   `CONTEXT.md`：绑定值 `exact` 是「**光栅化后扫像素实测**，不是承诺」。
//   ⇒ 本文件里每一条判据读的都是**已经做出来的东西**（包里的 manifest + 清单 + sidecar 的数）。
//   ⚠️ 而创作态那一侧的静态判定（`paletteBindingOf` 对 drawlist）**是 `pack` 用来给值的东西** ——
//     它是判据的**输入**，不是判据的第二个实现 ✓（重算 = 第二份真相）。
//
// ─────────────────────────────────────────────────────────────────────────────
// 三、**本包的白名单只有 `contracts`**（票 07 钉死的）—— 这一条决定了射程
//
//   · `auditAssetSpec` 住 **contracts** ⇒ **够得着** ✓（构造性约束就靠它）
//   · PNG 解码器 / `inspectPack` 住 **assets**、视口常量 / `auditGeometry` 住 **demo** ⇒ 够不着 ✗
//   ⇒ `palette-binding` 因此只能做**报表级对账**（读 manifest 的数，扫不了像素）；
//   ⇒ `layer-coverage` **不在这里**（那条规则要同时知道世界多宽与视口多大 ⇒ 住装配期，
//     而那儿**已经硬失败**了）。⚠️ QA 的 `checked` 里因此没有它 —— 那是**对的、不是缺口**：
//     `checked` 的意思是「**这一次真跑过哪几条**」（票 06），差集自己就说明了缺什么。
//
// ─────────────────────────────────────────────────────────────────────────────
// 四、⚠️ **出口是「族结果」而不是一份报告**（票 18 的 R2-Q4，与 `gameplay.ts` 统一）
//
//   本族**只声明自己那两条**（`QaFamilyResult.judgements` 是 `Partial`）—— 缺席 = **不归我**。
//   谁把三族凑成一份 `qa-report.json`、谁补齐那两条观察，归**票 20**（合成器）。
//   ⚠️ 而在票 18 之前这里返回的是**整份报告**，另外四条 `ran:false` 各带一句「归谁」——
//   那正是「**替别人填格子**」，也是这份报告**落盘过不了 `qa-report/schema` 的原因**（票 18 实测）。
//
//   剩下的四条**归谁**（那些「归谁」原来写在 `ran:false` 的 reason 里，现在归这里）：
//     · `layer-coverage`   —— 装配期（见上面三）；
//     · `reference-resolution` / `reachability` —— **玩法族**（`gameplay.ts`）；
//     · `intent-coverage`  —— 意图族（票 19）。
//
// ─────────────────────────────────────────────────────────────────────────────
// 五、**观察那一栏空着**（票 17 的 Q4，人类裁定）
//
//   `review`（视觉差异）归票 22、`inspect` 的用色观察归票 20 —— 本族 **一个都不跑**。
//   ⚠️ 而且**不许拿 `unavailable` 去表示「这不归我」**：那个分支的意思是
//     「**我去拿了、没拿到**（并说得出为什么）」，而「不归我」是**没有这一条** ⇒ **空数组** ✓。
import fs from "node:fs";
import path from "node:path";
import {
  auditAssetSpec, parseAssetPack, parseDrawList, parseRecipe,
  type AssetPackEntry, type AssetPackManifest, type AssetSpec, type DrawList, type JudgementResult,
  type QAFinding, type QaContext, type QaFamilyResult, type QaFamilyRunner,
} from "@game-maker/contracts";

/** ⚠️ 坏 JSON 要说得清**是哪一样东西、哪个文件**（`JSON.parse` 的原话里只有后者）。 */
const read = (p: string, what: string): unknown => {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); }
  catch (e) { throw new Error(`${what}读不出来或不是 JSON：${p} —— ${(e as Error).message}`); }
};

/** 一条判据跑完的结果。⚠️ **空数组 = 通过**（「成功」不是一个变体，是这个数组空着 —— 票 06 §三）。 */
const ran = (findings: QAFinding[]): JudgementResult => ({ ran: true, findings });

/**
 * **视觉族**的 `QaFamilyRunner`（本包的第一份实现）。
 *
 * ⚠️ 它**只声明自己那两条**、**只返回不落盘**：写 `run/v<N>/qa-report.json` 的
 *   （以及把三族凑成一份的）是装配那一侧（票 15 的 Q3 · 票 20）。
 * ⚠️ 它读的三样都在 `ctx` 指着的路径上：`ctx.recipePath` · `packDir/manifest.json` ·
 *   包内那些创作态 drawlist（`manifest.assets[].authoring[]` 指着）✓。
 *   ⚠️ **清单的路径由调用方给、本族不自己拼**（票 19 的 Q11）——那九个文件名的家是
 *     `pipeline` 的 `RUN_ARTIFACT`，而本包的白名单只有 `contracts`。
 */
export const visualQaRunner: QaFamilyRunner = async (ctx: QaContext): Promise<QaFamilyResult> => {
  const recipe = parseRecipe(read(ctx.recipePath, "清单"));
  if (!recipe.ok) throw new Error(`清单读不回来或不过契约：${recipe.errors.slice(0, 4).join("；")}`);
  const manifest = parseAssetPack(read(path.join(ctx.packDir, "manifest.json"), "包清单"));
  if (!manifest.ok) throw new Error(`包清单读不回来或不过契约：${manifest.errors.slice(0, 4).join("；")}`);

  // ⚠️ **只放自己那两条**（其余四条缺席 = 不归我，见文件头四）。
  return {
    judgements: {
      "constructive-constraint": constructiveConstraint(recipe.value.assets, manifest.value, ctx.packDir),
      "palette-binding": paletteBinding(manifest.value)
    },
    // ⚠️ **观察那一栏空着**（见文件头五）。
    observations: []
  };
};

/**
 * **构造性约束**（票 06 定的名字：尺寸 · 锚点 · 九宫格）。
 *
 * ⚠️ **一行业务判断都不重写**：逐资产调 `auditAssetSpec`（住 contracts ✓）——
 *   它才是「需求 vs 产物」**唯一**的那个对账点。
 * ⚠️ **逐资产调**（而不是整包一次）是故意的：那个函数把资源 id 拼进文案里，而 QA 的 `target`
 *   要的是**账的词汇**里的那个 id ⇒ 逐条调才知道每条属于谁。
 * ⚠️ 而它自带的那句「资源 "x"：」前缀**不去剥**（剥字符串比多几个字更脆）。
 */
function constructiveConstraint(assets: readonly { spec: AssetSpec }[], manifest: AssetPackManifest, packDir: string): JudgementResult {
  const findings: QAFinding[] = [];
  for (const { spec } of assets) {
    const entry = manifest.assets.find((a) => a.id === spec.id);
    if (entry === undefined) {
      findings.push({ target: spec.id, severity: "error",
        detail: `清单里有 "${spec.id}"，包里**没有** —— ⚠️ 这个资源没被做出来（而清单是这一次运行的输入）` });
      continue;
    }
    for (const message of auditAssetSpec(spec, entry, drawlistsOf(packDir, entry)))
      findings.push({ target: spec.id, severity: "error", detail: message });
  }
  return ran(findings);
}

/** 这个资产的创作态 drawlist —— 给了，`auditAssetSpec` 就顺带核对**每份的 `viewBox` 与声明尺寸** ✓。
 *  ⚠️ 文件不在就跳过（那是 checksum / `verify` 的事，票 24 —— 这里不重复报）。 */
function drawlistsOf(packDir: string, entry: AssetPackEntry): DrawList[] {
  const out: DrawList[] = [];
  for (const a of entry.authoring) {
    if (a.kind !== "drawlist") continue;
    const p = path.join(packDir, a.ref);
    if (!fs.existsSync(p)) continue;
    const d = parseDrawList(read(p, "那份 drawlist"));
    if (d.ok) out.push(d.value);
  }
  return out;
}

/**
 * **色板绑定四值自洽**（票 36 定这个名字的时候，说的就是「自洽」）。
 *
 * ⚠️ **扫不了像素**（PNG 解码器住 `assets`，本包够不着）⇒ 这里做的是**报表级的对账**：
 *   包里**两处**都在说「这个资产的颜色与色板是什么关系」——
 *     · 逐资产的 `AssetPackEntry.paletteBinding`（声明在**条目**上）
 *     · 包级的 `palette.coverage` 那四个数（**逐资产**数出来的）
 *   ⇒ 它们是同一件事的两种说法，**对不上就有一个在说谎** —— 而那正是这条判据的理由
 *     （`qa.ts` 的原话：「报错了，下游读到的是**假的**」）。
 * ⚠️ **不重算**那四个数（那是 `pack` 的活）：对账的是**声明**与**包的事实** ✓。
 * ⚠️ 另一条是同一族的「声明的意思」：那份色板**在包里**（`palette.ref` 可能带一个 JSON 指针片段，
 *   如 `authoring/stylespec.json#/palette` ⇒ 只取路径那半 ✓）。
 * ⚠️ **`palette.size == values.length` 故意不在这里**：那是 **manifest 契约自己的 `superRefine`**
 *   已经守住的（而 `parseAssetPack` 先跑）—— 再写一遍就是**一条永远绿的判据**
 *   （写测试时当场撞出来的：拿一份 `size` 对不上的 manifest 去喂，先炸的是契约 ✓）。
 * ⚠️ **不查「`unbound` 必须为 0」**：那是 `pack` 今天的行为（票 13 量到的），不是契约 ——
 *   把它写成判据就是把「今天如此」冻成「必须如此」。
 */
function paletteBinding(manifest: AssetPackManifest): JudgementResult {
  const findings: QAFinding[] = [];
  const cover = manifest.palette.coverage;
  const counted: Record<keyof typeof cover, number> = { exact: 0, composited: 0, quantized: 0, unbound: 0 };
  for (const a of manifest.assets) counted[a.paletteBinding] += 1;
  for (const k of ["exact", "composited", "quantized", "unbound"] as const)
    if (counted[k] !== cover[k])
      findings.push({ target: "recipe", severity: "error",
        detail: `\`palette.coverage.${k}\` 说是 ${cover[k]}，而资产里标着 \`paletteBinding: "${k}"\` 的有 ${counted[k]} 个` +
          " —— ⚠️ 这两处**说的是同一件事**（一个声明在条目上、一个是数出来的）：对不上就有一个在说谎，而下游读到的是**假的**" });

  const refPath = manifest.palette.ref.split("#")[0]!;
  if (!manifest.files.some((f) => f.path === refPath))
    findings.push({ target: "recipe", severity: "error",
      detail: `\`palette.ref\` 指的那份色板不在 \`files[]\` 里（"${refPath}"）—— ⚠️ 那意味着它**在 checksum 覆盖之外**` });

  return ran(findings);
}
