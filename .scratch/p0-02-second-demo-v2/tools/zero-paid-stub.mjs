#!/usr/bin/env node
// 零付费 dry run 的 fail-closed 上游 stub：记录每次请求（不记录 auth），返回 503。
// 用法：node zero-paid-stub.mjs <port> <logFile>
import fs from 'node:fs';
import http from 'node:http';
const port = Number(process.argv[2] ?? 18766);
const log = process.argv[3] ?? '/tmp/zero-paid-stub.jsonl';
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    fs.appendFileSync(log, JSON.stringify({
      at: new Date().toISOString(), method: req.method, url: req.url,
      contentType: req.headers['content-type'] ?? null, bytes: Buffer.byteLength(body),
      // ⚠️ 不记录 authorization / x-api-key 等凭据头
    }) + '\n');
    res.writeHead(503, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: { code: 503, message: 'zero-paid dry run: upstream access refused' } }));
  });
});
server.listen(port, '127.0.0.1', () => console.log(`stub listening on http://127.0.0.1:${port} -> ${log}`));
