// 走 HTTP 代理的 fetch。
//
// ⚠️ **为什么需要它**：Node 22 原生的 `fetch` **不认 `HTTPS_PROXY`**（实测：设了环境变量
// 仍然 `fetch failed`，10.5 秒超时）。而 `api.openai.com` 这类上游在境内**直连不通**
// （实测 DNS 被污染成 Facebook 的 IP 段、TCP 443 超时），必须经代理。
//
// 实现走的是 Node 自带的 `https.Agent` + 覆写 `createConnection`：只在下面塞一个
// CONNECT 隧道 + TLS，**HTTP 的报文解析仍然交给 Node**，不自己手写（手写就得处理
// chunked、keep-alive、重定向那一堆，而那是 bug 的温床）。零第三方依赖。
import http from "node:http";
import https from "node:https";
import net from "node:net";
import tls from "node:tls";

export type ProxyFetchOptions = {
  /** 代理地址，如 `http://127.0.0.1:9098`（也接受省略协议头的 `127.0.0.1:9098`）。 */
  proxy: string;
};

/**
 * 造一个**只走给定代理**的 fetch，签名与全局 `fetch` 兼容到本项目用得到的程度。
 *
 * ⚠️ 不做的事：不支持 `stream`、不支持 `redirect: "follow"` 之外的形态、不支持
 * `FormData`。本项目的调用方只用 POST JSON 与 GET 下载，够用即止 —— 多写的每一行
 * 都是没被测过的代码。
 */
export function createProxyFetch(opts: ProxyFetchOptions): typeof fetch {
  const u = new URL(opts.proxy.includes("://") ? opts.proxy : `http://${opts.proxy}`);
  const proxyPort = Number(u.port || (u.protocol === "https:" ? 443 : 80));

  const agent = new https.Agent({ keepAlive: false });
  // 唯一一处“黑魔法”：把「连到目标主机」换成「先连代理、再 CONNECT 到目标、再套 TLS」
  (agent as unknown as { createConnection: unknown }).createConnection = (
    options: { host?: string; port?: number | string },
    cb: (err: Error | null, socket: unknown) => void,
  ) => {
    const host = String(options.host);
    const port = Number(options.port ?? 443);
    const raw = net.connect(proxyPort, u.hostname, () => {
      raw.write(`CONNECT ${host}:${port} HTTP/1.1\r\nHost: ${host}:${port}\r\n\r\n`);
    });
    let head = Buffer.alloc(0);
    const onData = (d: Buffer) => {
      head = Buffer.concat([head, d]);
      const end = head.indexOf("\r\n\r\n");
      if (end < 0) return;
      raw.removeListener("data", onData);
      const status = Number(head.subarray(0, head.indexOf("\r\n")).toString().split(" ")[1]);
      if (status !== 200) { cb(new Error(`代理 CONNECT 失败：HTTP ${status}`), null); raw.destroy(); return; }
      const rest = head.subarray(end + 4);
      if (rest.length > 0) raw.unshift(rest);      // TLS 握手的头几个字节可能已经跟 CONNECT 回应一起到了
      const secure = tls.connect({ socket: raw, servername: host }, () => cb(null, secure));
      secure.on("error", (e) => cb(e, null));
    };
    raw.on("data", onData);
    raw.on("error", (e) => cb(e, null));
    // ⚠️ **不要返回 raw**：Node 的 Agent 在 `createConnection` 同步有返回值时会**直接用那个值**
    // 当连接，于是拿到的是一根还没套 TLS 的裸 socket（实测表现：11ms 回来一个空 400）。
    // 返回 undefined，让 Node 等回调里的 TLS socket。
    return undefined as unknown as net.Socket;
  };

  return (async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    // ⚠️ 用普通对象而不是 `Headers`：`node:https` 要的是 `OutgoingHttpHeaders`，
    // 而 `Headers` 转不过去；绕开 DOM 类型也让这个文件不依赖 lib.dom。
    const headers: Record<string, string> = {};
    const h = init?.headers;
    if (h) {
      if (Array.isArray(h)) for (const pair of h as [string, string][]) headers[pair[0]] = pair[1];
      else if (typeof (h as { forEach?: unknown }).forEach === "function")
        (h as { forEach: (cb: (v: string, k: string) => void) => void }).forEach((v, k) => { headers[k] = v; });
      else for (const [k, v] of Object.entries(h as Record<string, string>)) headers[k] = v;
    }
    return await new Promise<Response>((resolve, reject) => {
      const req = https.request(
        { host: url.hostname, port: Number(url.port || 443), path: url.pathname + url.search, method, headers, agent },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (c: Buffer) => chunks.push(c));
          res.on("end", () => {
            const out: Record<string, string> = {};
            for (const [k, v] of Object.entries(res.headers))
              if (typeof v === "string") out[k] = v; else if (Array.isArray(v)) out[k] = v.join(", ");
            resolve(new Response(Buffer.concat(chunks), { status: res.statusCode ?? 0, headers: out }));
          });
        },
      );
      req.on("error", reject);
      if (init?.signal) init.signal.addEventListener("abort", () => req.destroy(new Error("aborted")));
      const body = init?.body;
      if (typeof body === "string" || body instanceof Buffer) req.write(body);
      req.end();
    });
  }) as typeof fetch;
}
