// 临时 TCP 转发：127.0.0.1:9098 → 127.0.0.1:7890。
// 用途：config 的生图代理指向 9098，而当前只有 ClashX 的 7890 在监听。
// **不改 game-maker.local.json**；只在本次运行期间起进程，跑完就杀。
import net from "node:net";
const LISTEN = Number(process.env.LISTEN_PORT ?? 9098);
const TARGET = Number(process.env.TARGET_PORT ?? 7890);
const server = net.createServer((client) => {
  const upstream = net.connect(TARGET, "127.0.0.1");
  const close = () => { client.destroy(); upstream.destroy(); };
  client.on("error", close); upstream.on("error", close);
  client.on("close", close); upstream.on("close", close);
  client.pipe(upstream); upstream.pipe(client);
});
server.listen(LISTEN, "127.0.0.1", () => {
  console.log(`forward 127.0.0.1:${LISTEN} -> 127.0.0.1:${TARGET}`);
});
