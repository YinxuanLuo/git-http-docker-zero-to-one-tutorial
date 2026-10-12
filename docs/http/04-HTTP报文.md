# 第 04 章 · HTTP 报文：亲眼看请求和响应

> 前三章都在讲"地基"（TCP、IP、DNS）。这一章终于讲到主角——**HTTP 本身**。
> 你会发现前面学的全都没白费：正因为 TCP 可靠、DNS 能翻译，HTTP 才能放心地是"纯文本"。
>
> 本章你需要记住的就一件事：**HTTP 报文 = 起始行 + 头（一堆 `Key: Value`）+ 可选的消息体。请求的起始行是"方法 + 路径 + 版本"，响应的起始行是"版本 + 状态码 + 状态短语"。**
>
> 这一条记住了，你就能肉眼读任何一条 HTTP 报文，也能解释所有状态码的语义。

---

## 04.1 HTTP 是什么：跑在 TCP 之上的文本协议

**先说结论**：HTTP（HyperText Transfer Protocol，超文本传输协议）是**应用层**协议，它跑在 TCP（传输层）之上。因为 TCP 已经保证了可靠传输，HTTP 可以放心地是**纯文本**——你能用肉眼直接读它。

**为什么 HTTP 是纯文本？** 这正是第 00 章"分层"思想的结果：传输层（TCP）把"可靠送达"这件苦活包了，HTTP 只管"表达意图"，所以它没必要搞复杂的二进制编码，直接用人类能读的文本就行。

一条最简的 HTTP 请求，长这样（你可以手敲出来）：

```http
GET /index.html HTTP/1.1
Host: www.example.com
```

就两行。第一行是**请求行**（说"我要干嘛"），第二行是**请求头**（补充信息）。中间没有加密、没有压缩、没有魔法——**就是文本**。

**为什么要记住"它是文本"？** 因为这意味着：

1. 你可以用 `telnet`、`nc` 甚至手写 socket 直接跟 HTTP 服务器对话（第 01 章你已经干过了）。
2. 调试时，报文**看得见**，不用猜。
3. 正因为是文本，才有后面 HTTPS 要加密、HTTP/2 要压缩这些话题。

**一个容易混的点**：HTTP 是"文本协议"，但它的消息体**可以是任何二进制**——图片、视频、压缩包。HTTP 的"文本"指的是**头部那部分**是文本，消息体可以是任意字节（这就是为什么要有 `Content-Type` 头告诉对方"body 是什么格式"）。

> 一句话记住它：HTTP 是跑在 TCP 上的应用层文本协议；因为 TCP 已保证可靠，HTTP 敢用肉眼可读的纯文本。

---

## 04.2 请求报文：请求行 + 请求头 + 消息体

**先说结论**：一个 HTTP 请求报文，分成三段：**请求行**（一行）、**请求头**（若干行 `Key: Value`）、**消息体**（可选，跟头之间空一行）。

完整结构（`\r\n` 是回车换行，HTTP 的行分隔符）：

```http
POST /api/user HTTP/1.1          ← 请求行：方法 + 路径 + 版本
Host: example.com                ← 请求头开始
Content-Type: application/json   ← 每个头一行
Content-Length: 26               ← 头结束
                                 ← 空行（分隔头和体）
{"name":"小明","age":18}         ← 消息体（可选）
```

**三段的职责：**

| 段 | 内容 | 作用 |
|---|---|---|
| 请求行 | `方法 路径 版本` | "我要对哪个资源做什么" |
| 请求头 | 若干 `Key: Value` | 补充信息（我是谁、我要什么格式、body 多长…） |
| 消息体 | 任意字节 | 要发给服务器的数据（GET 通常没有，POST/PUT 常有） |

**请求行三要素拆开：**

- **方法（method）**：`GET`、`POST`、`PUT`、`DELETE`…（04.5、04.6 节详讲）
- **路径（path）**：`/api/user`，还可能带 query string（`?a=1&b=2`）
- **版本（version）**：`HTTP/1.1`（主流）、`HTTP/2`、`HTTP/3`

**关于那个空行**：头和信息体之间，必须有一个**空行**（`\r\n\r\n`）。服务器靠这个空行判断"头读完了，接下来是 body"。**没有这个空行，服务器会一直等，或者解析出错。**

**关于 `Content-Length`**：它告诉服务器"我的 body 有 26 个字节，你读完这 26 个字节，就是读完了整个 body"。因为 TCP 是字节流（第 01 章），服务器需要知道"body 到哪结束"。`Content-Length` 就是干这个的。

> 一句话记住它：请求报文 = 请求行 + 请求头 + （空行）+ 消息体；空行分隔头与体，`Content-Length` 告诉对方 body 有多长。

---

## 04.3 响应报文：状态行 + 响应头 + 消息体

**先说结论**：响应报文的结构和请求**几乎对称**，唯一的区别在起始行——响应的起始行是"**版本 + 状态码 + 状态短语**"，而不是"方法 + 路径"。

完整结构：

```http
HTTP/1.1 200 OK                      ← 状态行：版本 + 状态码 + 状态短语
Content-Type: text/plain; charset=utf-8   ← 响应头开始
Content-Length: 60                    ← 头结束
X-Custom-Header: hello-world
                                      ← 空行
收到你的 POST，请求体是: {"name":"小明","age":18}   ← 消息体
```

**状态行三要素拆开：**

- **版本**：`HTTP/1.1`
- **状态码（status code）**：`200`，一个 3 位数字，分类见 04.8~04.11
- **状态短语（reason phrase）**：`OK`，状态码的人类可读描述

**状态码的"百位数"分类，这是最重要的一张表：**

| 状态码 | 分类 | 含义 | 常见例子 |
|---|---|---|---|
| 1xx | 信息 | 临时响应 | 101（协议切换，WebSocket 用） |
| 2xx | 成功 | 请求被正确处理 | 200、201、204 |
| 3xx | 重定向 | 需要进一步操作 | 301、302、304 |
| 4xx | 客户端错 | 你（客户端）的请求有问题 | 400、401、403、404 |
| 5xx | 服务器错 | 服务器自己出问题了 | 500、502、503 |

**记住这个口诀：2 成功、3 重定向、4 客户错、5 服务器错。** 看到任何状态码，先看百位数，就知道"是谁的错"。

> 一句话记住它：响应报文 = 状态行 + 响应头 + （空行）+ 消息体；状态码百位数定调：2 成功、3 重定向、4 客户错、5 服务器错。

---

## 04.4 亲眼看报文：用 node:http 抓一次

**先说结论**：别再背结构了，**亲眼抓一条报文**。配套示例 `examples/http/04-HTTP报文.mjs` 起一个服务器，客户端发 POST，把请求和响应报文完整打印出来。

```js
import http from 'node:http';

const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    console.log('请求行:', `${req.method} ${req.url} HTTP/${req.httpVersion}`);
    for (const [k, v] of Object.entries(req.headers)) {
      console.log(`  ${k}: ${v}`);
    }
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('收到你的 POST，请求体是: ' + body);
  });
});

server.listen(0, '127.0.0.1', () => {
  const data = JSON.stringify({ name: '小明', age: 18 });
  http.request({
    host: '127.0.0.1',
    port: server.address().port,
    method: 'POST',
    path: '/api/user',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
  }, (res) => {
    // 打印响应报文
  }).end(data);
});
```

实测输出（本机 Node 22.22.2）：

```text
========== 收到的【请求报文】 ==========
请求行: POST /api/user HTTP/1.1

请求头:
  content-type: application/json
  content-length: 26
  host: 127.0.0.1:62978
  connection: keep-alive

请求体:
  {"name":"小明","age":18}
========================================

========== 收到的【响应报文】 ==========
状态行: HTTP/1.1 200 OK

响应头:
  content-type: text/plain; charset=utf-8
  x-custom-header: hello-world
  date: Mon, 12 Oct 2026 15:01:24 GMT
  connection: keep-alive
  keep-alive: timeout=5
  content-length: 60

响应体:
  收到你的 POST，请求体是: {"name":"小明","age":18}
========================================
```

**注意几个你写代码时没想到、但 Node 自动加的头：**

- `host`：你连的地址（**这个头几乎必须有**，见 04.14）。
- `connection: keep-alive`：Node 默认复用连接。
- `date`：服务器自动加的响应时间。
- `content-length`：body 长度，服务器自动算。

**这就是"抓包"的雏形**——你亲手把报文打出来了，后面第 08 章学调试就是在这个基础上加日志、计时、错误处理。

> 一句话记住它：`req.method`/`req.url`/`req.headers` 是请求报文的"请求行 + 头"；`res.statusCode`/`res.setHeader` 是响应报文的"状态行 + 头"——你写的代码，就是在拼这两段文本。

---

## 04.5 方法（一）：GET 与 POST 的分工

**先说结论**：`GET` 是"**取**"资源，`POST` 是"**提交/新建**"资源。它们语义不同，但底层都是 TCP 上的一次请求-响应，**技术上不是不能混用，而是不该混用**。

**GET：**

- 语义：**获取**资源（读）。
- 数据放哪：**URL 的 query string**（`?name=小明&age=18`）。
- 有没有 body：通常**没有**。
- 特性：**幂等**、**安全**（不改变服务器状态）。

```http
GET /api/users?page=2&size=10 HTTP/1.1
Host: example.com
```

**POST：**

- 语义：**新建**资源 / 提交数据（写）。
- 数据放哪：**消息体（body）**。
- 有没有 body：通常**有**。
- 特性：**不幂等**（每次调用可能产生不同的结果，比如每次新建都产生一条新记录）。

```http
POST /api/users HTTP/1.1
Host: example.com
Content-Type: application/json

{"name":"小明","age":18}
```

**为什么 GET 的数据放 URL，POST 放 body？** 这是约定，背后有实际考量：

| | 数据放 URL（GET） | 数据放 body（POST） |
|---|---|---|
| 长度 | 受 URL 长度限制（约 2KB~8KB） | 几乎无限制 |
| 可见性 | 出现在地址栏、日志里，**明文可见** | 不直接出现在 URL |
| 语义 | 适合"筛选/查询"这类可重复的读操作 | 适合"提交/创建"这类写操作 |

**一个常见误区**："GET 不能有 body"。技术上，HTTP 规范没禁止 GET 带 body，但**没有服务器/代理保证处理它**，而且语义混乱。所以实践中约定俗成：**GET 不用 body，数据放 query string。**

> 一句话记住它：GET 是"读"，数据放 URL，幂等；POST 是"写"，数据放 body，不幂等；不是技术不能混，是语义不该混。

---

## 04.6 方法（二）：PUT / DELETE / PATCH / HEAD

**先说结论**：除了 GET/POST，还有四个方法各司其职，合起来就是 REST 风格的"增删改查"（第 08 章会系统讲 REST）。

| 方法 | 语义 | 对应操作 | 幂等？ |
|---|---|---|---|
| GET | 读资源 | 查 | 是 |
| POST | 新建资源 | 增 | 否 |
| PUT | **整体替换**资源 | 改（整个换掉） | 是 |
| PATCH | **局部修改**资源 | 改（只改一部分） | 不一定 |
| DELETE | 删除资源 | 删 | 是 |
| HEAD | 只要头，不要 body | 查（省流量） | 是 |

**PUT 和 PATCH 的区别，是高频面试题：**

- `PUT /api/users/1`：把 1 号用户**整个替换**成你给的新对象（缺的字段会被删掉/覆盖）。
- `PATCH /api/users/1`：只**更新**你给的字段（比如只改名字，其他字段不变）。

**HEAD：**

- 和 GET 完全一样，但服务器**只返回头，不返回 body**。
- 用途：检查资源是否存在、看 `Content-Length` 大小、看缓存是否过期——**不用下载整个资源**。

```js
// 用 HEAD 检查一个资源有多大
http.request({ method: 'HEAD', host: 'example.com', path: '/big-file.zip' }, (res) => {
  console.log('大小:', res.headers['content-length']); // 不下载 body，也能知道大小
}).end();
```

**DELETE 返回 204 的惯例**：删除成功，通常返回 `204 No Content`（成功了，但没有东西可返回），而不是 200。第 09 章的完整服务器就这么写的。

> 一句话记住它：PUT 整体替换、PATCH 局部修改、DELETE 删除、HEAD 只要头；加上 GET/POST，就是 REST 的"增删改查"六件套。

---

## 04.7 幂等性：为什么它重要

**先说结论**：幂等（idempotent）的意思是——**同一个请求，执行 1 次和执行 100 次，结果是一样的**。这是一个方法的"安全属性"，直接影响你重试策略。

**为什么幂等重要？** 因为网络不可靠，请求可能超时、可能丢。你的程序经常需要**自动重试**。这时候就得想：这个请求能不能安全重试？

| 方法 | 幂等 | 重试安全吗 | 为什么 |
|---|---|---|---|
| GET | 是 | 安全 | 读 100 次结果一样 |
| PUT | 是 | 安全 | 整体替换，替换 100 次结果一样 |
| DELETE | 是 | 安全 | 删了再删，结果都是"没了" |
| POST | **否** | **不安全** | 每次新建，重试 100 次就新建 100 条 |
| PATCH | 不一定 | 看情况 | `+1` 这类操作不幂等，`设为 x` 这类幂等 |

**一个真实的灾难场景**：用户点"下单"按钮，网络卡了，请求没返回。前端如果自动重试一个 `POST /orders`，用户可能**下了两单**。这就是 POST 不幂等的代价。

**怎么解决 POST 不幂等的重试问题？** 常用"幂等键"（idempotency key）——客户端每次请求带一个唯一 ID，服务器记住这个 ID，收到重复的 ID 就返回第一次的结果，不重复执行。支付、下单接口都会做这个。

**一句话总结**：幂等性决定了"这个请求能不能放心重试"。

> 一句话记住它：幂等 = 执行 1 次和 100 次结果一样；GET/PUT/DELETE 幂等，POST 不幂等——重试前先想清楚它是不是幂等的。

---

## 04.8 状态码（一）：2xx 成功

**先说结论**：2xx 表示"请求被成功处理了"。最常用的是 `200`、`201`、`204`，三者的差别在"成功之后返回了什么"。

| 状态码 | 短语 | 含义 | 典型场景 |
|---|---|---|---|
| 200 | OK | 成功，正常返回 | 最常见的成功 |
| 201 | Created | 成功，并且**创建了新资源** | POST 新建成功后 |
| 204 | No Content | 成功，但**没有 body** | DELETE 删除成功后 |

**`200` vs `201` vs `204`，用代码感受差别：**

```js
// 200：普通成功
res.statusCode = 200;
res.end('这是数据');

// 201：新建成功
res.statusCode = 201;
res.end(JSON.stringify(newUser));

// 204：成功但无内容（注意：不能有 body！）
res.statusCode = 204;
res.end(); // 不能再写 body，否则行为未定义
```

**一个容易踩的坑**：`204` 是"没有 body"的，如果你给 204 的响应写了 body，浏览器和客户端可能报错或行为异常。所以 204 就干干净净 `res.end()`。

> 一句话记住它：2xx 是成功；200 正常返回，201 新建了资源，204 成功但没内容（不能有 body）。

---

## 04.9 状态码（二）：3xx 重定向

**先说结论**：3xx 表示"你要的资源不在这，去别处找"。核心是 `301`、`302`、`304`，其中 **304 不是重定向，是缓存**（要特别记）。

| 状态码 | 短语 | 含义 | 关键点 |
|---|---|---|---|
| 301 | Moved Permanently | **永久**移动 | 浏览器会记住新地址，下次直接去 |
| 302 | Found | **临时**移动 | 浏览器这次跳转，下次还来问原地址 |
| 304 | Not Modified | **没变，用缓存** | 不是重定向，是告诉客户端"内容没变" |

**301 和 302 的区别**，是面试常考题：

- `301`（永久）：资源**永久**搬家了，浏览器会**缓存**这个跳转，下次直接访问新地址。
- `302`（临时）：资源**临时**换位置，浏览器**不缓存**，下次还来问原地址。

**典型场景**：

- `301`：网站从 `http://` 永久迁移到 `https://`，或换域名。
- `302`：用户未登录访问某页，临时跳转到登录页。

**重定向靠哪个头？** 服务器返回 301/302 时，会用 `Location` 头告诉浏览器"去这里"：

```js
res.statusCode = 302;
res.setHeader('Location', '/login');
res.end();
```

**304 是缓存，不是重定向**——它没有 `Location`，意思是"内容没变，用你本地缓存的就行"。第 06 章会详细讲它和 ETag/Last-Modified 的关系。

> 一句话记住它：301 永久跳转（浏览器会记住）、302 临时跳转、304 不是跳转是"用缓存"；重定向靠 `Location` 头指明新地址。

---

## 04.10 状态码（三）：4xx 客户端错

**先说结论**：4xx 表示"**你（客户端）的请求有问题**"。看到 4xx，先别怪服务器，先检查自己的请求。核心是 `400`、`401`、`403`、`404`。

| 状态码 | 短语 | 含义 | 通俗说法 |
|---|---|---|---|
| 400 | Bad Request | 请求格式错了 | "你说的我根本听不懂" |
| 401 | Unauthorized | 没认证 / 没登录 | "你是谁？先证明身份" |
| 403 | Forbidden | 认证了，但没权限 | "我知道你是谁，但你没资格" |
| 404 | Not Found | 资源不存在 | "没有这个东西" |

**`401` 和 `403` 的区别，是最经典的混淆点：**

| | 401 Unauthorized | 403 Forbidden |
|---|---|---|
| 问题 | **没登录**（不知道你是谁） | **登录了但没权限**（知道你是谁，但不许你看） |
| 例子 | 没带 token 访问个人中心 | 普通用户想访问管理员后台 |
| 常见场景 | 跳转登录 | 提示"无权访问" |

**`404` 的两种真实来源**：资源真不存在，或者**路由没匹配到**（很多框架的兜底就是 404）。第 09 章完整服务器里，所有没匹配上的路由都返回 404：

```js
else {
  sendJSON(res, 404, { error: 'Not Found' });
}
```

**`400` 的常见来源**：JSON 格式错、字段缺失、参数类型错。服务器解析请求体失败时，通常回 400。

> 一句话记住它：4xx 是你的错；400 格式错、401 没登录、403 没权限、404 不存在——401 和 403 的区别是"不知道你是谁" vs "知道你是谁但不让看"。

---

## 04.11 状态码（四）：5xx 服务器错

**先说结论**：5xx 表示"**服务器自己出问题了**"。看到 5xx，客户端没做错什么，是服务器要修。核心是 `500`、`502`、`503`。

| 状态码 | 短语 | 含义 | 通俗说法 |
|---|---|---|---|
| 500 | Internal Server Error | 服务器内部崩了 | "我自己代码报错了" |
| 502 | Bad Gateway | 上游服务器挂了 | "我去找别人，别人挂了" |
| 503 | Service Unavailable | 服务暂时不可用 | "我忙不过来/在维护" |

**三个的区别，用一个"服务器是中介"的场景讲：**

- `500`：你自己的代码抛异常了（比如 `undefined.foo`、数据库语法错）。这是**你自己**的锅。
- `502`：你是网关/反向代理，你去问"真正的后端"，后端**挂了或返回了非法响应**。这是**上游**的锅。
- `503`：服务器**没崩**，但故意不接受请求——要么过载了（扛不住），要么在维护。

**一个真实场景串起来**：Nginx（反向代理）→ 你的 Node 服务 → 数据库。

```text
数据库挂了 → Node 服务报错 → 返回 500
Node 服务整个挂了 → Nginx 连不上它 → Nginx 返回 502
Node 服务在发版/重启 → 主动返回 503（"稍后再来"）
```

**`502` 和 `503` 谁背锅，是运维常争论的点**：502 是"上游彻底没了"，503 是"我还活着但暂时不干活"。

> 一句话记住它：5xx 是服务器的错；500 自己代码崩、502 上游挂了、503 服务过载/维护中——502 是"上游没了"，503 是"我还活着但不干活"。

---

## 04.12 常见请求头

**先说结论**：请求头是客户端告诉服务器的"补充信息"。你不需要背全，但下面这几个**必须认识**，因为它们天天出现、还常常是 bug 的来源。

| 请求头 | 含义 | 例子 |
|---|---|---|
| `Host` | 目标主机（域名:端口） | `Host: example.com` |
| `User-Agent` | 我是谁（浏览器/程序名） | `User-Agent: Mozilla/5.0 …` |
| `Accept` | 我能接受什么格式 | `Accept: application/json` |
| `Content-Type` | body 是什么格式 | `Content-Type: application/json` |
| `Content-Length` | body 有多长（字节） | `Content-Length: 26` |
| `Authorization` | 身份凭证 | `Authorization: Bearer xxx` |
| `Cookie` | 我之前存的会话信息 | `Cookie: sid=abc123` |
| `Referer` | 我从哪个页面来的 | `Referer: https://a.com/page` |
| `Accept-Encoding` | 我能接受什么压缩 | `Accept-Encoding: gzip, br` |

**两个特别容易出 bug 的头：**

1. **`Content-Length` 和 `Content-Type` 要配 body 一起用**。发 POST 时忘了 `Content-Type: application/json`，服务器可能解析不出你的 JSON；忘了 `Content-Length`，服务器可能不知道 body 到哪结束。

2. **`Accept-Encoding` 会导致 body 被压缩**。如果你代码里没处理解压，拿到的是乱码（gzip 的二进制）。第 08 章会讲到这个坑。

**在 Node 里读请求头**：`req.headers` 是个对象，注意**头名是小写**的（Node 统一转小写）：

```js
console.log(req.headers['content-type']); // 不是 'Content-Type'
```

> 一句话记住它：请求头是"客户端自我介绍"；`Host`/`Content-Type`/`Content-Length`/`Cookie`/`Authorization` 这几个必须认识，Node 里 `req.headers` 的头名都是小写。

---

## 04.13 常见响应头

**先说结论**：响应头是服务器告诉客户端的"补充信息"。同样，认识这几个高频的就够用。

| 响应头 | 含义 | 例子 |
|---|---|---|
| `Content-Type` | body 是什么格式 | `Content-Type: text/html; charset=utf-8` |
| `Content-Length` | body 有多长 | `Content-Length: 60` |
| `Set-Cookie` | 让浏览器存 cookie | `Set-Cookie: sid=abc123; HttpOnly` |
| `Location` | 重定向目标 | `Location: /login` |
| `Cache-Control` | 缓存策略 | `Cache-Control: max-age=60` |
| `ETag` | 资源的版本标识 | `ETag: "v1"` |
| `Last-Modified` | 资源最后修改时间 | `Last-Modified: Mon, 01 Jan 2024 …` |
| `Access-Control-Allow-Origin` | 允许哪些源跨域 | `Access-Control-Allow-Origin: *` |

**`Content-Type` 是必须说清的头**——它告诉客户端"body 是 HTML、JSON、图片还是别的"，客户端据此决定怎么解析：

| Content-Type | 客户端怎么处理 |
|---|---|
| `text/html; charset=utf-8` | 当网页渲染 |
| `application/json` | 当 JSON 解析 |
| `image/png` | 当图片显示 |
| `application/octet-stream` | 当文件下载 |

**`Set-Cookie` 和 `Cookie` 是一对**：服务器用 `Set-Cookie`（响应头）让浏览器存，浏览器下次请求用 `Cookie`（请求头）带回来。第 06 章详讲。

**在 Node 里设置响应头**：

```js
res.setHeader('Content-Type', 'application/json; charset=utf-8');
res.statusCode = 200;
res.end(JSON.stringify(data));
```

> 一句话记住它：响应头是"服务器给客户端的使用说明"；`Content-Type` 决定 body 怎么解析、`Set-Cookie` 种 cookie、`Location` 重定向、`Cache-Control`/`ETag` 管缓存。

---

## 04.14 Host 头：一个 IP 跑多个网站

**先说结论**：`Host` 头解决了一个现实问题——**一台服务器（一个 IP）上要跑很多个网站**。没有它，服务器根本不知道该把请求交给哪个网站。

**问题的由来**：IP 地址珍贵（第 03 章），不可能每个网站独占一个 IP。于是有了"虚拟主机"（virtual hosting）——一台服务器上，Nginx 按域名分发到不同的网站。但问题来了：客户端连的是 IP，服务器怎么知道客户端想访问哪个网站？

**答案就是 `Host` 头**。HTTP/1.1 规定，请求必须带 `Host` 头，写明"我要访问的域名是哪个"：

```http
GET / HTTP/1.1
Host: www.site-a.com        ← 服务器据此判断"你要的是 A 站"
```

```http
GET / HTTP/1.1
Host: www.site-b.com        ← 同一个 IP，但"你要的是 B 站"
```

**没有 Host 头会怎样？** 很多服务器直接返回 `400 Bad Request`。你在第 01 章手敲的 `GET / HTTP/1.1\r\nHost: example.com\r\n\r\n`，那个 `Host` 就是干这个的。

**用 node:http 验证**：你 `http.request` 时，Node 会自动帮你加 `Host` 头（第 04.4 的输出里就有 `host: 127.0.0.1:62978`）。所以平时你感觉不到它，但它是**必须的**。

**一个真实到好记的现象**：你用 `curl http://127.0.0.1/` 和你直接输域名，服务器收到的 `Host` 头不一样，返回的内容也可能不一样（因为服务器按 Host 分发）。

> 一句话记住它：`Host` 头让"一个 IP 跑多个网站"成为可能；HTTP/1.1 请求必须带它，服务器靠它决定"你要访问哪个站"。

---

## 04.15 本章常见坑速查

| 坑 | 现象 | 原因 | 正确做法 |
|---|---|---|---|
| 发 POST 忘了 `Content-Type` | 服务器解析不出 body | 服务器不知道 body 是什么格式 | 发 JSON 就带 `Content-Type: application/json` |
| 忘了空行分隔头和体 | 服务器一直等 / 解析错 | 头与体之间必须空一行 | 确保 `\r\n\r\n` 分隔 |
| `204` 响应写了 body | 客户端报错/行为异常 | 204 表示"无内容"，不能有 body | 204 就 `res.end()` 不写内容 |
| `req.headers` 按 `Content-Type` 读 | 读到 undefined | Node 把头名统一转小写 | 用 `req.headers['content-type']` |
| 分不清 401 和 403 | 权限逻辑写错 | 401=没登录，403=没权限 | 未认证跳登录(401)，已认证无权限(403) |
| 分不清 502 和 503 | 排查方向错 | 502=上游挂了，503=自己过载/维护 | 502 查上游，503 查自己负载 |
| GET 请求带了大段 body | 服务器可能忽略 | GET 语义不该有 body | 数据放 query string，写操作换 POST |
| 手动发请求漏了 `Host` 头 | 收到 400 | HTTP/1.1 要求必须有 Host | 用 node:http 会自动加，手写别漏 |

---

## 04.16 本章小结

- **HTTP 是应用层文本协议**，跑在 TCP 之上；因为 TCP 可靠，HTTP 敢用纯文本。
- **请求报文** = 请求行（方法+路径+版本）+ 头 + （空行）+ 体。
- **响应报文** = 状态行（版本+状态码+短语）+ 头 + （空行）+ 体。
- **方法**：GET 读、POST 建、PUT 整体替换、PATCH 局部改、DELETE 删、HEAD 只要头。
- **幂等性**：GET/PUT/DELETE 幂等，POST 不幂等——决定能否安全重试。
- **状态码**：2 成功、3 重定向、4 客户错、5 服务器错。
- **301 永久跳、302 临时跳、304 是缓存不是跳转**。
- **401 没登录、403 没权限、404 不存在**；**500 自己崩、502 上游挂、503 过载**。
- **Host 头**让一个 IP 跑多个网站；HTTP/1.1 必须带它。
- **`Content-Type`** 决定 body 怎么解析；`Set-Cookie` 种 cookie、`Location` 重定向。

---

## 04.17 动手练习

**1. 一个 DELETE 请求删除成功，应该返回什么状态码？为什么？**

<details><summary>参考答案</summary>

`204 No Content`。删除成功，没有内容需要返回，204 表示"成功了但没有 body"。注意 204 响应不能写 body。

</details>

**2. 用户没登录访问个人中心，返回 401 还是 403？普通用户访问管理员后台，返回哪个？**

<details><summary>参考答案</summary>

- 没登录访问个人中心 → **401 Unauthorized**（不知道你是谁，先认证）。
- 普通用户访问管理员后台 → **403 Forbidden**（认证了、知道你是谁，但没权限）。

口诀：401 = "你是谁？"，403 = "我知道你，但你不许看"。

</details>

**3. 下面这段代码，客户端 `fetch` 后能正常解析出 JSON 吗？问题在哪？**

```js
const server = http.createServer((req, res) => {
  res.end(JSON.stringify({ ok: true }));
});
```

<details><summary>参考答案</summary>

能拿到 body，但**客户端不会自动把它当 JSON 解析**，因为缺少 `Content-Type: application/json` 头。客户端（如 `fetch().json()`）会按 `text` 处理，或者解析失败。

修法：

```js
res.setHeader('Content-Type', 'application/json; charset=utf-8');
res.end(JSON.stringify({ ok: true }));
```

</details>

**4. Nginx 代理 → Node 服务 → 数据库。分别说出：数据库挂了、Node 服务挂了、Node 服务在发版，各自返回什么状态码？**

<details><summary>参考答案</summary>

- 数据库挂了 → Node 服务抛错 → 返回 **500 Internal Server Error**（Node 自己崩了）。
- Node 服务整个挂了 → Nginx 连不上 → 返回 **502 Bad Gateway**（上游没了）。
- Node 服务在发版/重启 → 主动返回 **503 Service Unavailable**（我还活着，暂时不干活）。

</details>

**5. 为什么 POST 不幂等会导致"重复下单"？怎么解决？**

<details><summary>参考答案</summary>

网络超时后客户端自动重试，`POST /orders` 每次执行都新建一条订单，重试几次就下几单。

解决：用**幂等键**——客户端每次下单请求带一个唯一 `Idempotency-Key`，服务器记住这个 key，收到重复 key 就返回第一次的结果，不重复执行。

</details>

---

> 📖 **本章的代码示例**：`examples/http/04-HTTP报文.mjs`
> 跑一下：`node examples/http/04-HTTP报文.mjs`
>
> 下一章讲 **HTTPS 与 TLS**：HTTP 是明文的，别人能偷看。多出来的那个 `s`，是怎么把你和服务器之间的对话加密起来的。
