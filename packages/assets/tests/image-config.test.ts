// 凭据解析：**baseUrl 与 key 可配、且永不入库**。
//
// ⚠️ 这里最要紧的不是「能读到」，是**读到了也不会漏**：
//    最后一条测试用真的 `git check-ignore` 验 .gitignore，而不是靠一句注释承诺。
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_IMAGE_PROTOCOL, IMAGE_CONFIG_FILE, IMAGE_ENV, IMAGE_PROTOCOLS,
  describeImageTransport, imageEndpointOf, resolveImageTransport,
} from "../src/index.js";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const SECRET = "sk-THIS-MUST-NEVER-BE-PRINTED-0123456789";
const tmp = (doc: unknown) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "gm-cfg-"));
  if (doc !== undefined) fs.writeFileSync(path.join(d, IMAGE_CONFIG_FILE), typeof doc === "string" ? doc : JSON.stringify(doc));
  return d;
};
const fileCfg = { image: { baseUrl: "https://api.example.com/v1", apiKey: SECRET, model: "img-1" } };

describe("生图上游的凭据解析", () => {
  it("环境变量优先于文件，且会说出来", () => {
    const cwd = tmp(fileCfg);
    const r = resolveImageTransport({ cwd, env: { [IMAGE_ENV.baseUrl]: "https://env.example.com", [IMAGE_ENV.apiKey]: "k-env" } });
    expect(r.source).toBe("env");
    expect(r.transport!.baseUrl).toBe("https://env.example.com");
    expect(r.warnings.join()).toMatch(/以环境变量为准/);
  });

  it("没有环境变量就用文件", () => {
    const r = resolveImageTransport({ cwd: tmp(fileCfg), env: {} });
    expect(r.source).toBe("file");
    expect(r.transport).toEqual({
      protocol: DEFAULT_IMAGE_PROTOCOL, baseUrl: "https://api.example.com/v1", apiKey: SECRET, model: "img-1",
    });
    expect(r.warnings).toEqual([]);
  });

  it("**没配不是错误** —— 一份没有生图资源的清单不该需要它", () => {
    const r = resolveImageTransport({ cwd: tmp(undefined), env: {} });
    expect(r.source).toBeNull();
    expect(r.transport).toBeUndefined();
    expect(r.warnings).toEqual([]);
  });

  it("⚠️ 环境变量只给一半 → 说出来，而不是静默回落到另一把 key", () => {
    const r = resolveImageTransport({ cwd: tmp(fileCfg), env: { [IMAGE_ENV.apiKey]: "k-env" } });
    expect(r.source).toBe("file");
    expect(r.warnings.join()).toMatch(/这条路不完整/);
  });

  it("文件坏了只记 warning，不抛 —— 凭据读不到不该让别的命令崩掉", () => {
    for (const bad of ["{ 不是 json", JSON.stringify({ nope: 1 }), JSON.stringify({ image: { baseUrl: "ftp://x", apiKey: "k" } })]) {
      const r = resolveImageTransport({ cwd: tmp(bad), env: {} });
      expect(r.transport).toBeUndefined();
      expect(r.warnings.length).toBeGreaterThan(0);
    }
  });

  it("protocol 必须显式声明 —— 不写默认 openai，写了不认识的就拒收", () => {
    const 默认 = resolveImageTransport({ cwd: tmp(fileCfg), env: {} });
    expect(默认.transport!.protocol).toBe("openai");

    const 显式 = resolveImageTransport({ cwd: tmp({ image: { ...fileCfg.image, protocol: "dashscope-mcp" } }), env: {} });
    expect(显式.transport!.protocol).toBe("dashscope-mcp");

    // ⚠️ 不认识的 protocol **整条拒收**，而不是退回默认 —— 退回默认会让「我明明写了 minimax」
    //    变成悄悄按 OpenAI 的形状发请求，那是 krill 那种「长得像但什么都不实现」的翻版。
    for (const bad of ["claude", "", 123]) {
      const r = resolveImageTransport({ cwd: tmp({ image: { ...fileCfg.image, protocol: bad } }), env: {} });
      expect(r.transport).toBeUndefined();
      expect(r.warnings.join()).toMatch(/protocol 只认/);
    }
    expect(IMAGE_PROTOCOLS).toContain("dashscope-mcp");
  });

  it("protocol 也能从环境变量来，且与 baseUrl/key 必须成套", () => {
    const r = resolveImageTransport({
      cwd: tmp(undefined),
      env: { [IMAGE_ENV.protocol]: "minimax", [IMAGE_ENV.baseUrl]: "https://api.minimaxi.com/v1", [IMAGE_ENV.apiKey]: "sk-x" },
    });
    expect(r.source).toBe("env");
    expect(r.transport!.protocol).toBe("minimax");
    if (r.transport?.protocol !== "minimax") throw new Error("没读到");
    expect(describeImageTransport(r.transport)).toContain("minimax");
  });

  it("拼 URL 时去掉末尾斜杠，不产出 //v1", () => {
    const e = imageEndpointOf({ protocol: "openai", baseUrl: "https://x.com/", apiKey: "k" }, "/images/generations");
    expect(e.url).toBe("https://x.com/images/generations");
    expect(e.headers.authorization).toBe("Bearer k");
  });
});

describe("⚠️ key 不许漏进任何可打印的字符串", () => {
  it("describeImageTransport 只回显 baseUrl 与「配没配」", () => {
    const line = describeImageTransport({ protocol: "openai", baseUrl: "https://api.example.com/v1", apiKey: SECRET, model: "img-1" });
    expect(line).not.toContain(SECRET);
    expect(line).toContain("https://api.example.com/v1");
    expect(line).toMatch(/key 已配置/);
    expect(describeImageTransport(undefined)).toMatch(/未配置/);
  });

  it("**真的被 git 忽略** —— 用 git check-ignore 验，不是靠注释承诺", () => {
    const cwd = tmp(fileCfg);
    // 没有这个文件时也要能判：git 的忽略规则是按路径匹配的，与文件在不在无关
    fs.writeFileSync(path.join(cwd, IMAGE_CONFIG_FILE), "{}");
    const out = execFileSync("git", ["-C", ROOT, "check-ignore", "-v", `--no-index`, IMAGE_CONFIG_FILE], { encoding: "utf8" });
    expect(out).toMatch(/game-maker\.local\.json/);
    fs.rmSync(cwd, { recursive: true, force: true });
  });
});
