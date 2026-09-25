import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { EXIT, exitCodeOfError, CommandError } from "@game-maker/assets";
import { parseArgs, renderHuman, run, type CliIo } from "../src/cli.js";

/** 收下 CLI 的所有出站，测试因此不会把 stdout 刷满。 */
const capture = (): CliIo & { lines: string[]; errors: string[] } => {
  const lines: string[] = [], errors: string[] = [];
  return { lines, errors, out: (s) => lines.push(s), err: (s) => errors.push(s) };
};
const runC = (argv: string[]) => { const io = capture(); return run(argv, io).then((code) => ({ code, io })); };

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const PACK = ROOT + "out/shift-change-assets/pack/v5";
const hasPack = (() => { try { readFileSync(PACK + "/manifest.json"); return true; } catch { return false; } })();

describe("参数解析（手写，无依赖）", () => {
  it("子命令 + 带值选项 + 布尔开关", () => {
    const p = parseArgs(["derive", "--requirement", "a.md", "--style", "s.json", "--json"]);
    expect(p.command).toBe("derive");
    expect(p.flags).toMatchObject({ requirement: "a.md", style: "s.json", json: true });
  });
  it("位置参数与短选项", () => {
    expect(parseArgs(["inspect", "some/pack", "-h"]).positionals).toEqual(["some/pack"]);
    expect(parseArgs(["-h"]).flags.help).toBe(true);
  });
  it("⚠️ 带值选项后面缺值 → 报参数错，而不是把 undefined 当值", () => {
    expect(() => parseArgs(["pack", "--recipe"])).toThrow(/后面要跟一个值/);
  });
});

describe("人类输出与 JSON 是**同一份数据**", () => {
  it("renderHuman 只渲染 summary + artifacts + 传输切换", () => {
    const r = { command: "pack", outcome: "ok" as const, summary: ["甲", "乙"], data: { a: 1 }, artifacts: [{ path: "out/x", kind: "asset-pack" }], degradations: [], transport: { preferred: "messages", used: "chat-completions", switches: [] } };
    expect(renderHuman(r)).toBe("甲\n乙\n→ out/x\n· 传输切换：messages → chat-completions");
  });
  it("传输没切换时不提它", () => {
    const r = { command: "pack", outcome: "ok" as const, summary: ["甲"], data: {}, artifacts: [], degradations: [], transport: { preferred: "messages", used: "messages", switches: [] } };
    expect(renderHuman(r)).not.toMatch(/传输切换/);
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
