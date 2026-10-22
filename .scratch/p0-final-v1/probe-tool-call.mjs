#!/usr/bin/env node
// 强制工具调用探针 —— 只发 1 次文本请求；不打印 key / token。
// 用法：node .scratch/p0-final-v1/probe-tool-call.mjs [model]
// 成功：HTTP 2xx + stop_reason="tool_use" + tool_use.input.ok === true。
import process from "node:process";

const base = (process.env.ANTHROPIC_BASE_URL ?? "").replace(/\/+$/, "");
const key = process.env.ANTHROPIC_AUTH_TOKEN ?? "";
if (!base || !key) {
  console.error("缺少 ANTHROPIC_BASE_URL / ANTHROPIC_AUTH_TOKEN");
  process.exit(2);
}
const model = process.argv[2] ?? "deepseek-v4-pro";
const body = {
  model,
  max_tokens: 256,
  thinking: { type: "disabled" },
  messages: [{ role: "user", content: "Call the emit_probe tool with ok=true. Do not answer in text." }],
  tools: [{
    name: "emit_probe",
    description: "Emit a probe object.",
    input_schema: {
      type: "object",
      properties: { ok: { type: "boolean" } },
      required: ["ok"],
      additionalProperties: false,
    },
  }],
  tool_choice: { type: "tool", name: "emit_probe" },
};

const res = await fetch(`${base}/v1/messages`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-api-key": key,
    "anthropic-version": "2023-06-01",
  },
  body: JSON.stringify(body),
});
const text = await res.text();
let data;
try { data = JSON.parse(text); }
catch {
  console.error("非 JSON 响应：", text.slice(0, 300));
  process.exit(1);
}
const blocks = Array.isArray(data.content) ? data.content : [];
const tool = blocks.find((b) => b.type === "tool_use" && b.name === "emit_probe");
const ok = res.ok && tool !== undefined && tool.input !== null && typeof tool.input === "object" && tool.input.ok === true;
console.log(JSON.stringify({
  http: res.status,
  requested: model,
  model: data.model ?? null,
  stop_reason: data.stop_reason ?? null,
  content_types: blocks.map((b) => b.type),
  tool_input: tool?.input ?? null,
  usage: data.usage ?? null,
  ok,
}, null, 2));
process.exit(ok ? 0 : 1);
