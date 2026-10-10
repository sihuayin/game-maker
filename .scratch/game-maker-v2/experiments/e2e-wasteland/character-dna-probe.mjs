// 票 23 的探针 ⑥（2026-10-10）：`character-dna` 那 3 发同因，到底是「系统性」还是「手气差」。
//
// 已确立的事实（第五次真跑 · `raw/run-2026-10-10b.json`）：理解层第 4 步 `character-dna`
// **3 发重采样全灭**，病因**三次一模一样**：`characters[2].id: 角色 id 重复："scavenger"`。
// 跨跑看它**不总是翻车**（第三跑两侧都 `attempts: 1` 一次过）⇒ n=1 判不了 —— 与探针 ⑤ 之前的处境一样。
//
// ⚠️ **读输入时发现的一件事，先记在这里**：第五跑那份 `game-design.json` 里
//     `player.id = "scavenger"` 而 `npcs[0].id` **也是** `"scavenger"` ——
//     两份**不同的数组**里各有一条，彼此同名。而 `character-dna` 被要求「每个角色实体一条」
//     （票 04 Q3 / 票 31 Q2），于是**必然**产出两条同 id ⇒ 必然撞 `character-dna.ts:166` 那道闸。
//     ⇒ 这解释了「为什么 3 发**同因**」，但**没有回答**「重试还有没有活路」：
//        如果模型**有时会自己把重复的两条合并成一条**，那这一发就有非零通过率，重跑仍有意义。
//     **那就是本探针要量的东西。**
//
// 做法（照 `palette-shape-probe.mjs`，一字不改）：
//   ① 借**出货的 `compileCharacterDna`** 造出与链上**逐字节相同**的请求体 ——
//      ⚠️ 抓包用的 `fetchImpl` **直接抛** ⇒ 造这一步**零上游调用**。
//      ⚠️ 输入用**第五跑保下来的那三份**（`.failed-*/game-design.json` + `visual-world.json`），
//         也就是**真的把链跑死的那一份输入**，不是第三跑的。
//   ② 原样**重放 N 次**，逐发看：吐了几条角色 / id 是什么 / 有没有重复 / 过没过闸。
//
// ⚠️ 本探针**只取证**：不改任何生产规则、不改契约、不改提示词（人类 2026-10-10 的明令）。
//
// 跑法：node .scratch/game-maker-v2/experiments/e2e-wasteland/character-dna-probe.mjs [失败现场目录]
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const HERE = import.meta.dirname;
const ROOT = path.resolve(HERE, "../../../..");
const RAW = path.join(HERE, "raw", "character-dna");
// 失败现场：默认取第五跑留下的那一份（那是把链跑死的输入）
const defDir = path.join(HERE, "raw", "run-out-2026-10-10b");
const SCENE = process.argv[2]
  ?? fs.readdirSync(defDir).map((d) => path.join(defDir, d)).find((p) => path.basename(p).startsWith(".failed-"));
if (SCENE === undefined || !fs.existsSync(SCENE)) { console.error("找不到失败现场目录（把路径作为第一个参数给它）"); process.exit(2); }
fs.rmSync(RAW, { recursive: true, force: true });
fs.mkdirSync(RAW, { recursive: true });

const N = process.env["PROBE_DRY"] === "1" ? 0 : 6;
const BASE = process.env["ANTHROPIC_BASE_URL"];
const TOKEN = process.env["ANTHROPIC_AUTH_TOKEN"];
const MODEL = process.env["ANTHROPIC_MODEL"] ?? "(未设)";

const { compileCharacterDna } = await import(pathToFileURL(path.join(ROOT, "packages/game-design/dist/index.js")).href);
const { buildCharacterDna } = await import(pathToFileURL(path.join(ROOT, "packages/game-design/dist/index.js")).href);
const C = await import(pathToFileURL(path.join(ROOT, "packages/contracts/dist/index.js")).href);

const design = JSON.parse(fs.readFileSync(path.join(SCENE, "game-design.json"), "utf8"));
const vws = JSON.parse(fs.readFileSync(path.join(SCENE, "visual-world.json"), "utf8"));

// ── 先把「该有几个角色 / 输入里有没有同名」摆出来（这是纯读输入，不花钱）────────
const want = [
  ...(design.player ? [{ where: "player", id: design.player.id }] : []),
  ...(design.enemies ?? []).map((e) => ({ where: "enemies", id: e.id })),
  ...(design.npcs ?? []).map((e) => ({ where: "npcs", id: e.id })),
];
console.log(`输入（第五跑保下来的现场）：${path.relative(ROOT, SCENE)}`);
console.log(`  ⇒ 输入里**应有 ${want.length} 个角色实体**：${want.map((w) => `${w.where}:${w.id}`).join(" · ")}`);
const clash = want.map((w) => w.id).filter((id, i, a) => a.indexOf(id) !== i);
console.log(`  ⇒ 输入里**本来就重名**的 id：${clash.length === 0 ? "（无）" : clash.map((c) => `"${c}"`).join(" · ")}`);

// ── ① 造请求体（零上游调用）───────────────────────────────────────────────────
let captured;
try {
  await compileCharacterDna({
    design, vws,
    transport: { baseUrl: BASE, apiKey: TOKEN },
    fetchImpl: async (_u, init) => { captured = init.body; throw new Error("capture-only（本探针不发这一次）"); },
  });
} catch { /* 预期：抓完就抛 */ }
if (captured === undefined) throw new Error("没抓到请求体 —— compileCharacterDna 的构造路径变了？");
fs.writeFileSync(path.join(RAW, "01.request.json"), captured);

console.log(`\n模型 ${MODEL} · 上游 ${BASE}`);
console.log(`请求体已抓：${captured.length} 字节（与链上那一份逐字节相同）`);
console.log(`重放 N=${N}\n`);

const TOOL = C.CHARACTER_DNA_TOOL_NAME ?? "emit_character_dna";
const summary = { 角色条数: {}, id组合: {}, 过闸: { ok: 0, bad: 0 }, 病由: {}, 逐发: [] };

for (let i = 1; i <= N; i++) {
  const res = await fetch(`${BASE}/v1/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": TOKEN, "anthropic-version": "2023-06-01" },
    body: captured,
  });
  const txt = await res.text();
  fs.writeFileSync(path.join(RAW, `02.replay.${i}.json`), txt);

  let doc;
  try { doc = JSON.parse(txt); } catch { summary.逐发.push({ i, 上游: "非 JSON" }); console.log(`  ${i}. 上游回的不是 JSON`); continue; }
  const input = doc.content?.find?.((c) => c.type === "tool_use")?.input;

  // 契约那一关（与 `onceThrough` 里的 `parseToolUse` 同一份 schema）
  const parsed = C.parseToolUse(doc, TOOL, C.CharacterDNAFileSchema);
  const chars = (parsed.ok ? parsed.value : input)?.characters ?? [];
  const ids = chars.map((c) => c.id);

  // 装配那一关（含 `character-dna.ts:166` 的「角色 id 重复」）
  let built = { ok: false, detail: "" };
  try { built = buildCharacterDna({ fromModel: input, design, vws }); } catch (e) { built = { ok: false, detail: String(e?.message ?? e) }; }

  const nKey = String(chars.length);
  summary.角色条数[nKey] = (summary.角色条数[nKey] ?? 0) + 1;
  const idKey = ids.join(",");
  summary.id组合[idKey] = (summary.id组合[idKey] ?? 0) + 1;

  const pass = parsed.ok && built.ok;
  let why = "";
  if (pass) summary.过闸.ok += 1;
  else {
    summary.过闸.bad += 1;
    why = parsed.ok ? built.detail : parsed.detail;
    why = String(why).slice(0, 160);
    summary.病由[why] = (summary.病由[why] ?? 0) + 1;
  }
  summary.逐发.push({ i, 角色条数: chars.length, ids, 过闸: pass, 病由: why });
  console.log(`  ${i}. 角色 ${chars.length} 条 [${ids.join(", ")}]  过闸=${pass ? "✅" : "❌ " + why}`);
}

fs.writeFileSync(path.join(RAW, "summary.json"), JSON.stringify(summary, null, 1));
console.log(`\n=== 汇总 ===`);
console.log(`角色条数分布 ：${JSON.stringify(summary.角色条数)}`);
console.log(`id 组合分布  ：${JSON.stringify(summary.id组合, null, 0)}`);
console.log(`过闸         ：${JSON.stringify(summary.过闸)}`);
console.log(`\n原始落在 ${path.relative(ROOT, RAW)}/`);
