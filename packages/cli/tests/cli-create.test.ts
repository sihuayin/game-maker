// `create` / `build` 那两段（票 16）。
//
// ⚠️ 这一份钉的是**壳那一侧的全部业务**：`--intent` 的判别 · 检查点停/续 · 两条路的**产物等价** ·
//   以及那几条新 flag。链本身（世界/意图/设计/基因/清单/包/配置）由票 15 的测试盯着，
//   这里用**同一套假上游**把它串起来（见下面那条越层 import 的注释）。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { EXIT, encodePNG } from "@game-maker/assets";
import { run, type CliIo, type CliDeps } from "../src/cli.js";
const ROOT = fileURLToPath(new URL("../../../", import.meta.url));

// ── 假上游 ──────────────────────────────────────────────────────────────────
// ⚠️ **骨架数据住在 `fixtures/upstream/canned.json`**（与 `pipeline/tests/upstream.ts` **同一份**）：
//   跨包的 TS import 过不了 `rootDir`（`tsc -p tsconfig.spec.json` 报 TS6059 —— 试过），
//   所以数据走**运行时读的 JSON**、逻辑各留一份。**会漂的那部分因此只有一处。**
const CANNED = JSON.parse(fs.readFileSync(path.join(ROOT, "fixtures/upstream/canned.json"), "utf8")) as Record<string, Record<string, unknown>>;

/** 一条假 `fetch`：理解层那五发按 `tool_choice.name` 回骨架；drawlist 那一支回一段 JSON 文本。 */
function fakeUpstream(over: { recipeId: string; intent?: Record<string, unknown> }): typeof fetch {
  const TOOL: Record<string, unknown> = {
    emit_visual_world: CANNED["visualWorld"], emit_game_intent: over.intent ?? CANNED["intent"],
    emit_game_design: CANNED["design"], emit_character_dna: CANNED["characterDna"],
    emit_game_config: CANNED["gameConfig"],
  };
  const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) }) as Response;
  return (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    if (body["tools"] === undefined) {
      const content = (body["messages"] as { content: unknown }[])[0]!.content;
      const text = typeof content === "string" ? content : "";
      const n = Math.max(1, (text.match(/第 \d+ 帧：/g) ?? []).length);
      // ⚠️ 画满整帧（站点那一族有「最远那层必须画满」，票 50）
      return json({ content: [{ type: "text", text: JSON.stringify({ frames: Array.from({ length: n }, () => ({ ops: [{ op: "rect", x: 0, y: 0, w: 4096, h: 4096, fill: "palette:0" }] })) }) }], model: "deepseek-flash" });
    }
    const name = (body["tool_choice"] as { name: string }).name;
    const input = name === "emit_asset_recipe" ? { ...CANNED["recipe"], id: over.recipeId } : TOOL[name];
    return json({ content: [{ type: "tool_use", name, input }], stop_reason: "tool_use", model: "deepseek-flash", usage: { input_tokens: 1200, output_tokens: 900 } });
  }) as unknown as typeof fetch;
}

/** 一张真的小 PNG（参考图那一格要能解码）。 */
function tinyPng(w = 8, h = 8): Buffer {
  const data = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) { data[i * 4] = 255; data[i * 4 + 1] = 0; data[i * 4 + 2] = 255; data[i * 4 + 3] = 255; }
  return encodePNG({ width: w, height: h, data });
}
const dirs: string[] = [];
afterAll(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }); });

const capture = (): CliIo & { lines: string[]; errors: string[] } => {
  const lines: string[] = [], errors: string[] = [];
  return { lines, errors, out: (s) => lines.push(s), err: (s) => errors.push(s) };
};

/**
 * 一次 `create` 的完整环境。
 *
 * ⚠️ `cwd` 用**仓库根**：站点那一步要外壳 bundle（`packages/demo/dist/shell.js`），
 *   而 `defaultShellPath(cwd)` 按 cwd 找它 —— 与 `site` 命令同款（真实用户从仓库根跑，
 *   或者用 `--shell` 指过去）。⇒ 几张输入路径都写绝对的。
 */
function stage() {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "gm-cli-create-"));
  dirs.push(cwd);
  const style = path.join(cwd, "style.png");
  const intent = path.join(cwd, "需求.md");
  fs.writeFileSync(style, tinyPng());
  fs.writeFileSync(intent, "做一个废土横版寻宝游戏\n第二行\n");
  const deps: CliDeps = {
    fetchImpl: fakeUpstream({ recipeId: "wasteland" }),
    env: { ANTHROPIC_BASE_URL: "http://up.test", ANTHROPIC_AUTH_TOKEN: "k" },
    cwd: ROOT,
  };
  return { cwd, outRoot: path.join(cwd, "out"), deps, style, intent };
}
const runC = async (argv: string[], deps: CliDeps) => {
  const io = capture();
  return { code: await run(argv, io, deps), io, text: () => io.lines.join("") + io.errors.join("") };
};
const jsonOf = (io: { lines: string[] }) => JSON.parse(io.lines.join("")) as { data?: Record<string, unknown> };
const create = (s: ReturnType<typeof stage>, extra: string[] = []) =>
  ["create", "--style", s.style, "--intent", s.intent, "--out", s.outRoot, ...extra];
const jread = (p: string) => JSON.parse(fs.readFileSync(p, "utf8")) as Record<string, unknown>;

describe("§`--intent` 收两种东西（票 16 的 Q3；票 09 定的方向）", () => {
  it("裸文本 ⇒ 原样进 `intent.md`（**逐字节**，含换行与行尾空格）", async () => {
    const s = stage();
    const text = "做一个废土横版寻宝游戏\n第二行带着空格  \n";
    const r = await runC(["create", "--style", s.style, "--intent", text, "--out", s.outRoot], s.deps);
    expect(r.code).toBe(EXIT.ok);
    expect(fs.readFileSync(path.join(s.outRoot, "wasteland", "run", "v1", "intent.md"), "utf8")).toBe(text);
  });

  it("`.md` 路径存在 ⇒ **读那个文件**（逐字节）", async () => {
    const s = stage();
    const r = await runC(create(s), s.deps);
    expect(r.code).toBe(EXIT.ok);
    expect(fs.readFileSync(path.join(s.outRoot, "wasteland", "run", "v1", "intent.md"), "utf8"))
      .toBe("做一个废土横版寻宝游戏\n第二行\n");
  });

  it("⚠️ 像路径而**文件不存在** ⇒ 参数错（2），而不是把它当需求喂给模型", async () => {
    const s = stage();
    const r = await runC(["create", "--style", s.style, "--intent", path.join(s.cwd, "没这个文件.md"), "--out", s.outRoot], s.deps);
    expect(r.code).toBe(EXIT.usage);
    expect(r.text()).toMatch(/看起来是一个路径/);
    expect(fs.existsSync(path.join(s.outRoot, "wasteland"))).toBe(false);   // 一个字节都没落
  });

  it("⚠️ 含路径分隔符的**文本**也当路径（判别是一条死线，不猜）", async () => {
    const s = stage();
    expect((await runC(["create", "--style", s.style, "--intent", "横版/寻宝", "--out", s.outRoot], s.deps)).code).toBe(EXIT.usage);
  });
});

describe("§检查点：不带 `--yes` 就停在清单处（票 16 的 Q1/Q2/Q8）", () => {
  it("退出码 **0**（这一步是成功的），而 `status` 说得出「还等着你」", async () => {
    const s = stage();
    const r = await runC(create(s, ["--json"]), s.deps);
    expect(r.code).toBe(EXIT.ok);
    const d = jsonOf(r.io).data!;
    expect(d["status"]).toBe("awaiting");
    expect(d["imageAssetCount"]).toBe(0);            // 夹具那份清单全是 drawlist ⇒ 下一步不花钱
    expect(String(d["runDir"])).toBe("wasteland/run/v1");
    expect(fs.existsSync(path.join(s.outRoot, "wasteland", "pack"))).toBe(false);   // 停住了
    expect(fs.existsSync(path.join(s.outRoot, "wasteland", "site"))).toBe(false);
  });

  it("人看的输出里：清单摘要 · 生图条数 · 下一步那条命令", async () => {
    const s = stage();
    const t = (await runC(create(s), s.deps)).text();
    expect(t).toMatch(/清单：\d+ 个资源/);
    expect(t).toMatch(/没有生图资源|要走生图/);
    expect(t).toMatch(/game-maker build wasteland\/run\/v1/);
  });

  it("⚠️ **`ambiguity` 逐条打出来**（票 03 把那个字段的存亡押在这一票上）——`--yes` 时也打", async () => {
    const s = stage();
    // 一份**带 `ambiguity`** 的意图（骨架数据在 `fixtures/upstream/canned.json` 里）
    const fetchImpl = fakeUpstream({
      recipeId: "wasteland",
      intent: { ...CANNED["intent"], ambiguity: ["camera：需求没提，暂按横版默认"] },
    });

    // ① 停在检查点时打
    const stopped = await runC(create(s), { ...s.deps, fetchImpl });
    expect(stopped.text()).toMatch(/用户没说清的地方[\s\S]*camera：需求没提/);
    // ② `--yes` 跳过检查点**也打**（那两条之一）
    const s2 = stage();
    const yes = await runC(create(s2, ["--yes"]), { ...s2.deps, fetchImpl });
    expect(yes.code).toBe(EXIT.ok);
    expect(yes.text()).toMatch(/用户没说清的地方[\s\S]*camera：需求没提/);
  });
});

describe("§`--yes`：一路跑到站点（票 16 的 Q6），三条产物**同一个 N**", () => {
  it("run / pack / site 都是 v1，且 `status = complete`", async () => {
    const s = stage();
    const r = await runC(create(s, ["--yes", "--json"]), s.deps);
    expect(r.code).toBe(EXIT.ok);
    const d = jsonOf(r.io).data!;
    expect(d["status"]).toBe("complete");
    expect(d["runVersion"]).toBe(1);
    expect(d["packVersion"]).toBe(1);
    expect(String(d["siteDir"])).toBe("wasteland/site/v1");    // ⚠️ 父指定的那个 N
    expect(fs.existsSync(path.join(s.outRoot, "wasteland", "pack", "v1", "manifest.json"))).toBe(true);
    expect(fs.existsSync(path.join(s.outRoot, "wasteland", "site", "v1", "index.html"))).toBe(true);
  });

  it("⚠️ 而站点的 N 是**父给的**、不是它自己数的：先摆一个 `site/v9`，产物仍然落在 `site/v1`", async () => {
    const s = stage();
    // 先占一个**更高的**版本号：父指定 ⇒ 仍然是 v1（run 是 v1）；站点自己数 ⇒ 会跳到 v10
    fs.mkdirSync(path.join(s.outRoot, "wasteland", "site", "v9"), { recursive: true });
    fs.writeFileSync(path.join(s.outRoot, "wasteland", "site", "v9", "占位.txt"), "x");
    const r = await runC(create(s, ["--yes", "--json"]), s.deps);
    expect(r.code, r.text()).toBe(EXIT.ok);
    expect(String(jsonOf(r.io).data!["siteDir"])).toBe("wasteland/site/v1");
  });
});

describe("§⚠️ **两条路的产物等价**（票 16 的 Q9*）", () => {
  it("`create --yes` 与「`create` 停住 → 人看 → `build`」：同一批相对路径 + 同一份字节", async () => {
    // ⚠️ 包清单里有 `createdAt`（从 `SOURCE_DATE_EPOCH` 或**当前秒**推）⇒ 把时钟钉死，
    //   否则「字节等价」这条判据会栽在时间戳上（那不是它要测的东西）。
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-10-08T00:00:00Z"));
    const a = stage();
    const ra = await runC(create(a, ["--yes", "--json"]), a.deps);
    expect(ra.code).toBe(EXIT.ok);
    const ja = jsonOf(ra.io).data!;

    const b = stage();
    const rb1 = await runC(create(b, ["--json"]), b.deps);
    expect(rb1.code).toBe(EXIT.ok);
    const runDir = String(jsonOf(rb1.io).data!["runDir"]);
    const rb2 = await runC(["build", path.join(b.outRoot, runDir), "--out", b.outRoot, "--json"], b.deps);
    expect(rb2.code).toBe(EXIT.ok);
    const jb = jsonOf(rb2.io).data!;

    for (const k of ["runDir", "packDir", "config", "siteDir", "entry", "runVersion", "packVersion"])
      expect(jb[k], `两段式的 ${k}`).toEqual(ja[k]);

    const rd = (root: string, rel: string) => fs.readFileSync(path.join(root, rel), "utf8");
    expect(rd(b.outRoot, String(jb["packDir"]) + "/manifest.json"))
      .toBe(rd(a.outRoot, String(ja["packDir"]) + "/manifest.json"));
    expect(rd(b.outRoot, String(jb["config"]))).toBe(rd(a.outRoot, String(ja["config"])));
    vi.useRealTimers();
  });
  afterEach(() => vi.useRealTimers());

  it("⚠️ 而 `build` 用的是**磁盘上那一份**清单：中间改了它，产物跟着变（票 15 的 invariant 3 在壳这一层）", async () => {
    const s = stage();
    expect((await runC(create(s), s.deps)).code).toBe(EXIT.ok);
    const recipePath = path.join(s.outRoot, "wasteland", "run", "v1", "asset-recipe.json");
    const doc = jread(recipePath) as { assets: unknown[] };
    // ⚠️ **加**一条（不是删）：删掉 `ui-hud` / `ui-pip` 会让配置编译器解不到引用 —— 那**是对的**行为，
    //   而这一条要测的是「壳有没有把**磁盘上那一份**交给构建段」。
    fs.writeFileSync(recipePath, JSON.stringify({
      ...doc,
      assets: [...doc.assets, { spec: { kind: "sprite", id: "crate-added", role: "人手加的箱子", description: "人手加的", styleId: "halt-dusk", anchor: { x: 0.5, y: 1 }, size: { w: 16, h: 16 }, required: true }, source: { kind: "drawlist" } }],
    }, null, 2) + "\n");
    const r = await runC(["build", path.join(s.outRoot, "wasteland", "run", "v1"), "--out", s.outRoot], s.deps);
    expect(r.code, r.text()).toBe(EXIT.ok);
    const manifest = jread(path.join(s.outRoot, "wasteland", "pack", "v1", "manifest.json")) as { assets: { id: string }[] };
    expect(manifest.assets.map((a) => a.id)).toContain("crate-added");
  });
});

describe("§退出码：理解层那两档（票 16 的 Q3(b)）", () => {
  it("⚠️ 「模型三发都没吐出一份过契约的文书」⇒ **4**（不是 1）—— 与 `plan`/`pack` 同档", async () => {
    const s = stage();
    // 一条「每次都不给工具入参」的假上游（票 27 记过的那一档：代理把入参丢了）
    const empty: typeof fetch = (async () => ({ ok: true, status: 200, json: async () => ({ content: [{ type: "tool_use", name: "emit_visual_world", input: {} }], stop_reason: "tool_use", model: "deepseek-flash" }), text: async () => "" }) as unknown as Response) as never;
    const r = await runC(create(s), { ...s.deps, fetchImpl: empty });
    expect(r.code).toBe(EXIT.invalid);          // 4，不是 1
    expect(r.text()).toMatch(/重采样/);
  });

  it("⚠️ **R12 的拒绝**也走 4（而文案说的是「做不出来」，不是「模型没干好」）", async () => {
    const s = stage();
    // 意图里多要一条外壳做不了的机制 ⇒ 设计层填不出来 ⇒ 拒绝
    const fetchImpl = fakeUpstream({
      recipeId: "wasteland",
      intent: { ...CANNED["intent"], mechanics: [{ id: "m-jump", name: "跳跃" }, { id: "m-nope", name: "分身术" }] },
    });
    const r = await runC(create(s), { ...s.deps, fetchImpl });
    expect(r.code).toBe(EXIT.invalid);
    expect(r.text()).toMatch(/m-nope|做不出来/);
  });
});

describe("§参数面：几条硬线（票 16 的 Q4/Q5）", () => {
  it("⚠️ `--style` 给两次 ⇒ 参数错（否则第一张被**静默**丢掉）", async () => {
    const s = stage();
    const r = await runC(["create", "--style", s.style, "--style", "b.png", "--intent", s.intent, "--out", s.outRoot], s.deps);
    expect(r.code).toBe(EXIT.usage);
    expect(r.text()).toMatch(/给了两次/);
    expect(r.text()).toMatch(/票 26/);
  });

  it("缺 `--style` / 缺 `--intent` / `build` 缺那个 run 目录 ⇒ 都是参数错（2）", async () => {
    const s = stage();
    expect((await runC(create(s, []).slice(0, 2), s.deps)).code).toBe(EXIT.usage);
    expect((await runC(create(s, []).slice(0, 4), s.deps)).code).toBe(EXIT.usage);
    expect((await runC(["build"], s.deps)).code).toBe(EXIT.usage);
  });

  it("`pack --version` 不是整数 ⇒ 参数错（那个 flag 是「父指定」的手动口）", async () => {
    const s = stage();
    const r = await runC(["pack", "--recipe", ROOT + "fixtures/recipes/shift-change.json", "--version", "abc", "--out", s.outRoot], s.deps);
    expect(r.code).toBe(EXIT.usage);
    expect(r.text()).toMatch(/--version 必须是/);
  });

  it("⚠️ `pack --version 7` ⇒ 落在 `pack/v7`（**给了就不自算** —— 票 15 的 Q16/Q17）", async () => {
    const s = stage();
    // 用一次 create 落下来的那份清单（它旁边就带着 stylespec.json）—— 别拿 `fixtures/` 里那份：
    // 它的 `styleRef` 指向 `authoring/stylespec.json`，而那个文件不在 `fixtures/recipes/` 里。
    expect((await runC(create(s), s.deps)).code).toBe(EXIT.ok);
    const recipe = path.join(s.outRoot, "wasteland", "run", "v1", "asset-recipe.json");
    const r = await runC(["pack", "--recipe", recipe, "--version", "7", "--out", s.outRoot], s.deps);
    expect(r.code, r.text()).toBe(EXIT.ok);
    expect(fs.existsSync(path.join(s.outRoot, "wasteland", "pack", "v7", "manifest.json"))).toBe(true);
  });

  it("`--help` 里看得到这两条新命令（且 `--help` 本身是成功）", async () => {
    const s = stage();
    const r = await runC(["--help"], s.deps);
    expect(r.code).toBe(EXIT.ok);
    expect(r.text()).toMatch(/game-maker create --style/);
    expect(r.text()).toMatch(/game-maker build/);
  });
});
