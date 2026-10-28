import { copyFileSync, cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { EXIT, encodePNG, exitCodeOfError, CommandError } from "@game-maker/assets";
import { ASSET_PACK_FORMAT, parseAnimationAcceptance } from "@game-maker/contracts";
import { parseArgs, concurrencyFromFlags, renderHuman, run, type CliIo } from "../src/cli.js";

/** 收下 CLI 的所有出站，测试因此不会把 stdout 刷满。 */
const capture = (): CliIo & { lines: string[]; errors: string[] } => {
  const lines: string[] = [], errors: string[] = [];
  return { lines, errors, out: (s) => lines.push(s), err: (s) => errors.push(s) };
};
const runC = (argv: string[]) => { const io = capture(); return run(argv, io).then((code) => ({ code, io })); };

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));

/** 一份包是不是**用当前契约构建的**。 */
const isCurrent = (dir: string) => {
  try { return JSON.parse(readFileSync(dir + "/manifest.json", "utf8")).format === ASSET_PACK_FORMAT; }
  catch { return false; }
};

// ⚠️ 不写死版本号：包是逐版新增的（票 24 永不覆盖），写死 v5 会在下一次构建后指向一个旧契约的包。
const SCRATCH = (() => {
  const base = ROOT + "out/shift-change-assets/pack";
  try {
    const vs = readdirSync(base).map((d) => /^v(\d+)$/.exec(d)).filter((m) => m !== null).map((m) => Number(m![1])).sort((a, b) => b - a);
    return vs.length > 0 ? `${base}/v${vs[0]}` : `${base}/v0`;
  } catch { return `${base}/v0`; }
})();

// ⚠️ **门槛是「有一份用当前契约构建的真实包」，不只是「有一个包」**（2026-10-13 · 票 45）。
//   `out/` 是**本机垃圾场**（`.gitignore:10`，未入库），而包**逐版新增、永不覆盖**
//   ⇒ 契约一升版，盘上**最近那一份**当场变成**旧契约**的包。那不是回归，是**输入过期** ——
//   而这一组的主题恰恰是「CLI 在一份**当前**的包上怎么表现」。实测（票 45）：升到
//   `assetpack/v3` 当天，只判存在会让本机 **3 条**判据变红（`inspect` / `verify` 在 v1 包上
//   按契约拒 → 退 4）。
//   ⚠️ 而本机那份**不会自己变新**（重建要真跑管线 = 花钱）⇒ 只判存在的话，这一组会在本机
//   **永久 skip**，而本仓的尺子是「**一条从没被执行过的规矩等于没有**」。所以**回落到入库的
//   fixture 包**（`fixtures/packs/counter-siege/v4`，票 45 已迁到 v3）—— 它同样是**真包、真
//   checksum**，且**清检出上也在** ⇒ 这一组从「有本机包才跑」变成**每次都跑**。
//   ⚠️ 本机那份**真跑出来的**包优先（它的价值是「一次真运行的原样产物」），但**只在它是当前契约时**。
const PACK = isCurrent(SCRATCH) ? SCRATCH : ROOT + "fixtures/packs/counter-siege/v4";
// ⚠️ 留着这层 skip 只是**兜底**（fixture 被挪走/删了）—— 正常路径下它**不再是**那扇门。
const hasPack = isCurrent(PACK);

describe("参数解析（手写，无依赖）", () => {
  it("子命令 + 带值选项 + 布尔开关", () => {
    const p = parseArgs(["plan", "--design", "d.json", "--visual-world", "w.json", "--json"]);
    expect(p.command).toBe("plan");
    expect(p.flags).toMatchObject({ design: "d.json", "visual-world": "w.json", json: true });
  });
  it("位置参数与短选项", () => {
    expect(parseArgs(["inspect", "some/pack", "-h"]).positionals).toEqual(["some/pack"]);
    expect(parseArgs(["-h"]).flags.help).toBe(true);
  });
  it("⚠️ 带值选项后面缺值 → 报参数错，而不是把 undefined 当值", () => {
    expect(() => parseArgs(["pack", "--recipe"])).toThrow(/后面要跟一个值/);
  });
  it("playtest 接受 --scenario-dir，缺值报参数错（FA-01D）", () => {
    expect(parseArgs(["playtest", "g/run/v1", "--scenario-dir", "custom/scenarios"]).flags["scenario-dir"])
      .toBe("custom/scenarios");
    expect(() => parseArgs(["playtest", "g/run/v1", "--scenario-dir"])).toThrow(/后面要跟一个值/);
  });
});

describe("并发 flag 的语义（票 41 —— 「能独立控制 image concurrency」）", () => {
  // ⚠️ 这一组的期望值**全部手工写死**，不由被测函数推 —— 否则就是假牙。
  it("⚠️ **只给 `--concurrency-image` ⇒ 返回值里根本没有 `text` 键**（不是 2、也不是 4）", () => {
    const r = concurrencyFromFlags({ "concurrency-image": "2" });
    // 「没有 text 键」是**结构**上的断言：`{ text: 2 }` 会让 image 的并发被一个数拖住，
    // `{ text: 4 }` 会把默认值**写死进 CLI**（引擎才是默认值的唯一来源）。
    expect(r === undefined ? null : Object.keys(r)).toEqual(["image"]);
    expect(r).toEqual({ image: 2 });
  });
  it("`--concurrency <n>` 原义不变：两边都设成 n", () => {
    expect(concurrencyFromFlags({ concurrency: "2" })).toEqual({ text: 2, image: 2 });
  });
  it("两个都给 ⇒ 具体的那个赢：image 被覆盖，text 仍走 `--concurrency`", () => {
    expect(concurrencyFromFlags({ concurrency: "3", "concurrency-image": "2" })).toEqual({ text: 3, image: 2 });
  });
  it("两个都没给 ⇒ `undefined`（不给覆盖，而不是给一个空对象）", () => {
    expect(concurrencyFromFlags({})).toBeUndefined();
    expect(concurrencyFromFlags({ json: true })).toBeUndefined();
  });
  it("⚠️ 报错点名**给的那个 flag**（不是一律说 `--concurrency`）", () => {
    expect(() => concurrencyFromFlags({ "concurrency-image": "0" })).toThrow(/--concurrency-image 必须是 ≥1 的整数/);
    expect(() => concurrencyFromFlags({ "concurrency-image": "2.5" })).toThrow(/--concurrency-image/);
    expect(() => concurrencyFromFlags({ concurrency: "abc" })).toThrow(/--concurrency 必须是 ≥1 的整数/);
  });
  it("⚠️ `--concurrency-image` 在 `takesValue` 里 —— 否则 `2` 会掉成位置参数", () => {
    expect(parseArgs(["create", "--concurrency-image", "2"]).flags["concurrency-image"]).toBe("2");
    expect(parseArgs(["create", "--concurrency-image", "2"]).positionals).toEqual([]);
  });
});

describe("人类输出与 JSON 是**同一份数据**", () => {
  it("renderHuman 只渲染 summary + artifacts —— 没有第二套数据", () => {
    const r = { command: "pack", summary: ["甲", "乙"], data: { a: 1 }, artifacts: [{ path: "out/x", kind: "asset-pack" }] };
    expect(renderHuman(r)).toBe("甲\n乙\n→ out/x");
  });
});

describe("退出码", () => {
  it("错误类型 → 各自的码", () => {
    expect(exitCodeOfError(new CommandError("usage", "x"))).toBe(EXIT.usage);
    expect(exitCodeOfError(new CommandError("upstream", "x"))).toBe(EXIT.upstream);
    expect(exitCodeOfError(new CommandError("invalid", "x"))).toBe(EXIT.invalid);
    expect(exitCodeOfError(new Error("别的"))).toBe(EXIT.failure);
  });
  it("用法错 → 2；不认识的子命令 → 2", async () => {
    expect((await runC(["pack"])).code).toBe(EXIT.usage);
    expect((await runC(["frobnicate"])).code).toBe(EXIT.usage);
    expect((await runC([])).code).toBe(EXIT.usage);
  });
  it("--help → 0", async () => {
    expect((await runC(["--help"])).code).toBe(EXIT.ok);
  });
  it("verify 一个不存在的目录 → usage（不是 4）", async () => {
    expect((await runC(["verify", "/tmp/definitely-not-a-pack-xyz"])).code).toBe(EXIT.usage);
  });
});

describe.skipIf(!hasPack)("对真实包的三个操作", () => {
  it("inspect / verify 都返回 0", async () => {
    expect((await runC(["inspect", PACK])).code).toBe(EXIT.ok);
    expect((await runC(["verify", PACK])).code).toBe(EXIT.ok);
  });
  it("⚠️ 篡改一个文件后 verify **必须非 0** —— 第一版这里退的是 0", async () => {
    const { mkdtempSync, cpSync, readFileSync: rf, writeFileSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const path = (await import("node:path")).default;
    const dir = mkdtempSync(path.join(tmpdir(), "cli-verify-"));
    cpSync(PACK, dir, { recursive: true });
    const target = path.join(dir, "delivery", "atlas.sprites.png");
    const b = rf(target);
    const at = b.length - 20;                 // noUncheckedIndexedAccess 下要显式断言
    b[at] = b[at]! ^ 0xff;
    writeFileSync(target, b);
    expect((await runC(["verify", dir])).code).toBe(EXIT.invalid);
  });
});

describe("⚠️ 失败现场：CLI 要把它说给人（票 01）", () => {
  // ⚠️ 生图那条路一次失败就是几笔**已经付过钱**的调用，而原图与逐字提示词在失败那一刻
  //   就在磁盘上（一个一个落的）—— 现在改名留下，这里钉住**它真的被说出来了**。
  //
  // 造一份「第一件（import）已经落盘、第二件（drawlist）的上游挂掉」的配方：
  //   import 那一支**没有 await**，所以它的文件先落 ✓ 不必起桩服务器。
  const D = mkdtempSync(path.join(tmpdir(), "gm-cli-keep-"));
  const STYLE = JSON.parse(readFileSync(ROOT + ".scratch/game-creation-v1/experiments/style-transfer-from-test-png/stylespec.json", "utf8"));
  writeFileSync(path.join(D, "stylespec.json"), JSON.stringify(STYLE));
  copyFileSync(ROOT + "fixtures/reference/test.png", path.join(D, "src.png"));
  const spec = (id: string) => ({ kind: "sprite", id, role: id, description: `${id} 的东西`,
    styleId: "style-ref", anchor: { x: 0.5, y: 0.5 }, size: { w: 16, h: 16 }, required: true });
  const recipePath = path.join(D, "recipe.json");
  writeFileSync(recipePath, JSON.stringify({ format: "asset-recipe/v1", id: "cli-keep",
    styleRef: "stylespec.json",
    assets: [{ spec: spec("first"), source: { kind: "import", ref: "src.png" } },
             { spec: spec("second"), source: { kind: "drawlist" } }] }));

  const withDeadUpstream = async (argv: string[]) => {
    const old = { u: process.env.ANTHROPIC_BASE_URL, k: process.env.ANTHROPIC_AUTH_TOKEN };
    process.env.ANTHROPIC_BASE_URL = "http://127.0.0.1:9";   // 死端口 ⇒ 上游不可达（3）
    process.env.ANTHROPIC_AUTH_TOKEN = "x";
    try { return await runC(argv); }
    finally {
      if (old.u === undefined) delete process.env.ANTHROPIC_BASE_URL; else process.env.ANTHROPIC_BASE_URL = old.u;
      if (old.k === undefined) delete process.env.ANTHROPIC_AUTH_TOKEN; else process.env.ANTHROPIC_AUTH_TOKEN = old.k;
    }
  };

  it("人看的那一行：说清**在哪**、以及**怎么复用**", async () => {
    const { code, io } = await withDeadUpstream(["pack", "--recipe", recipePath, "--out", path.join(D, "out")]);
    expect(code).toBe(EXIT.upstream);
    const text = io.errors.join("");
    expect(text).toMatch(/已经付过钱的那几张原图留着/);
    expect(text).toMatch(/failed-/);
    expect(text).toMatch(/import/);           // 「怎么复用」那一句也得在
    // ⚠️ 现场**真的在那儿**，不是只有一句好话
    const dir = /原图留着（[^）]*）：(\S+)/.exec(text.replace(/\*\*/g, ""))?.[1];
    expect(dir, "那一行里没给出路径").toBeDefined();
    expect(existsSync(path.join(dir!, "authoring/imported"))).toBe(true);
  });

  it("机器看的那一份：`--json` 里带着 `failureDir`（与账同一处）", async () => {
    const { io } = await withDeadUpstream(["pack", "--recipe", recipePath, "--out", path.join(D, "out2"), "--json"]);
    const doc = JSON.parse(io.lines.join("")) as { exitCode: number; failureDir?: string; ledger?: unknown[] };
    expect(doc.exitCode).toBe(EXIT.upstream);
    expect(doc.failureDir).toMatch(/failed-/);
    expect(doc.ledger, "账也要在（票 46）").toBeDefined();
  });
});

describe("⚠️ **判断失败**：壳也要把账与现场说全（票 50）", () => {
  // 为什么要有这一组（票 48 的 Q2 = B 把它明确延期到这里）：
  //   上面那一组喂的是**死端口**（撞**上游**），读到的是 `CommandError` 构造时带着的那一份。
  //   而票 48 让两个壳改成**按能力读**（`ledgerOfError` / `failureDirOfError`）——
  //   那一条改的是「**挂在裸 `Error` 上**」那一份，也就是 `pack.ts` 判「这张图不能用」时抛的那一份。
  //   ⇒ **今天没有任何东西看着它**：谁把 `cli.ts` 那行改回 `e instanceof CommandError`，全绿。
  //
  // 这一组喂的是**判断失败**：上游**活着**（200 · 一张**完全合法**的 PNG），只是那张图
  //   **一个不透明像素都没有** ⇒ 撞 `pack.ts` 那条判断 → **裸 `Error`** + 退出码 **1**（不是 3）。
  //
  // ⚠️ **为什么要起桩**（票 50 量出来的：那 11 处抛点里只有这一档**非花钱不可达**）：
  //   要撞上判断失败就得**真发出去一次**（没有那一发就没有账），而 `deps.fetchImpl` 只管**文字**那一路
  //   —— 生图那一路吃的是 `imageTransport`（baseUrl），只认环境（`resolveImageTransport`）。
  //   ⇒ 起一个**本地** HTTP 桩，用 `deps.env` 指过去。
  //   ⚠️ 与上面那组不同：那条不得不**改进程全局**（`withDeadUpstream`），**这一条不必** ——
  //   `env` 正是票 16 开给壳的那道口子，而它今天就是为了这件事存在的。
  const D = mkdtempSync(path.join(tmpdir(), "gm-cli-50-"));

  /** 一张**合法**的 16×16 PNG，全透明（`Buffer.alloc` 填 0 ⇒ alpha 也是 0）。 */
  const TRANSPARENT = encodePNG({ width: 16, height: 16, data: Buffer.alloc(16 * 16 * 4) }).toString("base64");

  let server: ReturnType<typeof createServer>;
  let port = 0;
  let hits = 0;

  beforeAll(async () => {
    // ⚠️ 它**不是**在演「上游坏了」：它 200、给的是**合法** PNG。撞的就是「图能用不能用」这条判断。
    server = createServer((_req, res) => {
      hits += 1;
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ data: [{ b64_json: TRANSPARENT }] }));
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
    port = (server.address() as { port: number }).port;
  });
  afterAll(async () => { await new Promise<void>((r) => server.close(() => r())); });

  // 一件**必须真生图**的资源（与上面那组的 import/drawlist 不同 —— 那两件都不到生图那一步）。
  const spec = { kind: "sprite", id: "crate", role: "箱子", description: "一个木箱。",
    styleId: "style-ref", anchor: { x: 0.5, y: 0.5 }, size: { w: 16, h: 16 }, required: true };
  writeFileSync(path.join(D, "stylespec.json"),
    readFileSync(ROOT + ".scratch/game-creation-v1/experiments/style-transfer-from-test-png/stylespec.json"));
  const recipePath = path.join(D, "recipe.json");
  writeFileSync(recipePath, JSON.stringify({ format: "asset-recipe/v1", id: "cli-50",
    styleRef: "stylespec.json", assets: [{ spec, source: { kind: "image" } }] }));

  /** 生图上游 → 那个**活着的**桩；文字上游 → 死端口。 */
  const runStubbed = (argv: string[]) => {
    const io = capture();
    return run(argv, io, { env: { ...process.env,
      GAME_MAKER_IMAGE_PROTOCOL: "openai",
      GAME_MAKER_IMAGE_BASE_URL: `http://127.0.0.1:${port}/v1`,
      GAME_MAKER_IMAGE_API_KEY: "k",
      GAME_MAKER_IMAGE_MODEL: "m",
      // ⚠️ 死端口**不是凑数**：这条链一处文字调用都不该有 —— 真有的话，这一组会以 **3** 而不是 1 红，
      //   而那一红正是要看见的（「撞的是判断失败」这条主张当场自己拆穿自己）。
      ANTHROPIC_BASE_URL: "http://127.0.0.1:9",
      ANTHROPIC_AUTH_TOKEN: "x" } }).then((code) => ({ code, io }));
  };

  it("人看的那一份：账与现场都印出来了，而且**退的是 1**", async () => {
    const before = hits;
    const { code, io } = await runStubbed(["pack", "--recipe", recipePath, "--out", path.join(D, "out1")]);
    expect(hits, "桩一次都没被打到 ⇒ 这一条根本没撞上判断失败").toBeGreaterThan(before);
    // ⚠️ 1 与 3 是这一组的**全部重点**：1 = 判断失败，3 = 上游死。
    //   印出账与现场**这两种时刻都得印**，所以两条路各要一条判据。
    expect(code).toBe(EXIT.failure);
    expect(code).not.toBe(EXIT.upstream);
    const text = io.errors.join("");
    expect(text).toMatch(/一个不透明像素都没有/);          // 撞的是那条判断
    expect(text).toMatch(/已经花掉的/);                     // ← 账
    expect(text).toMatch(/image crate/);                    // ← 账上**那一笔**（不是「有个账」）
    expect(text).toMatch(/已经付过钱的那几张原图留着/);       // ← 现场
    // ⚠️ 现场**真的在盘上**，不是只有一句好话（与上面票 01 那条同一招）。
    const dir = /原图留着（[^）]*）：(\S+)/.exec(text.replace(/\*\*/g, ""))?.[1];
    expect(dir, "那一行里没给出路径").toBeDefined();
    expect(existsSync(dir!)).toBe(true);
  });

  it("机器看的那一份：`--json` 里 `ledger` 与 `failureDir` 各自都在", async () => {
    const { code, io } = await runStubbed(["pack", "--recipe", recipePath, "--out", path.join(D, "out2"), "--json"]);
    expect(code).toBe(EXIT.failure);
    const doc = JSON.parse(io.lines.join("")) as {
      exitCode: number; error: string;
      ledger?: { step: string; target: string; attempts: number; ms?: number }[];
      failureDir?: string;
    };
    expect(doc.exitCode).toBe(EXIT.failure);
    expect(doc.error).toMatch(/一个不透明像素都没有/);
    // ⚠️ 钉的是**那一笔的内容**，不是「有个数组」—— 否则一个空账也能过。
    expect(doc.ledger?.map((c) => [c.step, c.target])).toEqual([["image", "crate"]]);
    expect(doc.ledger?.[0]?.ms, "那一笔的时长是这次真跑出来的").toBeTypeOf("number");
    expect(doc.failureDir, "现场指针（票 48 给 MCP 补的就是这一格）").toMatch(/failed-/);
    expect(existsSync(doc.failureDir!), "指针指过去得真有个地方").toBe(true);
  });
});

// ── 票 06 · `accept`（结构验收 + 报告 writer） ────────────────────────────────
//
// ⚠️ **所有落盘都进临时 `--out`** —— 这里一条也不许写仓库的 `out/`。
// ⚠️ v7 与冻结 baseline 是本仓已入库的**真包 / 真基准**（与 `acceptance.test.ts` 同一组）；
//   缺了才 skip，而不是让整组永远静默不跑。
const V7 = path.join(ROOT, ".scratch/asset-integration-v1/runs/2026-10-20f-lurker/ruin-scavenger-extraction-assets/pack/v7");
const BASELINE = path.join(ROOT, "fixtures/animation-baselines/scavenger-idle");
const hasAcceptFixture = existsSync(path.join(V7, "manifest.json")) && existsSync(path.join(BASELINE, "baseline.json"));
const acceptOut = (tag: string) => mkdtempSync(path.join(tmpdir(), `gm-cli-accept-${tag}-`));
const sha = (b: Buffer) => "sha256:" + createHash("sha256").update(b).digest("hex");

describe.skipIf(!hasAcceptFixture)("accept · v7 + 冻结 baseline", () => {
  it("exit 0：报告落在临时 out 的 v1，且能被 parseAnimationAcceptance 解析", async () => {
    const out = acceptOut("ok");
    const { code, io } = await runC(["accept", V7, "--baseline", BASELINE, "--out", out]);
    expect(code).toBe(EXIT.ok);
    const rel = "ruin-scavenger-extraction-assets/acceptance/v1/report.json";
    const abs = path.join(out, rel);
    expect(existsSync(abs)).toBe(true);
    const report = JSON.parse(readFileSync(abs, "utf8"));
    expect(parseAnimationAcceptance(report).ok).toBe(true);
    expect(report.pack).toMatchObject({ id: "ruin-scavenger-extraction-assets", version: 7 });
    expect(report.baseline.id).toBe("scavenger-actor.idle.v7.2026-10-19");
    expect(report.findings).toEqual([]);
    const text = io.lines.join("");
    expect(text).toMatch(/结构验收：ruin-scavenger-extraction-assets v7/);
    expect(text).toMatch(/✅ 没有 error findings/);
    expect(text).toContain(`→ ${rel}`);
    expect(text).toContain("→ ruin-scavenger-extraction-assets/acceptance/v1/report.md");
  }, 120_000);

  it("`--json` 与人类输出**同源**：JSON = summary + artifacts 的那一份", async () => {
    const human = await runC(["accept", V7, "--out", acceptOut("human")]);
    const machine = await runC(["accept", V7, "--out", acceptOut("json"), "--json"]);
    expect(human.code).toBe(EXIT.ok);
    expect(machine.code).toBe(EXIT.ok);
    const doc = JSON.parse(machine.io.lines.join("")) as {
      command: string; summary: string[]; artifacts: { path: string; kind: string }[];
      data: Record<string, unknown>;
    };
    expect(doc.command).toBe("accept");
    // ⚠️ 字段名与 artifacts kind 是与 MCP（票 07）**逐字对齐**的：两个壳同源。
    expect(doc.data).toMatchObject({
      packId: "ruin-scavenger-extraction-assets", packVersion: 7,
      baselineId: null, hasErrors: false, reportVersion: 1,
      reportDir: "ruin-scavenger-extraction-assets/acceptance/v1",
      report: "ruin-scavenger-extraction-assets/acceptance/v1/report.json",
      reportMarkdown: "ruin-scavenger-extraction-assets/acceptance/v1/report.md",
      findings: { total: 0, errors: 0, warnings: 0, info: 0 },
    });
    expect(doc.artifacts.map((a) => a.kind)).toEqual(["acceptance-report", "acceptance-report-markdown"]);
    const rendered = doc.summary.join("\n") + "\n"
      + doc.artifacts.map((a) => `→ ${a.path}`).join("\n") + "\n";
    expect(human.io.lines.join("")).toBe(rendered);
  }, 120_000);

  it("版本只增不减：两次 accept 写 v1 / v2，v1 逐字节不变", async () => {
    const out = acceptOut("version");
    const first = await runC(["accept", V7, "--out", out, "--json"]);
    expect(first.code).toBe(EXIT.ok);
    const firstDoc = JSON.parse(first.io.lines.join("")) as { data: { report: string } };
    expect(firstDoc.data.report).toBe("ruin-scavenger-extraction-assets/acceptance/v1/report.json");
    const before = readFileSync(path.join(out, firstDoc.data.report), "utf8");
    const second = await runC(["accept", V7, "--out", out, "--json"]);
    expect(second.code).toBe(EXIT.ok);
    const secondDoc = JSON.parse(second.io.lines.join("")) as { data: { report: string } };
    expect(secondDoc.data.report).toBe("ruin-scavenger-extraction-assets/acceptance/v2/report.json");
    expect(existsSync(path.join(out, secondDoc.data.report))).toBe(true);
    // ⚠️ 钉的是**既有那一份没被覆盖**，不是「多了一个目录」。
    expect(readFileSync(path.join(out, firstDoc.data.report), "utf8")).toBe(before);
  }, 120_000);
});

describe("accept · 负例与退出码", () => {
  it("缺位置参数 / `--baseline` 缺值 ⇒ 参数错 2", async () => {
    expect((await runC(["accept"])).code).toBe(EXIT.usage);
    expect((await runC(["accept", "some-pack", "--baseline"])).code).toBe(EXIT.usage);
  });

  it("`--baseline` 是带值选项（不会掉成位置参数）", () => {
    const p = parseArgs(["accept", "some-pack", "--baseline", "some-baseline"]);
    expect(p.flags.baseline).toBe("some-baseline");
    expect(p.positionals).toEqual(["some-pack"]);
  });

  it("不是资源包 ⇒ 4（不是 1），且不产出报告", async () => {
    const bad = mkdtempSync(path.join(tmpdir(), "gm-cli-accept-badpack-"));
    writeFileSync(path.join(bad, "manifest.json"), "{}");
    const out = acceptOut("badpack");
    const { code } = await runC(["accept", bad, "--out", out]);
    expect(code).toBe(EXIT.invalid);
    expect(readdirSync(out)).toEqual([]);
  });

  it("baseline 不合法 ⇒ 4，且不产出报告", async () => {
    const emptyBaseline = mkdtempSync(path.join(tmpdir(), "gm-cli-accept-badbaseline-"));
    const out = acceptOut("badbaseline");
    const { code } = await runC(["accept", V7, "--baseline", emptyBaseline, "--out", out]);
    expect(code).toBe(EXIT.invalid);
    expect(readdirSync(out)).toEqual([]);
  }, 120_000);

  it.skipIf(!hasAcceptFixture)("有 error findings ⇒ 1（报告照样落盘，不是 4）", async () => {
    // 临时复制真包，只把一张图集 JSON 的帧矩形推出图集边界；**同步改 manifest 的
    // files[] checksum / bytes**，让它先通过 verifyPack（否则那是 exit 4 的输入不合法，
    // 而不是本用例要量的「验收失败」）。
    const packDir = mkdtempSync(path.join(tmpdir(), "gm-cli-accept-findings-"));
    cpSync(V7, packDir, { recursive: true });
    const metaRel = "delivery/atlas.animations.json";
    const metaPath = path.join(packDir, metaRel);
    const atlas = JSON.parse(readFileSync(metaPath, "utf8")) as {
      frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }>;
      meta: { size: { w: number; h: number } };
    };
    const firstName = Object.keys(atlas.frames)[0]!;
    atlas.frames[firstName]!.frame.y = atlas.meta.size.h;   // y + h > 图集高度
    const bytes = Buffer.from(JSON.stringify(atlas, null, 2) + "\n");
    writeFileSync(metaPath, bytes);
    const manifestPath = path.join(packDir, "manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      files: { path: string; bytes: number; checksum: string }[];
    };
    const entry = manifest.files.find((f) => f.path === metaRel)!;
    entry.bytes = bytes.length;
    entry.checksum = sha(bytes);
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

    const out = acceptOut("findings");
    const { code, io } = await runC(["accept", packDir, "--out", out, "--json"]);
    expect(code).toBe(EXIT.failure);
    expect(code).not.toBe(EXIT.invalid);
    const doc = JSON.parse(io.lines.join("")) as { data: { hasErrors: boolean; report: string } };
    expect(doc.data.hasErrors).toBe(true);
    const report = JSON.parse(readFileSync(path.join(out, doc.data.report), "utf8"));
    expect(parseAnimationAcceptance(report).ok).toBe(true);
    expect(report.findings.some((f: { code: string; severity: string }) =>
      f.code === "atlas.frame.out-of-bounds" && f.severity === "error")).toBe(true);
  }, 120_000);
});
