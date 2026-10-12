/**
 * 第 09 章配套示例 · 从零写一个完整的 HTTP 服务器
 *
 * 一次写全四件事，全部零依赖：
 *  1. 路由：REST 风格，GET / POST / PUT / DELETE 各司其职
 *  2. 静态文件：把磁盘上的文件读出来返回
 *  3. JSON API：正确设置 Content-Type、解析请求体
 *  4. 兜底：404、204（无内容）、错误处理一个不少
 *
 * 运行：node 09-完整HTTP服务器.mjs
 * 脚本会自己请求自己（自测各端点），然后自然退出。
 */

import http from 'node:http';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);

// 一个内存"数据库"，演示增删改查
let users = [
  { id: 1, name: '小明' },
  { id: 2, name: '小红' },
];

function sendJSON(res, statusCode, data) {
  if (statusCode === 204) {
    res.statusCode = 204; // 204 No Content：成功了，但没有 body
    res.end();
    return;
  }
  const body = JSON.stringify(data);
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve) => {
    let b = '';
    req.on('data', (c) => (b += c));
    req.on('end', () => resolve(b ? JSON.parse(b) : {}));
  });
}

const server = http.createServer(async (req, res) => {
  const { method } = req;
  const [path] = req.url.split('?'); // 去掉 query string

  // ── REST 路由 ─────────────────────────────────────────────
  if (method === 'GET' && path === '/api/users') {
    sendJSON(res, 200, users);
  } else if (method === 'GET' && path.startsWith('/api/users/')) {
    const id = Number(path.split('/')[3]);
    const u = users.find((x) => x.id === id);
    u ? sendJSON(res, 200, u) : sendJSON(res, 404, { error: 'Not Found' });
  } else if (method === 'POST' && path === '/api/users') {
    const body = await readBody(req);
    const u = { id: users.length + 1, name: body.name };
    users.push(u);
    sendJSON(res, 201, u); // 201 Created：新建成功
  } else if (method === 'PUT' && path.startsWith('/api/users/')) {
    const id = Number(path.split('/')[3]);
    const body = await readBody(req);
    const u = users.find((x) => x.id === id);
    if (!u) return sendJSON(res, 404, { error: 'Not Found' });
    u.name = body.name;
    sendJSON(res, 200, u);
  } else if (method === 'DELETE' && path.startsWith('/api/users/')) {
    const id = Number(path.split('/')[3]);
    const before = users.length;
    users = users.filter((x) => x.id !== id);
    if (users.length === before) return sendJSON(res, 404, { error: 'Not Found' });
    sendJSON(res, 204, null);
  }

  // ── 静态文件 ───────────────────────────────────────────────
  else if (method === 'GET' && path === '/') {
    // 把这个脚本自己当"静态文件"读出来，演示文件服务（真实项目读的是 html/js/css）
    const content = await fs.readFile(__filename, 'utf8');
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('【静态文件服务演示】这是服务器从磁盘读出来的文件前 200 字：\n\n' + content.slice(0, 200));
  }

  // ── 兜底 ───────────────────────────────────────────────────
  else {
    sendJSON(res, 404, { error: 'Not Found' });
  }
});

server.listen(0, '127.0.0.1', async () => {
  const base = `http://127.0.0.1:${server.address().port}`;
  console.log('服务器监听在 ' + base + '\n');

  async function api(method, path, body) {
    const res = await fetch(base + path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    console.log(`  ${method} ${path} -> ${res.status} ${res.statusText}${text ? '  body: ' + text : ''}`);
    return res;
  }

  console.log('== 1. REST 路由 ==');
  await api('GET', '/api/users');
  await api('POST', '/api/users', { name: '小刚' });
  await api('GET', '/api/users/3');
  await api('PUT', '/api/users/3', { name: '小刚(改)' });
  await api('DELETE', '/api/users/3');
  await api('GET', '/api/users/3'); // 已删除，应为 404
  console.log('');

  console.log('== 2. 静态文件 ==');
  await api('GET', '/');
  console.log('');

  console.log('== 3. 兜底 404 ==');
  await api('GET', '/no-such-path');
  console.log('');

  server.close(() => console.log('进程自然退出'));
});
