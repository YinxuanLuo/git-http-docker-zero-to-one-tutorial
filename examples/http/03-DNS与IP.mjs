/**
 * 第 03 章配套示例 · IP 地址、子网与 DNS 查询
 *
 * 用 node:dns 和 node:net 演示：
 *  1. DNS 查询的两条路径：lookup（走系统，含 hosts）与 resolve4（直接问 DNS）
 *  2. IP 地址的格式校验（net.isIP）
 *  3. 子网掩码：用位运算算出"网络地址"（同一网段的机器可以直连）
 *  4. 真实报错码：域名不存在会得到 ENOTFOUND（照抄，别意译）
 *
 * 运行：node 03-DNS与IP.mjs
 * 联网操作都包在 try/catch 里，离线也能退出码 0。
 */

import dns from 'node:dns/promises';
import net from 'node:net';

// ── 1. DNS 查询的两条路径 ──────────────────────────────────────────
console.log('===== 1. DNS 查询：lookup vs resolve4 =====');

// lookup：走"系统解析器"。它会先查 hosts 文件，再走 DNS。结果可能来自缓存。
// localhost 基本都在 hosts 文件里，所以离线也能解析。
const r1 = await dns.lookup('localhost');
console.log('dns.lookup("localhost") ->', JSON.stringify(r1));
console.log('  说明：lookup 会先查本机 hosts 文件，localhost 通常写在那里');

// resolve4：跳过 hosts，直接向 DNS 服务器问 A 记录。需要联网。
try {
  const r2 = await dns.resolve4('example.com');
  console.log('dns.resolve4("example.com") ->', JSON.stringify(r2));
} catch (e) {
  console.log('dns.resolve4("example.com") 失败（可能离线），错误码:', e.code);
}

console.log('');

// ── 2. IP 地址格式校验 ──────────────────────────────────────────────
console.log('===== 2. IP 地址格式 =====');
console.log('net.isIP("127.0.0.1") =', net.isIP('127.0.0.1'), '（4 = IPv4）');
console.log('net.isIP("::1")        =', net.isIP('::1'), '（6 = IPv6）');
console.log('net.isIP("999.1.1.1")  =', net.isIP('999.1.1.1'), '（0 = 不是合法 IP）');
console.log('');

// ── 3. 子网掩码：算网络地址 ─────────────────────────────────────────
// 一个 IP + 子网掩码，能算出"网络地址"。同一网络地址的两台机器，理论上可以直连。
console.log('===== 3. 子网掩码直觉 =====');

function ipToInt(ip) {
  return ip.split('.').reduce((acc, n) => ((acc << 8) >>> 0) + Number(n), 0) >>> 0;
}
function intToIp(n) {
  return [24, 16, 8, 0].map((s) => (n >>> s) & 0xff).join('.');
}

const ip = '192.168.1.10';
const prefix = 24; // /24 表示前 24 位是网络位，后 8 位是主机位
const mask = (~0 << (32 - prefix)) >>> 0; // 11111111.11111111.11111111.00000000
const netAddr = intToIp(ipToInt(ip) & mask);

console.log('IP       :', ip);
console.log('掩码 /24 :', intToIp(mask), '(255.255.255.0)');
console.log('网络地址 :', netAddr, '(同网段的机器可直连，跨网段要经路由器)');
console.log('');

// ── 4. 真实报错码：域名不存在 ──────────────────────────────────────
console.log('===== 4. 真实报错码 ENOTFOUND =====');
try {
  await dns.lookup('this-domain-definitely-does-not-exist-12345.example');
} catch (e) {
  // 真实错误名是 ENOTFOUND，不是"找不到"之类的中文意译
  console.log('查询不存在的域名 -> 错误码:', e.code);
  console.log('错误信息原文:', e.message);
}

console.log('');
console.log('全部演示结束，进程自然退出');
