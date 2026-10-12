/**
 * 第 07 章配套示例 · HTTP/1.1 队头阻塞 vs HTTP/2 多路复用 vs UDP
 *
 * 分三部分，用 Node 内置模块亲手验证：
 *  1. HTTP/1.1：同一连接上，一个慢请求会堵住后面的请求（队头阻塞）
 *  2. HTTP/2：同一连接上，多个请求并发，慢的挡不住快的（多路复用）
 *  3. UDP：无连接、无顺序保证——这是 HTTP/3（QUIC）把 TCP 换成 UDP 的动机
 *
 * 运行：node 07-HTTP2与QUIC.mjs
 */

import http from 'node:http';
import http2 from 'node:http2';
import dgram from 'node:dgram';

// 先等待上一段结束再跑下一段，保证输出可读
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── 1. HTTP/1.1：队头阻塞 ─────────────────────────────────────────
async function demoHeadOfLineBlocking() {
  console.log('===== 1. HTTP/1.1 的队头阻塞 =====');

  const server = http.createServer((req, res) => {
    if (req.url === '/slow') {
      // 慢请求：拖 500ms 才回
      setTimeout(() => res.end('slow 完成'), 500);
    } else {
      res.end('fast 完成');
    }
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  // 关键：maxSockets: 1 + keepAlive，强制所有请求挤在同一条 TCP 连接上
  const agent = new http.Agent({ keepAlive: true, maxSockets: 1 });

  const get = (path) =>
    new Promise((resolve) => {
      const t0 = Date.now();
      http.get({ host: '127.0.0.1', port, path, agent }, (res) => {
        res.resume();
        res.on('end', () => resolve({ path, ms: Date.now() - t0 }));
      });
    });

  console.log('同一条连接上：先发 /slow，紧接着发 /fast');
  const t0 = Date.now();
  const [slow, fast] = await Promise.all([get('/slow'), get('/fast')]);
  console.log(`  ${slow.path} 耗时 ${slow.ms} ms`);
  console.log(`  ${fast.path} 耗时 ${fast.ms} ms（被 /slow 堵住了，这就是队头阻塞）`);
  console.log(`  总耗时 ${Date.now() - t0} ms，两条请求是"排队"而不是"并发"`);
  console.log('');

  server.close();
  agent.destroy();
}

// ── 2. HTTP/2：多路复用 ───────────────────────────────────────────
async function demoHttp2Multiplexing() {
  console.log('===== 2. HTTP/2 的多路复用 =====');

  // 明文 h2c：http2.createServer 不带证书，走明文 HTTP/2
  const server = http2.createServer();
  server.on('stream', (stream, headers) => {
    if (headers[':path'] === '/slow') {
      setTimeout(() => {
        stream.respond({ ':status': 200, 'content-type': 'text/plain' });
        stream.end('slow 完成');
      }, 500);
    } else {
      stream.respond({ ':status': 200, 'content-type': 'text/plain' });
      stream.end('fast 完成');
    }
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  const client = http2.connect(`http://127.0.0.1:${port}`);
  await new Promise((resolve, reject) => {
    client.once('connect', resolve);
    client.once('error', reject);
  });

  const get2 = (path) =>
    new Promise((resolve) => {
      const t0 = Date.now();
      const req = client.request({ ':path': path });
      req.resume();
      req.on('end', () => resolve({ path, ms: Date.now() - t0 }));
      req.end();
    });

  console.log('同一条连接上：并发发 /slow 和 /fast（HTTP/2 一个连接里有多条流）');
  const t0 = Date.now();
  const [slow, fast] = await Promise.all([get2('/slow'), get2('/fast')]);
  console.log(`  ${slow.path} 耗时 ${slow.ms} ms`);
  console.log(`  ${fast.path} 耗时 ${fast.ms} ms（没被堵，两条流互不干扰）`);
  console.log(`  总耗时 ${Date.now() - t0} ms，慢的挡不住快的`);
  console.log('');

  client.close();
  server.close();
}

// ── 3. UDP：无连接、无顺序保证（HTTP/3 的动机） ──────────────────
async function demoUdp() {
  console.log('===== 3. UDP：HTTP/3（QUIC）为什么换掉 TCP =====');

  const server = dgram.createSocket('udp4');
  await new Promise((resolve) => server.bind(0, '127.0.0.1', resolve));
  const port = server.address().port;

  server.on('message', (msg, rinfo) => {
    console.log(`  [server] 收到来自 ${rinfo.address}:${rinfo.port} 的数据报: ${msg}`);
  });

  const client = dgram.createSocket('udp4');
  // UDP 没有"连接"，直接往目标地址"扔"数据报。扔 3 个，不保证顺序，也不保证送到。
  const msgs = ['报文 1', '报文 2', '报文 3'];
  msgs.forEach((m) => client.send(m, port, '127.0.0.1'));
  console.log('  客户端连"连接"都不用建立，直接扔 3 个独立数据报');
  console.log('  UDP 不保证顺序、不保证送达——QUIC 是在 UDP 之上自己实现"可靠 + 多路复用"');
  console.log('  好处：一条连接里某个流丢了，不会卡住其它流（这正是 HTTP/3 的目标）');
  console.log('');

  await sleep(200); // 给 UDP 一点送达时间
  client.close();
  server.close();
}

await demoHeadOfLineBlocking();
await demoHttp2Multiplexing();
await demoUdp();

console.log('全部演示结束，进程自然退出');
