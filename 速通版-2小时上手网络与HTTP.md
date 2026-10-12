# 速通版 · 2 小时上手网络与 HTTP

> 这是「网络与 HTTP 从零到一」的**压缩版**。完整版有 12 章（`docs/http/00` ~ `11`），这个速通版把核心抽出来，2 小时带你走完主线。
>
> **适合你，如果**：明天面试、今天想快速建立网络心智模型、或者只想先跑起来。
> **不适合你，如果**：想彻底搞懂每个细节——那去读完整版。
>
> 全程只用一个工具：**Node.js 22 内置模块**。零依赖，每段代码都能 `node xxx.mjs` 跑。

---

## 怎么用这 2 小时

| 时间段 | 内容 | 目标 |
|---|---|---|
| 第 1 段（30 min） | 网络分层 + TCP 连接 | 建起"分层"心智模型，亲手跑一条 TCP 连接 |
| 第 2 段（30 min） | TCP 可靠传输 + IP/DNS | 理解"可靠"怎么来的、"域名怎么变 IP" |
| 第 3 段（30 min） | HTTP 报文 + 方法 + 状态码 | 亲眼看报文，背下方法和状态码 |
| 第 4 段（30 min） | HTTPS + 缓存 + HTTP2 | 理解加密、缓存、多路复用 |
| 第 5 段（30 min） | 从零写服务器 + 速查 | 动手写完整服务器，复习速查表 |

**配套示例**都在 `examples/http/` 下，每段结束跑一个，比看十遍都管用。

---

## 第 1 段：网络分层与 TCP 连接（30 分钟）

### 1.1 一句话记住网络

**网络不是"一根管子"，是"层层外包"**——每一层只解决一个问题、只跟上下相邻的两层打交道。

```text
应用层（HTTP/DNS）   "我要表达什么业务"
   ↓
传输层（TCP/UDP）    "怎么可靠地送到"
   ↓
网络层（IP）         "怎么找到那一台机器"
   ↓
链路层（以太网/Wi-Fi） "相邻设备间传比特"
```

**分层给你的最大好处**：你写 HTTP 代码，完全不用知道数据是怎么在光缆里编码的；换 Wi-Fi 不影响你浏览器里的 HTTP。**每一层独立演进。**

### 1.2 亲手建一条 TCP 连接

```js
import net from 'node:net';

const server = net.createServer((socket) => {
  socket.on('data', (data) => {
    console.log('收到:', data.toString('utf8'));
    socket.write('收到，你好！');
    socket.end();
  });
});

server.listen(0, '127.0.0.1', () => {
  const client = net.createConnection({ host: '127.0.0.1', port: server.address().port }, () => {
    client.write('你好服务器');
  });
  client.on('data', (d) => console.log('回:', d.toString('utf8')));
  client.on('close', () => server.close(() => console.log('退出')));
});
```

**跑一下**（完整版在 `examples/http/01-TCP连接与封装.mjs`）：

```bash
node examples/http/01-TCP连接与封装.mjs
```

**三个必须记住的点：**

1. **端口**：0~65535 的整数，是"程序的门牌号"。一条连接由 `（源IP，源端口，目标IP，目标端口）` 四元组唯一确定。
2. **`socket.on('data')` 拿到的是 Buffer（字节）**，`toString('utf8')` 才解出文本——这就是"封装/解封装"的现场。
3. **TCP 是字节流，没有消息边界**：你 write 3 次，对方可能 1 次 data 就全收到。

> 一句话：**分层 = 层层外包；端口 = 程序门牌；data 拿到的是字节不是字符串。**

---

## 第 2 段：TCP 可靠传输 + IP/DNS（30 分钟）

### 2.1 TCP 凭什么可靠

**IP 层是"尽力而为"**——会丢、会乱、会重复。TCP 在它之上用**四件套**硬造出可靠：

| 机制 | 解决什么 |
|---|---|
| 序列号（按字节编号） | 基础，唯一标识每个字节 |
| 确认号（期待的下一个字节） | 知道"哪些到了、哪些没到" |
| 超时重传 + 快速重传 | 丢了能发现、能补 |
| 校验和 | 损坏了能发现 |

**一句话**：丢包靠"没等到确认"，乱序靠"序号排序"，重复靠"序号去重"。

### 2.2 三次握手、四次挥手

```text
三次握手（建立）：  四次挥手（断开）：
SYN →                FIN →
← SYN+ACK            ← ACK
ACK →                ← FIN
                     ACK →
```

- **三次**：交换初始序列号 + 双向确认"我能发、你能收"。
- **四次**：TCP 双向，两个方向各自关，所以比握手多一次。

**Node 里你能看到的**：`connect` 成功 = 握手完成；`end` 事件 = 收到 FIN（半关闭）；`close` 事件 = 挥手完成。

### 2.3 IP 与 DNS

**IP 定位机器，端口定位程序，DNS 把名字翻译成 IP。**

- **子网掩码**：把 IP 切成"网络号 + 主机号"。网络号相同 → 同一网段 → 可直连；不同 → 过路由器。
- **公网 IP 全球唯一，内网 IP 可重复**（`192.168.x.x`）。内网靠路由器 NAT 出网——这就是"别人连不进你本地服务"的原因。
- **DNS**：分层的"电话本"，把 `example.com` 翻译成 IP。
- **hosts 文件**：本地的 DNS，优先级高于 DNS。

```js
import dns from 'node:dns/promises';
import net from 'node:net';

const r = await dns.lookup('localhost');
console.log(r);                        // 可能 { address: '::1', family: 6 }
console.log(net.isIP('127.0.0.1'));    // 4（IPv4）
console.log(net.isIP('::1'));          // 6（IPv6）
```

**两个必须分清的报错**：

| 错误码 | 含义 | 出在哪层 |
|---|---|---|
| `ENOTFOUND` | 域名查不到 | DNS 层 |
| `ECONNREFUSED` | 端口没人监听 | TCP 层 |

> 一句话：**TCP 可靠靠"序号+确认+重传"；IP 定位机器、DNS 翻译名字、端口定位程序。**

---

## 第 3 段：HTTP 报文、方法与状态码（30 分钟）

### 3.1 HTTP 报文长什么样

**HTTP 是跑在 TCP 上的纯文本协议**。报文 = 起始行 + 头 + （空行）+ 体。

```http
POST /api/user HTTP/1.1          ← 请求行（方法 + 路径 + 版本）
Host: example.com                ← 请求头
Content-Type: application/json
Content-Length: 26
                                 ← 空行
{"name":"小明","age":18}         ← 消息体
```

```http
HTTP/1.1 200 OK                  ← 状态行（版本 + 状态码 + 短语）
Content-Type: text/plain
Content-Length: 60
                                 ← 空行
收到你的 POST                     ← 消息体
```

**亲眼看报文**：

```bash
node examples/http/04-HTTP报文.mjs
```

### 3.2 方法：六件套

| 方法 | 语义 | 幂等 |
|---|---|---|
| GET | 读 | 是 |
| POST | 建 | **否** |
| PUT | 整体改 | 是 |
| PATCH | 局部改 | 不一定 |
| DELETE | 删 | 是 |
| HEAD | 只要头 | 是 |

**幂等 = 执行 1 次和 100 次结果一样**，决定"能不能放心重试"。POST 不幂等，重试会重复下单。

### 3.3 状态码：看百位数

| 分类 | 含义 | 常见 |
|---|---|---|
| 2xx | 成功 | 200、201（建）、204（删） |
| 3xx | 重定向 | 301（永久）、302（临时）、**304（缓存）** |
| 4xx | 客户端错 | 400、401（没登录）、403（没权限）、404 |
| 5xx | 服务器错 | 500（自己崩）、502（上游挂）、503（过载） |

**几个高频混淆点**：

- `301` 永久 vs `302` 临时；`304` 不是跳转是缓存。
- `401` = "你是谁？"（没登录），`403` = "我知道你但你不许看"（没权限）。
- `500` = 自己崩，`502` = 上游挂，`503` = 过载/维护。

> 一句话：**报文 = 起始行 + 头 + 体；方法六件套；状态码看百位数：2 成功 3 重定向 4 客户错 5 服务器错。**

---

## 第 4 段：HTTPS、缓存、HTTP/2（30 分钟）

### 4.1 HTTPS：多出来的 s 挡住了谁

**HTTP 是明文，谁都能偷看。HTTPS = HTTP + TLS**，解决三件事：

| 威胁 | 武器 |
|---|---|
| 窃听 | 加密 |
| 篡改 | 完整性校验 |
| 冒充 | 证书 |

**核心思路：混合加密。**

```text
① 用非对称加密（RSA）安全地交换一把对称密钥
② 之后全程用对称加密（AES）传数据
```

- 对称加密快但"钥匙分发难"，非对称加密慢但能安全分发——**合起来用，取长补短**。
- **证书** = CA 给公钥盖章，证明"这公钥真的是服务器的"，防中间人偷换公钥。

**亲手跑加密**：

```bash
node examples/http/05-TLS与HTTPS.mjs
```

### 4.2 缓存：让重复访问变快

**两级缓存：**

```text
① 强缓存（Cache-Control: max-age=60）→ 60 秒内不发请求，直接用本地
② 协商缓存（ETag / Last-Modified）→ 过期后带凭证问"变了没"
   没变 → 304（省 body）
   变了 → 200 + 新内容
```

**两个混淆点**：`no-cache` 是"每次先问"，`no-store` 才是"不缓存"；ETag 精确到内容，比 Last-Modified（精确到秒）可靠。

### 4.3 HTTP/2 和 HTTP/3

**核心线索：队头阻塞（前面慢的堵住后面所有）。**

| | 传输层 | 队头阻塞 |
|---|---|---|
| HTTP/1.1 | TCP | 应用层有（请求排队） |
| HTTP/2 | TCP | 应用层解决，TCP 层还有 |
| HTTP/3 | **UDP（QUIC）** | 基本根治（流独立） |

- **HTTP/2**：多路复用（帧 + 流 ID，一条连接并行多个请求）+ 头部压缩。
- **HTTP/3**：换掉 TCP，用基于 UDP 的 QUIC，在用户态自己实现可靠性和"流独立"。

**亲眼对比队头阻塞 vs 多路复用**：

```bash
node examples/http/07-HTTP2与QUIC.mjs
```

> 一句话：**HTTPS 用混合加密 + 证书；缓存分强/协商两级；HTTP 演进就是一路跟"队头阻塞"作斗争。**

---

## 第 5 段：从零写服务器 + 速查（30 分钟）

### 5.1 一个 HTTP 服务器的骨架

**服务器 = 解析请求行（方法+路径）→ 路由分发 → 读 body → 构造响应。**

```js
import http from 'node:http';

function sendJSON(res, code, data) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

http.createServer(async (req, res) => {
  const { method } = req;
  const [path] = req.url.split('?'); // 去掉 query string

  if (method === 'GET' && path === '/api/users') {
    sendJSON(res, 200, [{ id: 1, name: '小明' }]);
  } else {
    sendJSON(res, 404, { error: 'Not Found' });
  }
}).listen(3000, () => console.log('跑在 http://localhost:3000'));
```

**完整版（路由 + 静态文件 + JSON + 兜底）**：

```bash
node examples/http/09-完整HTTP服务器.mjs
```

### 5.2 三个工程化铁律

1. **返回 JSON 必设 `Content-Type: application/json`**——否则客户端解析不出。
2. **返回 404 兜底 + try/catch 返回 500**——服务器对任何请求都要"有响应"。
3. **写完必测**——用内置 `fetch` 自测所有端点。

### 5.3 最终速查表

**方法**：GET 读 / POST 建 / PUT 整体改 / PATCH 局部改 / DELETE 删 / HEAD 只要头。

**状态码**：200 成功、201 建、204 删、301 永久跳、302 临时跳、304 缓存、400 格式错、401 没登录、403 没权限、404 不存在、500 自己崩、502 上游挂、503 过载。

**报错码**：`ECONNREFUSED` 端口没人听、`ENOTFOUND` 域名查不到、`ETIMEDOUT` 超时、`ECONNRESET` 对端重置、`EADDRINUSE` 端口被占。

**缓存头**：`Cache-Control: max-age=60` 强缓存、`ETag`/`Last-Modified` 协商、`no-cache` 每次先问、`no-store` 不缓存。

**Cookie 安全**：`HttpOnly` 防 XSS、`Secure` 防窃听、`SameSite` 防 CSRF。

**HTTPS**：非对称换对称 + 证书防中间人。

**HTTP 演进**：1.1 请求排队 → 2 多路复用（解决应用层）→ 3 换 QUIC（解决传输层）。

---

## 2 小时结束，你该能回答这 5 个问题

1. 从输入 URL 到页面显示，发生了什么？（DNS → TCP → HTTP → 渲染）
2. TCP 怎么保证可靠？（序号 + 确认 + 重传）
3. GET 和 POST 的区别？（读 vs 写、URL vs body、幂等 vs 不幂等）
4. 401 和 403 的区别？（没登录 vs 没权限）
5. HTTPS 为什么安全？（混合加密 + 证书）

**答不上来？** 回到对应的段落再读一遍，或者去完整版 `docs/http/` 找对应章节深挖。

**想检验自己？** 做 [第 10 章测试题](docs/http/10-测试题与答案.md)，五关全过才算真懂了。

> 一句话：**网络是分层的，TCP 是可靠的，HTTP 是文本的，HTTPS 是加密的——这四句吃透，网络与 HTTP 你就入门了。**
