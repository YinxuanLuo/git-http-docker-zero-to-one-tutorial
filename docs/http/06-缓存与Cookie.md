# 第 06 章 · 缓存与 Cookie：让 HTTP "变快"和"记住你"

> 前几章你知道了 HTTP 是无状态的纯文本协议。这一章解决两个由此而来的问题：
> 一是**重复访问怎么变快**（缓存），二是**无状态怎么记住你是谁**（Cookie/Session）。
>
> 本章你需要记住的就一件事：**缓存分两种——强缓存（Cache-Control，不发请求直接用本地）和协商缓存（ETag/Last-Modified，发请求但可能只回 304）；Cookie 是服务器存在浏览器里的"小纸条"，让无状态的 HTTP 有了"记忆"。**
>
> 这一条想清楚了，你就能解释"为什么刷新页面变快了""为什么登录后刷新还在登录态""为什么跨域会失败"。

---

## 06.1 为什么要有缓存

**先说结论**：缓存解决的是"**同样的东西，别重复传**"。你第一次访问一个网站，下载了 logo、CSS、JS；刷新一次，如果这些**根本没变**，为什么要再传一遍？——缓存就是让浏览器记住"我下载过了，没变就别再发"。

**没有缓存的世界**：每次访问都重新下载所有资源，慢、费流量、服务器压力大。

**缓存能省下多少？** 看一个典型网页：logo、样式表、脚本、图片，这些资源**长时间不变**，却占了页面大部分体积。缓存住它们，第二次访问只需要下载"变了的部分"（比如最新的数据），体验天差地别。

**缓存发生在三个地方**：

| 位置 | 谁在用 | 说明 |
|---|---|---|
| 浏览器缓存 | 你自己的浏览器 | 你二次访问时直接用本地 |
| 代理/CDN 缓存 | 中间的服务器 | 离用户近的节点先缓存一份 |
| 服务器缓存 | 服务器自己 | 数据库查询结果先存内存 |

这一章重点讲**浏览器缓存**，因为它由 HTTP 的缓存头直接控制，是你写代码时能掌控的。

**缓存靠谁控制？** 靠两个响应头：**`Cache-Control`**（强缓存）和 **`ETag`/`Last-Modified`**（协商缓存）。下面逐个讲。

> 一句话记住它：缓存让"没变的东西别重传"；浏览器缓存由 `Cache-Control`、`ETag`、`Last-Modified` 这几个头控制。

---

## 06.2 强缓存：Cache-Control

**先说结论**：强缓存（strong cache）的意思是——"**这个资源，N 秒内直接用的本地缓存，别来问我**"。控制它的是 `Cache-Control` 响应头。

**最常用的写法：**

```http
Cache-Control: max-age=60
```

意思是"这个资源，60 秒内都有效，浏览器直接用本地缓存，**一个请求都不发**"。

**`Cache-Control` 的几个关键值：**

| 值 | 含义 |
|---|---|
| `max-age=60` | 60 秒内直接用缓存 |
| `no-cache` | **每次都要问服务器**（但不是"不缓存"，是"缓存但每次先确认"） |
| `no-store` | **完全不缓存**（隐私数据用） |
| `public` | 可以被任何缓存（含 CDN）存 |
| `private` | 只能被浏览器私有缓存存（含用户信息的响应用） |

**`no-cache` 和 `no-store` 的区别，是经典混淆点：**

| | 含义 | 会缓存吗 | 会问服务器吗 |
|---|---|---|---|
| `no-cache` | 缓存，但**每次用前先问服务器**"变了没" | 会 | **每次** |
| `no-store` | **完全禁止缓存** | 不会 | 每次重新拿 |

很多人以为 `no-cache` 是"不缓存"，**恰恰相反**——它是"缓存，但每次都要协商"。真正"不缓存"的是 `no-store`。

**强缓存生效时的标志**：你打开浏览器开发者工具（F12），Network 面板里，走强缓存的资源会显示"`(from disk cache)`"或"`(from memory cache)`"，而且**没有网络请求**。

> 一句话记住它：`Cache-Control: max-age=60` 是"60 秒内别来问我"；`no-cache` 是"每次先问"、`no-store` 是"压根别存"。

---

## 06.3 协商缓存：ETag 与 If-None-Match

**先说结论**：强缓存"过期"后，浏览器不确定资源变没变，就带着一个"上次的版本标识"（ETag）去问服务器"变了没"。没变，服务器回 **304**，浏览器继续用本地缓存；变了，回 200 和新内容。这就是协商缓存。

**ETag 是什么？** ETag 是服务器给资源打的"**版本指纹**"——一个能代表当前内容版本的字符串（通常是内容哈希）。内容变了，ETag 就变。

**完整流程：**

```text
第一次请求 /etag：
  服务器返回：200 + body + ETag: "v1"
  浏览器记住：ETag = "v1"

第二次请求 /etag（缓存过期了）：
  浏览器带着：If-None-Match: "v1"  ← 问"我手里的 v1 变了吗？"
  服务器比对：
    没变 → 返回 304（"没变，用你的缓存吧"），不带 body
    变了 → 返回 200 + 新 body + 新 ETag
```

**用 `node:http` 亲手演示**（配套示例 `examples/http/06-缓存与Cookie.mjs`，核心代码）：

```js
const ETAG = '"v1"';

if (req.headers['if-none-match'] === ETAG) {
  res.statusCode = 304; // 内容没变，用缓存
  res.end();
} else {
  res.setHeader('ETag', ETAG);
  res.end('这是 ETag 资源，内容固定');
}
```

实测输出：

```text
== 第 1 次请求 /etag（没有缓存） ==
  -> 200 OK（首次，带上 ETag 和 Cache-Control）
[client] 状态码 200，ETag="v1"

== 第 2 次请求 /etag（带上 If-None-Match） ==
  -> 304 Not Modified（ETag 命中，内容没变）
[client] 状态码 304（304 表示"没变，用你本地缓存吧"）
```

**304 的意义**：它告诉客户端"内容没变"，所以**响应不带 body**（省流量）。客户端收到 304，就继续用本地缓存。所以协商缓存"发了请求，但省了 body 的流量"。

**ETag 的两种常见生成方式**：内容哈希（精确但费一点计算）、版本号（简单但内容变不一定更新版本号）。**内容哈希更可靠**，因为只要字节变了，哈希必变。

> 一句话记住它：ETag 是"版本指纹"；缓存过期后浏览器带 `If-None-Match` 问"变了没"，没变回 304（省 body），变了回 200。

---

## 06.4 协商缓存（另一种）：Last-Modified 与 If-Modified-Since

**先说结论**：除了 ETag（版本指纹），还有一种协商缓存——`Last-Modified`，它用"**最后修改时间**"代替"版本指纹"。原理一样：带个时间问服务器"这个时间之后改过吗？"

**完整流程：**

```text
第一次请求 /lm：
  服务器返回：200 + body + Last-Modified: Mon, 01 Jan 2024 00:00:00 GMT

第二次请求 /lm：
  浏览器带着：If-Modified-Since: Mon, 01 Jan 2024 00:00:00 GMT
  服务器比对：
    之后没改 → 304
    之后改了 → 200 + 新内容 + 新 Last-Modified
```

配套示例里同样有：

```js
const LAST_MODIFIED = new Date('2024-01-01T00:00:00Z').toUTCString();

if (req.headers['if-modified-since'] === LAST_MODIFIED) {
  res.statusCode = 304;
  res.end();
} else {
  res.setHeader('Last-Modified', LAST_MODIFIED);
  res.end('这是 Last-Modified 资源');
}
```

**ETag 和 Last-Modified 谁更好？**

| | ETag | Last-Modified |
|---|---|---|
| 精度 | **精确到内容**（内容变，哈希变） | 精确到**秒** |
| 缺点 | 计算哈希有点开销 | 1 秒内改多次检测不到 |
| 适用 | 现代主流，**优先用 ETag** | 简单场景 |

**一个真实到要记住的坑**：`Last-Modified` 只能精确到**秒**。如果你在 1 秒内改了两次文件，`Last-Modified` 可能没变，导致缓存没失效。所以现代实践是**优先 ETag**，Last-Modified 作为兜底。

> 一句话记住它：Last-Modified 用"最后修改时间"做协商，精确到秒；ETag 精确到内容，更可靠，优先用 ETag。

---

## 06.5 强缓存 vs 协商缓存：一张表分清

**先说结论**：强缓存和协商缓存是**两级**，可以配合使用。判断顺序是：先看强缓存过期没，过期了才走协商缓存。

**完整决策流程：**

```text
浏览器要加载一个资源
   ↓
① 强缓存：Cache-Control 的 max-age 没过期？
   是 → 直接用本地缓存，不发请求
   否 → 往下走
   ↓
② 协商缓存：带 ETag/Last-Modified 问服务器
   304 → 用本地缓存（省 body）
   200 → 用新内容
```

**一张表总结：**

| | 强缓存 | 协商缓存 |
|---|---|---|
| 控制头 | `Cache-Control: max-age` | `ETag` / `Last-Modified` |
| 发请求吗 | **不发** | 发（但可能只回 304） |
| 省什么 | 省整个请求 | 省 body 的流量 |
| 触发时机 | max-age 没过期 | max-age 过期后 |

**两者配合的标准做法**：

```js
res.setHeader('Cache-Control', 'public, max-age=60'); // 先强缓存 60 秒
res.setHeader('ETag', '"v1"');                        // 过期后再协商
```

**这样设计的原因**：强缓存"最快但不精确"（60 秒内可能内容变了也不知道），协商缓存"精确但每次要问"。配合起来，就是"60 秒内爽快用缓存，过期后再精确确认"。

> 一句话记住它：先强缓存（max-age 内不发请求），过期再协商（带 ETag 问，304 就省 body）——两级配合，又快又准。

---

## 06.6 Cookie：无状态的 HTTP 怎么记住你

**先说结论**：HTTP 是**无状态**的——每次请求都是独立的，服务器"忘了"你上一秒是谁。Cookie 是服务器存在浏览器里的**一小段文本**，浏览器每次请求自动带上它，从而让服务器"认出你"。

**为什么 HTTP 无状态是个问题？** 因为"登录"这件事要求服务器记住"你是谁"。但 HTTP 协议本身没有"记忆"——你第一次请求登录、第二次请求看个人信息，两次请求对服务器来说没有任何关联。

**Cookie 的机制（一个完整的闭环）：**

```text
① 浏览器登录 → 服务器验证通过
② 服务器响应：Set-Cookie: sid=abc123   ← 让浏览器"记住这个凭证"
③ 浏览器存下 sid=abc123
④ 之后每次请求，浏览器自动带上：Cookie: sid=abc123
⑤ 服务器看到 sid=abc123，认出"哦，是上次登录的那个人"
```

**两个核心头，一进一出：**

| 头 | 方向 | 作用 |
|---|---|---|
| `Set-Cookie` | 服务器 → 浏览器 | 让浏览器存 cookie |
| `Cookie` | 浏览器 → 服务器 | 浏览器自动带上已存的 cookie |

**用 `node:http` 演示**（配套示例第 4 部分）：

```js
// 服务器种 cookie
res.setHeader('Set-Cookie', 'sid=abc123; HttpOnly; Path=/; Max-Age=3600');
res.end('登录成功，已种下 cookie: sid=abc123');

// 下次请求，浏览器自动带上
// 服务器 req.headers.cookie === 'sid=abc123'
```

实测输出：

```text
== 请求 /login，观察 Set-Cookie ==
  -> 200 OK（Set-Cookie: sid=abc123）
[client] 状态码 200，Set-Cookie=sid=abc123; HttpOnly; Path=/; Max-Age=3600

== 再次请求 /login，浏览器会自动带上 Cookie ==
  -> 200 OK（Set-Cookie: sid=abc123）
[client] 状态码 200，服务端看到了 Cookie: sid=abc123
```

> 一句话记住它：HTTP 无状态，Cookie 让它有"记忆"；服务器 `Set-Cookie` 种、浏览器 `Cookie` 带，一进一出，就是"登录状态"的实现基础。

---

## 06.7 Cookie 的关键属性

**先说结论**：`Set-Cookie` 不只是一句 `key=value`，后面还跟着一串**属性**，控制 cookie 的安全性、作用域、有效期。这几个属性是面试和实战的高频点。

**完整的 Set-Cookie 长这样：**

```http
Set-Cookie: sid=abc123; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=3600
```

**逐个属性拆开：**

| 属性 | 作用 | 不写会怎样 |
|---|---|---|
| `HttpOnly` | **JS 读不到** cookie | 能被 JS 读，XSS 可偷走 |
| `Secure` | 只在 **HTTPS** 下传输 | 明文 HTTP 也会发，可被窃听 |
| `SameSite` | 跨站请求**不带上** | 容易被 CSRF 攻击 |
| `Path` | 限定作用路径 | 全站都能用 |
| `Domain` | 限定作用域名 | 只当前域名 |
| `Max-Age` / `Expires` | 有效期 | 关闭浏览器就没了（会话 cookie） |

**三个安全属性是重点：**

**`HttpOnly`：防 XSS 偷 cookie。**

```text
没有 HttpOnly → document.cookie 能读到 sid=abc123 → 有 XSS 漏洞时被偷
有 HttpOnly   → document.cookie 读不到 sid → XSS 偷不走登录凭证
```

**`Secure`：防明文传输被窃听。** 没加 `Secure`，即使网站是 HTTPS，cookie 也可能在 HTTP 请求里明文发出去，被中间人截获。

**`SameSite`：防 CSRF。** CSRF 攻击是"骗子网站偷偷带着你的 cookie 发起请求"。`SameSite` 限制了 cookie 在跨站请求里不被带上，从根上堵住这类攻击：

| SameSite 值 | 行为 |
|---|---|
| `Strict` | 任何跨站都不带（最严） |
| `Lax` | 跨站的 GET（如点击链接）可以带，POST 不带（平衡） |
| `None` | 跨站也带（需配合 `Secure`） |

> 一句话记住它：`HttpOnly` 防 XSS 偷、`Secure` 防窃听、`SameSite` 防 CSRF；这三个是 cookie 安全的铁三角。

---

## 06.8 Session：服务器端的状态

**先说结论**：Cookie 本身只是"小纸条"，**真正的用户数据存在服务器端**，叫 Session。Cookie 里只存一个"凭证"（session id），服务器拿着这个 id 去查对应的数据。

**为什么要分 Cookie 和 Session？** 因为：

1. Cookie 存在**浏览器**里，用户能改、能被偷，**不可信**。不能把"用户余额""权限"这些敏感数据直接放 cookie。
2. Cookie 有大小限制（约 4KB），存不下太多数据。

**所以正确做法是"Cookie 存凭证，Session 存数据"：**

```text
浏览器                          服务器
  │                               │
  │ 登录                           │
  │ ───────→ 验证通过             │
  │ ←── Set-Cookie: sid=abc123 ── │ 同时在服务器内存/Redis 存：
  │                               │   { abc123: { userId: 1, name: '小明' } }
  │ 之后请求带 sid=abc123          │
  │ ───────→                      │ 用 abc123 查出 userId: 1，识别用户
```

**Session 的存储**：可以放内存（简单但重启丢失、多台服务器不共享）、放 Redis（生产标配，重启不丢、多服务器共享）、放数据库。

**一个必须澄清的误区**：很多人以为"登录状态 = Cookie"，其实完整的链是 **Cookie（存 id）→ Session（存数据）**。Cookie 只是"钥匙"，Session 才是"房间里的东西"。

**用代码感受这个模式：**

```js
// 简化版 session（生产用 Redis）
const sessions = new Map(); // sessionId -> 用户数据

// 登录
sessions.set('abc123', { userId: 1, name: '小明' });
res.setHeader('Set-Cookie', 'sid=abc123; HttpOnly');

// 之后的请求
const sid = req.headers.cookie?.match(/sid=([^;]+)/)?.[1];
const user = sessions.get(sid); // 用 sid 查出用户
```

> 一句话记住它：Cookie 存"凭证"（不可信、有大小限制），Session 存"数据"（在服务器端）；Cookie 是钥匙，Session 是房间里的东西。

---

## 06.9 同源策略的直觉

**先说结论**：同源策略（Same-Origin Policy）是浏览器的一条**安全铁律**——**一个网页里的 JS，只能访问"同源"的数据**。不同源的请求，浏览器会拦下（除非服务器明确允许跨域）。

**什么是"同源"？** 三个东西完全一样，才算同源：

```text
源 = 协议 + 域名 + 端口
```

| 例子 | 是否同源 | 为什么 |
|---|---|---|
| `https://a.com` vs `https://a.com/b` | ✅ 同源 | 协议、域名、端口都一样（路径不算） |
| `https://a.com` vs `http://a.com` | ❌ | 协议不同 |
| `https://a.com` vs `https://b.com` | ❌ | 域名不同 |
| `https://a.com:443` vs `https://a.com:8443` | ❌ | 端口不同 |

**为什么要有同源策略？** 想象你登录了银行网站（`bank.com`），Cookie 里存着登录凭证。这时你打开了另一个网站 `evil.com`。如果没有同源策略，`evil.com` 的 JS 就能：

```js
// evil.com 里的恶意代码
fetch('https://bank.com/transfer', { method: 'POST', body: '给骗子转 10000' });
// 浏览器会自动带上你的 bank.com Cookie → 钱被转走了
```

**同源策略就是拦这个的**：`evil.com` 的 JS 想请求 `bank.com`，浏览器发现"不同源"，直接拦住。

**那合法的跨域怎么办？** 用 **CORS（跨域资源共享）**——服务器在响应里加头，明确说"我允许某某源来访问"：

```js
res.setHeader('Access-Control-Allow-Origin', 'https://my-app.com');
// 或允许所有源
res.setHeader('Access-Control-Allow-Origin', '*');
```

**一个高频面试题**：为什么浏览器有同源策略，但服务器之间（curl、Node）没有？——因为同源策略是**浏览器**的规则，保护的是"浏览器里的用户"。curl 和 Node 不是浏览器，不受它约束。

> 一句话记住它：同源 = 协议+域名+端口全相同；同源策略是浏览器的安全铁律，防止恶意网站偷你登录状态发请求；合法跨域用 CORS 头放行。

---

## 06.10 本章常见坑速查

| 坑 | 现象 | 原因 | 正确做法 |
|---|---|---|---|
| 以为 `no-cache` 是不缓存 | 缓存策略理解错 | `no-cache` 是"缓存但每次先问"，`no-store` 才是"不缓存" | 分清 no-cache / no-store |
| 改了文件但浏览器还显示旧的 | 强缓存没过期 | `max-age` 还没到，浏览器不发请求 | 给资源加版本号/哈希，或调短 max-age |
| 只配了 ETag，没配 Cache-Control | 每次都要问服务器 | 没有强缓存兜底 | 两者配合：先强缓存，再协商 |
| cookie 被 JS 读走 | 登录凭证泄露 | 没加 `HttpOnly` | 敏感 cookie 加 `HttpOnly` |
| 明文 HTTP 传了 cookie | cookie 被窃听 | 没加 `Secure` | 敏感 cookie 加 `Secure` |
| 跨域请求失败 | 浏览器报 CORS 错误 | 服务器没放行跨域 | 加 `Access-Control-Allow-Origin` |
| 把敏感数据直接存 cookie | 用户能改、能被偷 | cookie 存在浏览器，不可信 | cookie 只存凭证，数据存 Session |
| 跨站请求被偷偷带上 cookie | CSRF 攻击 | cookie 没加 `SameSite` | 加 `SameSite=Lax/Strict` |

---

## 06.11 本章小结

- **缓存让"没变的东西别重传"**，分强缓存和协商缓存两级。
- **强缓存** `Cache-Control: max-age=60`：60 秒内不发请求，直接用本地。
- **协商缓存** `ETag`/`Last-Modified`：带凭证问服务器，没变回 304 省 body。
- **`no-cache`** 是"缓存但每次先问"，**`no-store`** 才是"不缓存"。
- **ETag 精确到内容**，比 Last-Modified（精确到秒）更可靠。
- **HTTP 无状态**，Cookie 让它有记忆：服务器 `Set-Cookie` 种、浏览器 `Cookie` 带。
- **Cookie 三安全属性**：`HttpOnly` 防 XSS、`Secure` 防窃听、`SameSite` 防 CSRF。
- **Cookie 存凭证，Session 存数据**；Cookie 是钥匙，Session 是房间。
- **同源策略**（协议+域名+端口全相同）是浏览器安全铁律；合法跨域用 CORS。

---

## 06.12 动手练习

**1. `Cache-Control: no-cache` 和 `no-store` 有什么区别？**

<details><summary>参考答案</summary>

- `no-cache`：**缓存**，但每次用前先问服务器"变了没"（走协商缓存）。
- `no-store`：**完全不缓存**，每次重新拿。

很多人误以为 `no-cache` 是"不缓存"，实际它是"缓存但每次先确认"。

</details>

**2. 第一次请求拿到 `ETag: "v1"`，第二次请求服务器回 304，浏览器会做什么？**

<details><summary>参考答案</summary>

浏览器收到 304（Not Modified），知道"内容没变"，就**继续使用本地缓存的内容**，不会下载新的 body。所以 304 的响应不带 body，省了流量。

</details>

**3. 登录后刷新页面还在登录态，背后的完整机制是什么？**

<details><summary>参考答案</summary>

登录时服务器验证通过，用 `Set-Cookie` 让浏览器存一个 `sid`（session id），同时在服务器端把用户数据存进 Session（`sid → 用户`）。之后每次请求浏览器自动带 `Cookie: sid=...`，服务器用它查出用户，就知道"这个人登录过"。

</details>

**4. 为什么要把用户数据放 Session 而不是直接放 Cookie？**

<details><summary>参考答案</summary>

因为 Cookie 存在**浏览器**里，用户能改、能被 XSS 偷，**不可信**；而且 Cookie 有约 4KB 的大小限制。所以敏感数据（余额、权限）放服务器端 Session，Cookie 里只放一个不可猜测的凭证（session id）。

</details>

**5. 你在 `evil.com` 页面里写 `fetch('https://bank.com/api')`，会发生什么？为什么？**

<details><summary>参考答案</summary>

会被浏览器**拦下**，报 CORS 错误。因为 `evil.com` 和 `bank.com` 不同源（域名不同），违反同源策略。除非 `bank.com` 的服务器明确加了 `Access-Control-Allow-Origin` 头放行。

同源策略正是为了防止恶意网站偷用你已登录的 cookie 去发请求。

</details>

---

> 📖 **本章的代码示例**：`examples/http/06-缓存与Cookie.mjs`
> 跑一下：`node examples/http/06-缓存与Cookie.mjs`
>
> 下一章讲 **HTTP/1.1 → HTTP/2 → HTTP/3**：队头阻塞、多路复用、头部压缩、QUIC——HTTP 是怎么一步步变快的。
