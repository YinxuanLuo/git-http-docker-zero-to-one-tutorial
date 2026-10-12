/**
 * 第 10 章配套示例 · 亲手复现真实的网络错误码
 *
 * 网络编程里，错误码是"唯一能信的线索"。这里复现三个最常见的：
 *  1. ECONNREFUSED —— 连接被拒绝（端口没人在监听）
 *  2. ENOTFOUND —— 域名解析失败（DNS 查不到）
 *  3. ETIMEDOUT / EHOSTUNREACH —— 连接超时 / 目标不可达（网络不可达，取决于环境）
 *
 * 全部是 Node 里 catch 到的真实错误名，照抄，不意译。
 *
 * 运行：node 10-真实报错码.mjs
 */

import net from 'node:net';
import dns from 'node:dns/promises';

console.log('===== 1. ECONNREFUSED：连接被拒绝 =====');
// 先起一个临时服务器拿到端口，再立刻关掉，保证这个端口"没人监听"。
// 然后去连它，内核会直接回一个 RST，Node 抛 ECONNREFUSED。
const probe = net.createServer();
await new Promise((r) => probe.listen(0, '127.0.0.1', r));
const freePort = probe.address().port;
await new Promise((r) => probe.close(r));

await new Promise((resolve) => {
  const s = net.connect({ host: '127.0.0.1', port: freePort });
  s.once('connect', () => {
    console.log('  意外：端口竟然被占用了');
    s.destroy();
    resolve();
  });
  s.once('error', (e) => {
    console.log('  错误码:', e.code);
    console.log('  原文  :', e.message);
    console.log('  触发条件：连接一个没有进程监听的端口');
    resolve();
  });
});

console.log('');
console.log('===== 2. ENOTFOUND：域名解析失败 =====');
try {
  await dns.lookup('this-domain-does-not-exist-9f3a2b.example');
} catch (e) {
  console.log('  错误码:', e.code);
  console.log('  原文  :', e.message);
  console.log('  触发条件：DNS 里查不到这个域名（hosts 里也没有）');
}

console.log('');
console.log('===== 3. 连接不可达地址（ETIMEDOUT / EHOSTUNREACH / ENETUNREACH） =====');
// 10.255.255.1 是私有地址段，通常没有机器、也不在路由表里。
// 连它要么超时（ETIMEDOUT），要么"主机不可达"（EHOSTUNREACH），取决于你的网络环境。
await new Promise((resolve) => {
  const s = net.connect({ host: '10.255.255.1', port: 80 });
  s.setTimeout(4000); // 最多等 4 秒，别让脚本挂住
  s.once('connect', () => {
    console.log('  意外：连上了');
    s.destroy();
    resolve();
  });
  s.once('timeout', () => {
    console.log('  结果：应用层超时（socket timeout）');
    s.destroy();
    resolve();
  });
  s.once('error', (e) => {
    console.log('  错误码:', e.code, '（ETIMEDOUT=超时 / EHOSTUNREACH=主机不可达 / ENETUNREACH=网络不可达）');
    console.log('  原文  :', e.message);
    resolve();
  });
});

console.log('');
console.log('===== 4. 附：HTTP 状态码（规范值，不是错误，但要会背） =====');
const codes = {
  200: 'OK',
  301: 'Moved Permanently',
  302: 'Found',
  304: 'Not Modified',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
};
for (const [code, phrase] of Object.entries(codes)) {
  console.log(`  ${code} ${phrase}`);
}

console.log('');
console.log('全部演示结束，进程自然退出');
