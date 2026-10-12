/**
 * 第 04 章配套示例 · 亲眼看 HTTP 请求/响应报文
 *
 * 用 node:http 起一个服务，客户端发一个 POST 请求，
 * 把"请求报文"和"响应报文"的每一个部分都打印出来。
 *
 * 你要看清楚三件事：
 *  1. 请求报文 = 请求行 + 请求头 + （可选）请求体
 *  2. 响应报文 = 状态行 + 响应头 + 响应体
 *  3. 这些字段长什么样，浏览器每天替你发了什么
 *
 * 运行：node 04-HTTP报文.mjs
 */

import http from 'node:http';

const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    console.log('========== 收到的【请求报文】 ==========');
    // 请求行：方法 + 路径 + 协议版本
    console.log(`请求行: ${req.method} ${req.url} HTTP/${req.httpVersion}`);
    console.log('');
    console.log('请求头:');
    for (const [k, v] of Object.entries(req.headers)) {
      console.log(`  ${k}: ${v}`);
    }
    if (body) {
      console.log('');
      console.log('请求体:');
      console.log('  ' + body);
    }
    console.log('========================================');
    console.log('');

    // 构造响应报文
    res.statusCode = 200; // 状态码，规范值是 "200 OK"
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('X-Custom-Header', 'hello-world');
    res.end('收到你的 POST，请求体是: ' + body);
  });
});

server.listen(0, '127.0.0.1', () => {
  const port = server.address().port;
  console.log('[server] 监听在 127.0.0.1:' + port);
  console.log('');

  const data = JSON.stringify({ name: '小明', age: 18 });

  const req = http.request(
    {
      host: '127.0.0.1',
      port,
      method: 'POST',
      path: '/api/user',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    },
    (res) => {
      console.log('========== 收到的【响应报文】 ==========');
      // 状态行：协议版本 + 状态码 + 状态短语
      console.log(`状态行: HTTP/${res.httpVersion} ${res.statusCode} ${res.statusMessage}`);
      console.log('');
      console.log('响应头:');
      for (const [k, v] of Object.entries(res.headers)) {
        console.log(`  ${k}: ${v}`);
      }
      let resp = '';
      res.on('data', (c) => (resp += c));
      res.on('end', () => {
        console.log('');
        console.log('响应体:');
        console.log('  ' + resp);
        console.log('========================================');
        server.close(() => console.log('\n进程自然退出'));
      });
    },
  );

  req.write(data);
  req.end();
});
