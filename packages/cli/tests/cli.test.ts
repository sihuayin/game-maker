import { copyFileSync, existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { EXIT, exitCodeOfError, CommandError } from "@game-maker/assets";
import { ASSET_PACK_FORMAT } from "@game-maker/contracts";
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
