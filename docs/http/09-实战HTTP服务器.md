# 第 09 章 · 实战：从零写一个完整的 HTTP 服务器

> 前面八章你学了 TCP、IP、DNS、HTTP 报文、缓存、HTTPS。这一章**全拼起来**——从零写一个能处理路由、静态文件、JSON 的完整 HTTP 服务器。
> 写完你会发现：所谓"服务器框架"，不过是在这个骨架上不断加东西。
>
> 本章你需要记住的就一件事：**一个 HTTP 服务器 = 解析请求行（方法+路径）→ 按路由分发 → 读 body（如果需要）→ 构造响应（状态码 + 头 + body）。**
>
> 这一条想清楚了，Express、Koa、Fastify 这些框架，你都能一眼看穿它们的本质。

---

## 09.1 目标：从零写一个完整的服务器

**先说结论**：这一章的产物，是一个**零依赖、能跑、功能完整**的 HTTP 服务器，具备四件事：REST 路由、静态文件、JSON API、错误兜底。配套示例 `examples/http/09-完整HTTP服务器.mjs` 已经写好，先看它能干什么。

**功能清单：**

| 功能 | 说明 |
|---|---|
| REST 路由 | GET/POST/PUT/DELETE 处理用户资源 |
| 静态文件 | 从磁盘读文件返回 |
| JSON API | 正确设置 Content-Type、解析 body |
| 错误兜底 | 404、204、错误处理一个不少 |

**先跑一遍，看完整输出**（配套示例自测的结果）：

```text
== 1. REST 路由 ==
  GET /api/users -> 200 OK  body: [{"id":1,"name":"小明"},{"id":2,"name":"小红"}]
  POST /api/users -> 201 Created  body: {"id":3,"name":"小刚"}
  GET /api/users/3 -> 200 OK  body: {"id":3,"name":"小刚"}
  PUT /api/users/3 -> 200 OK  body: {"id":3,"name":"小刚(改)"}
  DELETE /api/users/3 -> 204 No Content
  GET /api/users/3 -> 404 Not Found  body: {"error":"Not Found"}

== 2. 静态文件 ==
  GET / -> 200 OK  body: 【静态文件服务演示】...

== 3. 兜底 404 ==
  GET /no-such-path -> 404 Not Found  body: {"error":"Not Found"}
```

**注意这段输出里，前几章学的全都在**：201 Created（建）、204 No Content（删）、404 Not Found（查不到）、JSON 的 Content-Type。下面一步步把它搭起来。

> 一句话记住它：一个 HTTP 服务器就是"解析请求 → 路由分发 → 读 body → 构造响应"这条流水线；框架只是给它加了更多糖。

---

## 09.2 骨架：createServer + 路由分发

**先说结论**：服务器的骨架就两层——`http.createServer` 里，拿到请求，根据**方法 + 路径**分发到不同处理逻辑。

**最简骨架：**

```js
import http from 'node:http';

const server = http.createServer(async (req, res) => {
  const { method } = req;
  const [path] = req.url.split('?'); // 去掉 query string

  if (method === 'GET' && path === '/api/users') {
    // 查所有用户
  } else if (method === 'GET' && path.startsWith('/api/users/')) {
    // 查单个用户
  } else if (method === 'POST' && path === '/api/users') {
    // 新建用户
  } else {
    // 兜底 404
  }
});
```

**三个关键点，第一次写要注意：**

1. **`req.url` 带 query string**。请求 `/api/users?page=2` 时，`req.url` 是 `/api/users?page=2`。要路由，得先 `split('?')` 把路径和参数分开。
2. **`startsWith` 匹配"带参数的路由"**。`/api/users/3` 这种路径，用 `startsWith('/api/users/')` 匹配，再取后面的 id。
3. **顺序很重要**。`/api/users`（精确）要放在 `/api/users/`（前缀）**之前**判断，否则 `/api/users` 也可能被前缀匹配到。

**取路径参数（id）**：

```js
const id = Number(path.split('/')[3]); // '/api/users/3' → ['', 'api', 'users', '3']
```

`'/api/users/3'.split('/')` 得到 `['', 'api', 'users', '3']`，第 3 个元素就是 id。

> 一句话记住它：骨架 = createServer + 按"方法+路径"if/else 分发；记得 `req.url` 要去掉 query string，精确路由放前缀路由前面。

---

## 09.3 REST 路由：增删改查

**先说结论**：把"用户"资源做成完整的增删改查，用内存数组当"数据库"。

**数据用一个内存数组模拟：**

```js
let users = [
  { id: 1, name: '小明' },
  { id: 2, name: '小红' },
];
```

**查（GET）：**

```js
// 查所有
if (method === 'GET' && path === '/api/users') {
  sendJSON(res, 200, users);
}
// 查单个
else if (method === 'GET' && path.startsWith('/api/users/')) {
  const id = Number(path.split('/')[3]);
  const u = users.find((x) => x.id === id);
  u ? sendJSON(res, 200, u) : sendJSON(res, 404, { error: 'Not Found' });
}
```

**增（POST）：**

```js
else if (method === 'POST' && path === '/api/users') {
  const body = await readBody(req);
  const u = { id: users.length + 1, name: body.name };
  users.push(u);
  sendJSON(res, 201, u); // 201 Created
}
```

**改（PUT）：**

```js
else if (method === 'PUT' && path.startsWith('/api/users/')) {
  const id = Number(path.split('/')[3]);
  const body = await readBody(req);
  const u = users.find((x) => x.id === id);
  if (!u) return sendJSON(res, 404, { error: 'Not Found' });
  u.name = body.name;
  sendJSON(res, 200, u);
}
```

**删（DELETE）：**

```js
else if (method === 'DELETE' && path.startsWith('/api/users/')) {
  const id = Number(path.split('/')[3]);
  const before = users.length;
  users = users.filter((x) => x.id !== id);
  if (users.length === before) return sendJSON(res, 404, { error: 'Not Found' });
  sendJSON(res, 204, null); // 204 No Content
}
```

**注意两个细节：**

1. `users = users.filter(...)` 是**重新赋值**（不是 `users.push`/`splice` 原地改），这样逻辑更清晰。
2. DELETE 返回 `204`，且**没有 body**——这是 REST 惯例。

> 一句话记住它：增删改查就是"方法 + 路径 → 操作内存数组 → 返回对应状态码"；POST 建 201、DELETE 删 204、查不到 404。

---

## 09.4 解析请求体（POST/PUT 的 body）

**先说结论**：GET 的数据在 URL，POST/PUT 的数据在 **body**。body 是流式到达的，要**一段段攒起来**，最后才解析。

**为什么 body 要"攒"？** 因为 TCP 是字节流（第 01 章），body 可能分好几次 `data` 事件才到齐。你得监听 `data` 累积，监听 `end` 表示"收完了"：

```js
function readBody(req) {
  return new Promise((resolve) => {
    let b = '';
    req.on('data', (c) => (b += c)); // 一段段攒
    req.on('end', () => resolve(b ? JSON.parse(b) : {})); // 收完解析
  });
}
```

**用 Promise 包起来**，就能在 `async` 函数里 `await readBody(req)` 直接拿到解析好的对象。

**三个要注意的点：**

1. **`JSON.parse` 可能抛错**。如果客户端发了非法 JSON，`JSON.parse` 会抛 `SyntaxError`。严谨点应该 `try/catch` 并返回 400（第 08 章的工程化要求）。
2. **body 可能为空**。GET 请求没 body，`b` 是空字符串，`JSON.parse('')` 会抛错，所以要 `b ? JSON.parse(b) : {}` 兜底。
3. **大数据要限制大小**。生产环境要限制 body 大小（防止恶意上传撑爆内存），这里演示用简化的。

**完整的、带错误处理的 readBody：**

```js
function readBody(req) {
  return new Promise((resolve, reject) => {
    let b = '';
    req.on('data', (c) => (b += c));
    req.on('end', () => {
      try {
        resolve(b ? JSON.parse(b) : {});
      } catch {
        reject(new Error('非法 JSON'));
      }
    });
  });
}
```

> 一句话记住它：body 是流式的，要 `data` 累积、`end` 解析；用 Promise 包起来才能 `await`；JSON.parse 要防非法输入。

---

## 09.5 JSON 响应：Content-Type 和状态码

**先说结论**：返回 JSON 时，**必须设置 `Content-Type: application/json`**，否则客户端不知道这是 JSON。把这个过程封装成一个 `sendJSON` 函数，处处复用。

**封装 `sendJSON`：**

```js
function sendJSON(res, statusCode, data) {
  if (statusCode === 204) {
    res.statusCode = 204; // 204 不能有 body
    res.end();
    return;
  }
  const body = JSON.stringify(data);
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(body);
}
```

**这个函数干了三件事：**

1. **设置状态码**：`res.statusCode = statusCode`。
2. **设置 Content-Type**：告诉客户端"body 是 JSON"。
3. **序列化 + 发送**：`JSON.stringify` 把对象转成 JSON 字符串。

**为什么要封装？** 因为**几乎每个响应都要做这三件事**。不封装的话，每个路由里都要重复三行，容易漏（尤其漏 `Content-Type`，这是最常见的 bug）。

**`204` 的特殊处理**：204（No Content）表示"成功但没有内容"，**不能有 body**，所以单独分支，只 `res.end()` 不写内容。

**一个真实到要记住的坑**：如果你返回 JSON 但忘了设 `Content-Type: application/json`，浏览器/客户端会把它当**纯文本**处理，`fetch().json()` 可能解析失败。第 04 章的动手练习考过这个。

> 一句话记住它：返回 JSON 必须设 `Content-Type: application/json`；封装 `sendJSON` 统一处理"状态码 + Content-Type + 序列化"，204 单独分支（无 body）。

---

## 09.6 静态文件服务

**先说结论**：静态文件服务就是"**读磁盘文件 → 返回内容**"，核心是 `node:fs` 的 `readFile`，以及**根据文件类型设置正确的 Content-Type**。

**最简静态文件服务：**

```js
import fs from 'node:fs/promises';

// GET / → 读一个文件返回
const content = await fs.readFile('index.html', 'utf8');
res.statusCode = 200;
res.setHeader('Content-Type', 'text/html; charset=utf-8');
res.end(content);
```

**配套示例里，读的是脚本自己**（省得依赖外部文件）：

```js
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const content = await fs.readFile(__filename, 'utf8'); // 读自己
res.setHeader('Content-Type', 'text/plain; charset=utf-8');
res.end('【静态文件服务演示】这是服务器从磁盘读出来的文件前 200 字：\n\n' + content.slice(0, 200));
```

**真实项目里，静态文件服务要考虑三件事：**

1. **Content-Type 要按扩展名**：`.html` → `text/html`，`.css` → `text/css`，`.js` → `text/javascript`，`.png` → `image/png`。可以用 `mime` 库自动判断，或自己维护一个映射表。
2. **路径安全**：不能让用户用 `../` 访问到项目外的文件（**路径穿越攻击**）。要规范化路径并限制在根目录内。
3. **大文件用流**：`readFile` 会把整个文件读进内存，大文件应该用 `fs.createReadStream` 流式返回。

**一个必须防的安全漏洞——路径穿越：**

```js
// ❌ 危险：用户请求 /../../etc/passwd 可能读到系统文件
fs.readFile('/www' + req.url);

// ✅ 安全：规范化路径，确保仍在根目录内
const safePath = path.normalize('/www/' + req.url);
if (!safePath.startsWith('/www/')) return 403;
```

> 一句话记住它：静态文件 = `readFile` + 正确 Content-Type；真实项目要防"路径穿越"（`../`），大文件用流。

---

## 09.7 404 兜底和错误处理

**先说结论**：所有路由都没匹配上时，返回 404；处理过程出错时，捕获并返回 500。这两步是"服务器不会默默失败"的兜底。

**404 兜底**（放 if/else 链的**最后**）：

```js
else {
  sendJSON(res, 404, { error: 'Not Found' });
}
```

**错误处理**（用 `try/catch` 包住整个处理逻辑）：

```js
const server = http.createServer(async (req, res) => {
  try {
    // ... 所有路由逻辑
  } catch (err) {
    console.error('服务器错误:', err);
    sendJSON(res, 500, { error: 'Internal Server Error' });
  }
});
```

**为什么错误处理这么重要？** 因为 `async` 函数里的异常，如果没人 `catch`，会变成**未处理的 Promise 拒绝**，轻则这个请求卡死，重则进程崩溃。兜住它，返回 500，至少让客户端知道"服务器出错了"，而不是无限等待。

**完整的"兜底 + 错误处理"合起来：**

```text
正常路由（if/else 逐个匹配）
   ↓ 都没匹配
404 兜底（最后 else）
   ↓ 过程中抛错
try/catch 捕获 → 500
```

**这样，服务器对任何请求都"有响应"**——要么是数据、要么是 404、要么是 500，绝不沉默。

> 一句话记住它：if/else 链最后放 404 兜底，外面套 try/catch 捕获异常返回 500——服务器对任何请求都要"有响应"。

---

## 09.8 完整代码走读

**先说结论**：把所有零件拼起来，就是完整的服务器。配套示例 `examples/http/09-完整HTTP服务器.mjs` 已经写好，这里走读它的结构。

**完整的结构（自上而下）：**

```js
// 1. 导入（全是内置模块）
import http from 'node:http';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// 2. 数据（内存数组当数据库）
let users = [{ id: 1, name: '小明' }, { id: 2, name: '小红' }];

// 3. 工具函数
function sendJSON(res, statusCode, data) { /* 09.5 */ }
function readBody(req) { /* 09.4 */ }

// 4. 服务器主体（路由分发）
const server = http.createServer(async (req, res) => {
  const { method } = req;
  const [path] = req.url.split('?');

  // REST 路由（09.3）
  // 静态文件（09.6）
  // 404 兜底（09.7）
});

// 5. 启动 + 自测
server.listen(0, '127.0.0.1', async () => { /* 09.9 */ });
```

**这个结构就是所有 HTTP 框架的雏形**。Express 的 `app.get('/users', handler)`、Koa 的中间件、Fastify 的路由表，本质都是"**把 URL 映射到处理函数**"，只是用更高级的方式组织起来。

**看懂了这个，你再看任何框架都不会慌**——它们只是在"路由分发"这层加了：中间件、参数解析、校验、错误处理中间件、模板引擎……但骨架永远是"解析请求 → 路由分发 → 构造响应"。

> 一句话记住它：完整服务器 = 数据 + 工具函数（sendJSON/readBody）+ 路由分发 + 兜底 + 启动；这就是所有 HTTP 框架的雏形。

---

## 09.9 自测：自己请求自己

**先说结论**：写完服务器，**要真的测一遍**。配套示例用的是"服务器自己 `fetch` 自己"——起服务、发请求、验证响应、关服务。这也是一种工程化习惯：**写完必测**。

**自测代码：**

```js
server.listen(0, '127.0.0.1', async () => {
  const base = `http://127.0.0.1:${server.address().port}`;

  async function api(method, path, body) {
    const res = await fetch(base + path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    console.log(`${method} ${path} -> ${res.status} ${res.statusText}${text ? '  body: ' + text : ''}`);
  }

  await api('GET', '/api/users');
  await api('POST', '/api/users', { name: '小刚' });
  // ... 逐个测
  server.close(() => console.log('进程自然退出'));
});
```

**为什么用 `fetch`？** 因为 Node 18+ 内置了 `fetch`（和浏览器一样），比 `http.request` 简洁得多，读起来一目了然。

**自测覆盖了哪些情况？** 看配套示例的输出：

```text
GET /api/users -> 200 OK            ← 查
POST /api/users -> 201 Created      ← 增
GET /api/users/3 -> 200 OK          ← 查单个
PUT /api/users/3 -> 200 OK          ← 改
DELETE /api/users/3 -> 204 No Content ← 删
GET /api/users/3 -> 404 Not Found   ← 删完再查，验证 404
```

**最后一个请求很关键**：删完 3 号用户后，再 `GET /api/users/3`，验证它返回 404——这证明"删除真的生效了"。**自测不能只测"正常路径"，要测"边界和异常"。**

> 一句话记住它：写完必测，用内置 `fetch` 自己请求自己；自测要覆盖正常路径 + 边界（删完再查、不存在的路径）。

---

## 09.10 本章常见坑速查

| 坑 | 现象 | 原因 | 正确做法 |
|---|---|---|---|
| 返回 JSON 忘了设 Content-Type | 客户端解析不出 JSON | 客户端不知道 body 是 JSON | `sendJSON` 统一设 `Content-Type: application/json` |
| `req.url` 带 query 却直接路由 | 路由匹配不上 | `req.url` 含 `?xxx` | 先 `split('?')[0]` 取路径 |
| 204 响应写了 body | 客户端行为异常 | 204 表示"无内容" | 204 只 `res.end()` 不写 body |
| `JSON.parse` 非法 body 抛错 | 服务器崩/请求卡死 | body 可能是非法 JSON | `try/catch` 包裹，返回 400 |
| 静态文件不防路径穿越 | 能读系统任意文件 | `../` 没被拦 | `path.normalize` 并限制根目录 |
| 异步处理函数没 catch | 进程崩或请求卡死 | async 异常无人捕获 | 外面套 `try/catch` 返回 500 |
| 精确路由放在前缀路由后面 | 精确路由永远不命中 | `/api/users` 被 `/api/users/` 前缀误匹配 | 精确路由放前面 |

---

## 09.11 本章小结

- **服务器骨架** = 解析请求行（方法+路径）→ 路由分发 → 读 body → 构造响应。
- **REST 增删改查**：GET 查、POST 建（201）、PUT 改、DELETE 删（204）、查不到 404。
- **body 是流式的**：`data` 累积、`end` 解析；`JSON.parse` 要防非法输入。
- **`sendJSON` 统一处理**状态码 + `Content-Type: application/json` + 序列化。
- **静态文件** = `readFile` + 正确 Content-Type；防路径穿越，大文件用流。
- **兜底**：if/else 链最后放 404，外面套 try/catch 返回 500。
- **写完必测**：用内置 `fetch` 自测，覆盖正常 + 边界。
- **这就是所有框架的雏形**：框架只是给"路由分发"加了中间件、校验、模板等。

---

## 09.12 动手练习

**1. 给这个服务器加一个 `GET /api/users?name=小明` 的按名字过滤功能。怎么写？**

<details><summary>参考答案</summary>

先解析 query string，再过滤：

```js
import { URL } from 'node:url';

// 解析完整 URL，拿到 query 参数
const u = new URL(req.url, 'http://localhost');
const name = u.searchParams.get('name');

if (method === 'GET' && path === '/api/users') {
  const result = name ? users.filter((x) => x.name === name) : users;
  sendJSON(res, 200, result);
}
```

用内置的 `URL` 类解析 query string，比手动 `split('&')` 可靠得多。

</details>

**2. 服务器返回 JSON 时忘了设 Content-Type，客户端会怎样？怎么修？**

<details><summary>参考答案</summary>

客户端（如 `fetch().json()`）不会自动把它当 JSON 解析——要么解析失败，要么得到纯文本。修法是每个 JSON 响应都设 `Content-Type: application/json; charset=utf-8`，最好封装成 `sendJSON` 统一处理。

</details>

**3. DELETE 请求删除一个不存在的用户，应该返回什么？为什么？**

<details><summary>参考答案</summary>

返回 **404 Not Found**。删除的目标不存在，说明客户端请求了一个不存在的资源，这是 4xx 客户端错误。实现上：`filter` 前后长度没变，就说明"没删掉任何东西"（目标不存在），返回 404。

</details>

**4. 为什么 `readBody` 里要用 Promise 包起来，而不是直接读 `req.body`？**

<details><summary>参考答案</summary>

因为 Node 的 `req` 没有现成的 `req.body` 属性——body 是流式到达的，可能分几次 `data` 事件。必须监听 `data` 累积、监听 `end` 表示收完，再用 Promise 把"异步收集"包成可以 `await` 的形式。这也是为什么 Express 需要 `body-parser` 中间件来做这件事。

</details>

**5. 下面这段静态文件服务有什么安全问题？怎么修？**

```js
import fs from 'node:fs/promises';

const server = http.createServer(async (req, res) => {
  const content = await fs.readFile('/www' + req.url, 'utf8');
  res.end(content);
});
```

<details><summary>参考答案</summary>

有**路径穿越**漏洞：用户请求 `/../../etc/passwd`，`req.url` 会被拼成 `/www/../../etc/passwd`，绕过 `/www` 根目录，读到系统任意文件。

修法：规范化路径并校验仍在根目录内：

```js
import path from 'node:path';

const safe = path.normalize('/www' + req.url);
if (!safe.startsWith('/www/')) {
  res.statusCode = 403;
  return res.end('Forbidden');
}
const content = await fs.readFile(safe, 'utf8');
```

</details>

---

> 📖 **本章的代码示例**：`examples/http/09-完整HTTP服务器.mjs`
> 跑一下：`node examples/http/09-完整HTTP服务器.mjs`
>
> 下一章是**测试题**：五关，从"判断对错"到"项目实战"，用题目检验你前九章是真懂了还是只是看懂了。
