/**
 * 第 11 章配套示例 · 把面试速查表变成一张可运行的表
 *
 * 面试前跑一遍，把高频考点（方法、状态码、缓存头、错误码）在脑子里过一遍。
 * 这不是新知识，是"唤醒记忆"的工具。
 *
 * 运行：node 11-面试速查验证.mjs
 */

console.log('========== 网络与 HTTP 高频考点速查 ==========\n');

console.log('【HTTP 方法】 幂等性 = 重复执行结果相同（GET/PUT/DELETE 幂等，POST 不幂等）');
const methods = [
  ['GET', '读资源', '幂等、安全'],
  ['POST', '新建资源 / 提交数据', '不幂等'],
  ['PUT', '整体替换资源', '幂等'],
  ['DELETE', '删除资源', '幂等'],
  ['PATCH', '局部修改资源', '不一定幂等'],
  ['HEAD', '只要响应头，不要 body', '幂等'],
];
for (const [m, desc, note] of methods) {
  console.log(`  ${m.padEnd(8)} ${desc.padEnd(12)} ${note}`);
}

console.log('\n【状态码速记】 2xx 成功 / 3xx 重定向 / 4xx 客户端错 / 5xx 服务器错');
const codes = [
  ['200', 'OK', '成功'],
  ['204', 'No Content', '成功但无 body（DELETE 常用）'],
  ['301', 'Moved Permanently', '永久重定向（换域名）'],
  ['302', 'Found', '临时重定向（登录跳转）'],
  ['304', 'Not Modified', '缓存命中，用本地缓存'],
  ['400', 'Bad Request', '请求格式错'],
  ['401', 'Unauthorized', '没登录 / 没认证'],
  ['403', 'Forbidden', '登录了但没权限'],
  ['404', 'Not Found', '资源不存在'],
  ['500', 'Internal Server Error', '服务器自己崩了'],
  ['502', 'Bad Gateway', '上游服务器挂了'],
  ['503', 'Service Unavailable', '服务器暂时不可用（过载/维护）'],
];
for (const [c, p, note] of codes) {
  console.log(`  ${c.padEnd(4)} ${p.padEnd(24)} ${note}`);
}

console.log('\n【缓存头】 强缓存 vs 协商缓存');
console.log('  强缓存（不发请求）   : Cache-Control: max-age=60（60 秒内直接用本地）');
console.log('  协商缓存（要问一下） : ETag + If-None-Match -> 304');
console.log('                         Last-Modified + If-Modified-Since -> 304');

console.log('\n【Cookie 关键属性】');
console.log('  HttpOnly   : JS 读不到，防 XSS 偷 cookie');
console.log('  Secure     : 只在 HTTPS 下传输');
console.log('  SameSite   : 防 CSRF（跨站请求不带上）');
console.log('  Path/Domain: 限定 cookie 的作用范围');

console.log('\n【HTTPS / TLS】');
console.log('  对称加密    : 快，但"钥匙怎么安全交给对方"是难题');
console.log('  非对称加密  : 慢，但能安全交换钥匙（公钥加密、私钥解密）');
console.log('  TLS 握手本质 : 用非对称加密交换一把对称密钥，之后全程对称加密');

console.log('\n【TCP 关键数】');
console.log('  三次握手 : SYN -> SYN+ACK -> ACK（建立连接）');
console.log('  四次挥手 : FIN -> ACK / FIN -> ACK（双向关闭，所以四次）');
console.log('  可靠性   : 序列号 + 确认号 + 重传 + 校验和');

console.log('\n【HTTP/2 vs HTTP/1.1】');
console.log('  多路复用 : 一个连接里多条流并发，解决队头阻塞');
console.log('  头部压缩 : HPACK，重复的头不再重复传');
console.log('  二进制帧 : 不再是纯文本，机器好解析');

console.log('\n【真实错误码】');
console.log('  ECONNREFUSED : 端口没人监听（连接被拒）');
console.log('  ENOTFOUND    : 域名查不到');
console.log('  ETIMEDOUT    : 连接超时');
console.log('  ECONNRESET   : 对端把连接重置了');

console.log('\n========== 速查结束，面试加油 ==========');
