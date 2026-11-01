// B 的严格更新日志字段校验；A 的旧日志继续走 scripts/check-manifest-updates.mjs 的兼容规则。
import { RegistryError, SHA256_RE } from "./baseline-registry.mjs";

export function parseStrictUpdateLog(text, entry) {
  const sections = text.split(/^## /m).slice(1);
  if (sections.length === 0) throw new RegistryError("log.format", `${entry.id}: 更新日志没有 '## ' 条目`);
  const required = ["reason", "subject", "oldSha256", "newSha256", "evidence", "verifiedBy", "recordedIn"];
  for (const [i, section] of sections.entries()) {
    const lines = section.split(/\r?\n/);
    const title = (lines.shift() ?? "").trim();
    const fields = new Map();
    for (const line of lines) {
      const m = line.match(/^\s*-\s*([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
      if (m === null) continue;
      const [, key, value] = m;
      if (fields.has(key)) throw new RegistryError("log.duplicate-field", `${entry.id}: 条目 ${title} 重复字段 ${key}`);
      fields.set(key, value.trim());
    }
    for (const key of required) {
      if (!fields.has(key) || fields.get(key) === "") throw new RegistryError("log.missing-field", `${entry.id}: 条目 ${title} 缺少 ${key}`);
    }
    const newSha = fields.get("newSha256");
    if (!SHA256_RE.test(newSha)) throw new RegistryError("log.invalid-digest", `${entry.id}: 条目 ${title} newSha256 非法：${newSha}`);
    const oldSha = fields.get("oldSha256");
    if (!/^none\b/.test(oldSha) && !SHA256_RE.test(oldSha)) throw new RegistryError("log.invalid-digest", `${entry.id}: 条目 ${title} oldSha256 非法：${oldSha}`);
    if (fields.has("baselineId") && fields.get("baselineId") !== entry.id) {
      throw new RegistryError("log.baseline-id", `${entry.id}: 条目 ${title} baselineId=${fields.get("baselineId")} 与 Registry id 不一致`);
    }
    for (const optional of ["operator", "commitSha", "recordedAt"]) {
      if (fields.has(optional) && fields.get(optional) === "") throw new RegistryError("log.empty-field", `${entry.id}: 条目 ${title} ${optional} 为空`);
    }
    if (i === sections.length - 1 && newSha !== entry.manifestSha) {
      throw new RegistryError("log.final-digest", `${entry.id}: 最后一条 newSha256 ${newSha} 不等于 Manifest ${entry.manifestSha}`);
    }
  }
}
