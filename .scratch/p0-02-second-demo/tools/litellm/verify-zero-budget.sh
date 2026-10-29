#!/usr/bin/env bash
# P0-02 · 零预算 429 验证（在部署 LiteLLM 后由用户/代理本地运行）
# 用法：
#   LITELLM_BASE_URL=http://127.0.0.1:4000 \
#   LITELLM_KEY=<max_budget=0 的 virtual key> \
#   ./verify-zero-budget.sh
# ⚠️ 脚本不回显 key；不要把 key 贴到对话。
set -euo pipefail
: "${LITELLM_BASE_URL:?set LITELLM_BASE_URL (e.g. http://127.0.0.1:4000)}"
: "${LITELLM_KEY:?set LITELLM_KEY (the max_budget=0 virtual key)}"
BASE="${LITELLM_BASE_URL%/}"

req() {
  local name="$1" url="$2" body="$3"
  local out; out="$(mktemp)"
  local code; code="$(curl -sS -o "$out" -w '%{http_code}' -X POST "$url" \
    -H "x-goog-api-key: ${LITELLM_KEY}" -H 'Content-Type: application/json' -d "$body" || true)"
  echo "== ${name} =="
  echo "HTTP ${code}"
  # 只打印响应体（不含 key；若响应体回显 key，说明网关有问题，停止）
  sed -n '1,20p' "$out"
  rm -f "$out"
  if [ "$code" != "429" ]; then
    echo "✗ ${name}: expected 429 before upstream; got ${code}. STOP and report."
    return 1
  fi
}

echo "Checking LiteLLM at ${BASE} (no key is printed)"
req "text :generateContent" \
  "${BASE}/v1beta/models/gemini-3.5-flash:generateContent" \
  '{"contents":[{"parts":[{"text":"ping"}]}]}'
req "image /interactions" \
  "${BASE}/v1beta/interactions" \
  '{"model":"gemini-3.1-flash-lite-image","input":[{"type":"text","text":"ping"}]}'

echo "✓ both paths returned 429 before upstream."
echo "Next: verify in LiteLLM logs that upstream received zero requests, then re-submit budget authorization (ticket 23)."
