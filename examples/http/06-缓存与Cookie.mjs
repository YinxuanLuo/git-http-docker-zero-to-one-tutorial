/**
 * 第 06 章配套示例 · HTTP 缓存与 Cookie
 *
 * 用 node:http 起一个服务，客户端按顺序发请求，观察：
 *  1. ETag / If-None-Match：内容没变，返回 304 Not Modified，省流量
 *  2. Last-Modified / If-Modified-Since：另一种协商缓存
 *  3. Cache-Control：强缓存，告诉浏览器"这个资源 60 秒内别再来问"
 *  4. Cookie：服务器 Set-Cookie，浏览器下次自动带上 Cookie 头
 *
 * 运行：node 06-缓存与Cookie.mjs
 */

import http from 'node:http';

const ETAG = '"v1"';
const LAST_MODIFIED = new Date('2024-01-01T00:00:00Z').toUTCString();

// 用一个小计数器，让"第一次请求"和"第二次请求"的行为不一样
const server = http.createServer((req, res) => {
  console.log(`[server] 收到 ${req.method} ${req.url}`);
  console.log(`  Cookie        : ${req.headers.cookie || '(无)'}`);
  console.log(`  If-None-Match : ${req.headers['if-none-match'] || '(无)'}`);
  console.log(`  If-Modified-Since: ${req.headers['if-modified-since'] || '(无)'}`);

  if (req.url === '/etag') {
    // 协商缓存：客户端带着上次的 ETag 来问"变了没"
    if (req.headers['if-none-match'] === ETAG) {
      res.statusCode = 304; // 304 Not Modified，不返回 body，省流量
      res.end();
      console.log('  -> 304 Not Modified（ETag 命中，内容没变）');
    } else {
      res.setHeader('ETag', ETAG);
      res.setHeader('Cache-Control', 'public, max-age=60'); // 60 秒内强缓存
      res.end('这是 ETag 资源，内容固定');
      console.log('  -> 200 OK（首次，带上 ETag 和 Cache-Control）');
    }
  } else if (req.url === '/lm') {
    // 另一种协商缓存：用"最后修改时间"
    if (req.headers['if-modified-since'] === LAST_MODIFIED) {
      res.statusCode = 304;
      res.end();
      console.log('  -> 304 Not Modified（Last-Modified 命中）');
    } else {
      res.setHeader('Last-Modified', LAST_MODIFIED);
      res.end('这是 Last-Modified 资源');
      console.log('  -> 200 OK（首次，带上 Last-Modified）');
    }
  } else if (req.url === '/login') {
    // 种 cookie：HttpOnly 让 JS 读不到，Path 限定作用范围
    res.setHeader('Set-Cookie', 'sid=abc123; HttpOnly; Path=/; Max-Age=3600');
    res.end('登录成功，已种下 cookie: sid=abc123');
    console.log('  -> 200 OK（Set-Cookie: sid=abc123）');
  } else {
    res.end('hello');
  }
  console.log('');
});

server.listen(0, '127.0.0.1', () => {
  const port = server.address().port;
  const base = { host: '127.0.0.1', port, headers: {} };

  // 顺序请求，模拟浏览器一步步的行为
  function req(path, headers = {}) {
    return new Promise((resolve) => {
      http.get({ ...base, path, headers }, (res) => {
        let b = '';
        res.on('data', (c) => (b += c));
        res.on('end', () => resolve({ status: res.statusCode, body: b, headers: res.headers }));
      });
    });
  }

  (async () => {
    console.log('== 第 1 次请求 /etag（没有缓存） ==');
    const r1 = await req('/etag');
    console.log(`[client] 状态码 ${r1.status}，ETag=${r1.headers.etag}\n`);

    console.log('== 第 2 次请求 /etag（带上 If-None-Match） ==');
    const r2 = await req('/etag', { 'If-None-Match': r1.headers.etag });
    console.log(`[client] 状态码 ${r2.status}（304 表示"没变，用你本地缓存吧"）\n`);

    console.log('== 请求 /lm，演示 Last-Modified 协商 ==');
    const r3 = await req('/lm');
    console.log(`[client] 状态码 ${r3.status}，Last-Modified=${r3.headers['last-modified']}\n`);
    const r4 = await req('/lm', { 'If-Modified-Since': r3.headers['last-modified'] });
    console.log(`[client] 状态码 ${r4.status}（又是 304）\n`);

    console.log('== 请求 /login，观察 Set-Cookie ==');
    const r5 = await req('/login');
    console.log(`[client] 状态码 ${r5.status}，Set-Cookie=${r5.headers['set-cookie']}\n`);

    console.log('== 再次请求 /login，浏览器会自动带上 Cookie ==');
    const r6 = await req('/login', { Cookie: 'sid=abc123' });
    console.log(`[client] 状态码 ${r6.status}，服务端看到了 Cookie: sid=abc123\n`);

    server.close(() => console.log('进程自然退出'));
  })();
});
