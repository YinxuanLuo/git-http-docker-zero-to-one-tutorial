/**
 * 第 08 章配套示例 · 一个"可调试"的 HTTP 服务器
 *
 * 抓包调试的思路：别靠猜，靠日志。这个服务器把每个请求都记下来：
 *  - 谁（来源 IP）、什么方法、什么路径
 *  - 花了多久、返回了什么状态码
 *  - 出错时打印错误原因，而不是让进程默默崩掉
 *
 * 同时演示三个最常见状态码的真实形态：
 *  - 404 Not Found（资源不存在）
 *  - 500 Internal Server Error（服务器自己崩了）
 *  - 400 Bad Request（客户端发的请求协议错了）
 *
 * 运行：node 08-可调试服务器.mjs
 */

import http from 'node:http';
import net from 'node:net';

// 统一日志：带时间戳，一眼能看出顺序和耗时
function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

const server = http.createServer((req, res) => {
  const start = Date.now();
  const ip = req.socket.remoteAddress;

  // 关键技巧：包一层 res.end，让"记日志"这件事自动发生，
  // 这样不管哪个分支 return，都会打印一条"请求 -> 状态码 -> 耗时"。
  const originalEnd = res.end;
  res.end = function (...args) {
    log(`[${req.method}] ${req.url} -> ${res.statusCode}（${Date.now() - start} ms）来自 ${ip}`);
    originalEnd.apply(res, args);
  };

  try {
    if (req.url === '/404') {
      res.statusCode = 404;
      res.end('404 Not Found');
    } else if (req.url === '/500') {
      // 故意抛错，测试 500 的处理路径
      throw new Error('模拟：数据库连接挂了');
    } else if (req.url === '/slow') {
      // 慢请求：观察日志里的耗时
      setTimeout(() => {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end('慢请求完成');
      }, 300);
    } else if (req.url === '/') {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('这是可调试服务器的根路径');
    } else {
      res.statusCode = 404;
      res.end('404 Not Found');
    }
  } catch (err) {
    // 出错不崩：打印真实原因，返回 500
    log('  ⚠ 处理出错:', err.message);
    res.statusCode = 500;
    res.end('500 Internal Server Error');
  }
});

// 客户端发了个非法 HTTP 请求（协议层错误），服务器也别崩
server.on('clientError', (err, socket) => {
  log('  客户端协议错误:', err.code, err.message);
  socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});

server.listen(0, '127.0.0.1', () => {
  const port = server.address().port;
  console.log('服务器监听在 127.0.0.1:' + port);
  console.log('');

  const get = (path) =>
    new Promise((resolve) => {
      http.get({ host: '127.0.0.1', port, path }, (res) => {
        let b = '';
        res.on('data', (c) => (b += c));
        res.on('end', () => resolve({ status: res.statusCode, body: b }));
      });
    });

  (async () => {
    console.log('== 客户端依次请求，观察服务器日志 ==\n');

    const r1 = await get('/');
    console.log(`[client] GET / -> ${r1.status} ${r1.body}\n`);

    const r2 = await get('/404');
    console.log(`[client] GET /404 -> ${r2.status} ${r2.body}\n`);

    const r3 = await get('/500');
    console.log(`[client] GET /500 -> ${r3.status} ${r3.body}\n`);

    await get('/slow');
    console.log('[client] GET /slow -> 上面日志里能看到 300ms 的耗时\n');

    // 制造一个 400：往服务器发一段不是 HTTP 的垃圾字节
    console.log('== 用裸 socket 发一段垃圾，触发 clientError -> 400 ==');
    await new Promise((resolve) => {
      const s = net.createConnection({ host: '127.0.0.1', port }, () => {
        s.write('这不是合法的 HTTP 请求\r\n\r\n');
      });
      s.on('data', (d) => console.log('[client] 收到:', d.toString().trim()));
      s.on('close', resolve);
    });

    console.log('');
    server.close(() => console.log('进程自然退出'));
  })();
});
