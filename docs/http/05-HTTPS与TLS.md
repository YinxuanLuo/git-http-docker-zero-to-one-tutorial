# 第 05 章 · HTTPS 与 TLS：多出来的那个 s 挡住了谁

> 第 04 章你知道 HTTP 是**明文**的——你发的密码、Cookie、聊天内容，在网络上是"裸奔"的，谁路过都能偷看。
> 本章讲怎么把这条明文通道变成加密通道。
>
> 本章你需要记住的就一件事：**HTTPS = HTTP + TLS。TLS 的核心思路是"混合加密"——用非对称加密安全地交换一把对称密钥，之后全程用对称加密传数据。证书的作用是证明"这把公钥真的是服务器的"。**
>
> 这一条想清楚了，你就理解了为什么 HTTPS "既安全又不算太慢"，也理解了为什么自签证书会报警告。

---

## 05.1 为什么 HTTP 需要加个 s

**先说结论**：HTTP 是明文的，中间任何一台路由器、任何一个人，都能**偷看、甚至篡改**你的数据。HTTPS 在 HTTP 和 TCP 之间插了一层 **TLS**（Transport Layer Security，传输层安全），把数据加密后再交给 TCP。

**回顾第 00 章的分层**——HTTPS 之所以能"无痛升级"，正是因为分层：

```text
HTTP（应用层）
  ↓ 数据先经过这里
TLS（加密层）   ← 加进来的这一层
  ↓ 加密后的字节
TCP（传输层）
  ↓
IP / 链路
```

HTTP 还是那个 HTTP，只是在"往下送"之前，先包了一层加密信封。所以你的业务代码几乎不用改——**这就是"分层只跟邻居说话"的直接好处**。

**明文 HTTP 到底有多危险？** 三个具体的威胁：

| 威胁 | 说明 | 后果 |
|---|---|---|
| 窃听 | 中间人偷看你的数据 | 密码、Cookie、聊天记录全泄露 |
| 篡改 | 中间人改你的数据 | 你收到的"转账 100"被改成"转账 10000" |
| 冒充 | 中间人假装是你要连的服务器 | 你以为连的是银行，其实连的是骗子 |

**HTTPS 对应的三件武器：**

| 威胁 | HTTPS 的武器 |
|---|---|
| 窃听 | **加密**（别人看不懂） |
| 篡改 | **完整性校验**（改了能发现） |
| 冒充 | **证书**（证明对方是真的） |

这三样，就是 TLS 干的活。下面逐个拆开。

> 一句话记住它：HTTPS = HTTP + TLS；TLS 解决三件事——加密（防偷看）、完整性（防篡改）、身份验证（防冒充）。

---

## 05.2 对称加密：一把钥匙又锁又开

**先说结论**：对称加密（symmetric encryption）是"**加密和解密用同一把钥匙**"。它快、适合大批量数据，但有个致命问题——**这把钥匙怎么安全地交给对方？**

**用一个生活场景理解**：你要给朋友寄一个上了锁的箱子。你锁上（加密），朋友要打开（解密），必须用**同一把钥匙**。问题来了——你把钥匙寄给他，钥匙在路上的时候，小偷也能拿到。所以对称加密的**核心难题**是"钥匙分发"。

**用 `node:crypto` 亲手跑一遍**（配套示例 `examples/http/05-TLS与HTTPS.mjs` 第 1 节）：

```js
import crypto from 'node:crypto';

const key = crypto.randomBytes(32); // 32 字节 = 256 位的对称密钥

function encrypt(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return { iv, encrypted, authTag: cipher.getAuthTag() };
}
function decrypt({ iv, encrypted, authTag }) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

const box = encrypt('银行卡密码：123456');
console.log(box.encrypted.toString('hex'));          // 一堆看不懂的 hex
console.log(decrypt(box));                            // 解密回来
```

实测输出：

```text
明文      : 银行卡密码：123456
加密后(hex): 70be637d917618462a38268e888fee3f37a9a5fda51b782c
解密回来  : 银行卡密码：123456
```

**注意代码里那个 `authTag`（认证标签）**：AES-GCM 除了加密，还顺带做了**完整性校验**——如果密文被篡改，解密时会抛错，而不是解出一堆乱码。这就是"防篡改"的实现。

**对称加密的优缺点总结：**

| | 说明 |
|---|---|
| 优点 | **快**，适合加密大量数据（视频、文件、网页内容） |
| 缺点 | **钥匙分发难**——钥匙本身要安全送达，成了鸡生蛋问题 |

> 一句话记住它：对称加密一把钥匙又锁又开，快；难题是"钥匙怎么安全交给对方"——这个问题要交给非对称加密解决。

---

## 05.3 非对称加密：公钥加密，私钥解密

**先说结论**：非对称加密用**一对钥匙**——公钥（public key）和私钥（private key）。公钥加密的东西，**只有私钥能解开**；公钥可以随便发，私钥必须藏好。

**核心性质，一句话：公钥加密 → 私钥解密；私钥不能从公钥反推出来。**

**回到寄箱子的场景**：这次你寄一个"**能自动上锁、但只有朋友的钥匙能开**"的箱子。你有个公开的"锁"（公钥），任何人都能用它锁箱子，但只有朋友手里的钥匙（私钥）能开。这样**公钥可以满世界发，不怕被偷**，因为偷到公钥也没用——它只能锁，不能开。

**用 `node:crypto` 跑一遍**（配套示例第 2 节）：

```js
import crypto from 'node:crypto';

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
});

function rsaEncrypt(plaintext, pub) {
  return crypto.publicEncrypt(pub, Buffer.from(plaintext, 'utf8'));
}
function rsaDecrypt(ciphertext, priv) {
  return crypto.privateDecrypt(priv, ciphertext).toString('utf8');
}

const enc = rsaEncrypt('这把对称密钥，请安全收下', publicKey);
console.log(rsaDecrypt(enc, privateKey)); // 只有私钥能解开
```

实测输出：

```text
公钥加密  : 583c57232b08ca030f6ac69c112334628b1078500673e614cdb9b1f625b109c0ee35145c0850e3ef...
私钥解密  : 这把对称密钥，请安全收下
```

**非对称加密的优缺点：**

| | 说明 |
|---|---|
| 优点 | **解决了钥匙分发**——公钥随便发 |
| 缺点 | **慢**（RSA 比 AES 慢几个数量级），不适合加密大数据 |

**于是问题来了**：对称加密"快但分发难"，非对称加密"分发易但慢"。怎么办？——**合起来用**。下一节就是 TLS 的核心思路。

> 一句话记住它：非对称加密用一对钥匙，公钥加密私钥解密；公钥能公开、私钥必须藏；它解决了"钥匙分发"，但慢。

---

## 05.4 混合加密：TLS 的核心思路

**先说结论**：TLS 不傻乎乎地二选一，而是**用非对称加密来"安全地交换"一把对称密钥，之后全程用对称加密传数据**。取两者的长处，避两者的短处。

**完整流程（TLS 握手的简化版）：**

```text
客户端                                    服务器
  │                                         │
  │ ① 生成一把临时的对称密钥 sessionKey        │
  │ ② 用服务器的公钥把 sessionKey 加密，发给服务器 │
  │ ────────── 加密的 sessionKey ────────→    │
  │                                         │ ③ 用自己的私钥解开，拿到 sessionKey
  │                                         │
  │ ④ 双方都有了 sessionKey，之后的对话全用它做对称加密 │
  │ ←────── 加密的业务数据（用 sessionKey） ────→ │
```

**为什么这样最好？** 因为：

- **对称密钥（sessionKey）** 只用了非对称加密（RSA）传了**一次**——就传了那一小段钥匙，慢一点没关系。
- **之后的大批量数据**（网页、图片、JSON）全用对称加密（AES）——快。

配套示例第 4 节就是这段流程的代码实现：

```text
客户端生成的会话密钥 : 5db3128e11db9f168f704506eda317d8...
服务器解出来的密钥   : 5db3128e11db9f168f704506eda317d8...
两把一致              : true
```

**这就是"HTTPS 既安全又不算太慢"的根本原因**——贵的操作（非对称）只干一次，便宜的操作（对称）干一万次。

**这里埋了一个必须马上解决的问题**：客户端怎么知道"服务器的公钥"是**真的**？如果中间人把自己的公钥冒充成服务器的公钥发给你，你拿"假公钥"加密，中间人就能用自己的私钥解开——**整个加密就白费了**。这就是下一节"证书"要解决的问题。

> 一句话记住它：TLS 混合加密 = 非对称加密交换对称密钥 + 对称加密传数据；贵的干一次，便宜的干一万次。

---

## 05.5 证书：怎么证明"公钥是对的"

**先说结论**：证书（certificate）解决的是"**这个公钥到底是不是真的属于 example.com**"。它由一个**大家都信任的第三方（CA，证书颁发机构）**给公钥"盖章背书"。

**回到 05.4 末尾的漏洞**：中间人攻击（MITM）的核心，就是**偷换公钥**。

```text
你                     中间人                    真服务器
 │ 想要真服务器的公钥      │                         │
 │  ←──── 中间人把自己的公钥给你（冒充） ────         │
 │ 用假公钥加密 sessionKey │                         │
 │ ─────→ 中间人用自己的私钥解开，偷看到一切           │
```

**怎么破？** 答案是：**公钥不能裸着给，要带"身份证"**。这个身份证就是证书，它由 **CA（Certificate Authority，证书颁发机构）** 签发，内容是：

```text
证书 = {
  持有者：example.com
  公钥：  （example.com 的公钥）
  签发者：DigiCert（某个 CA）
  有效期：2024-01-01 ~ 2025-01-01
  签名：  （CA 用自己的私钥对这个证书做的数字签名）
}
```

**证书怎么防伪造？** 靠**数字签名**：

1. CA 用自己的**私钥**，对证书内容做签名（"我证明这个公钥是 example.com 的"）。
2. 客户端（浏览器）**内置了各大 CA 的公钥**，用 CA 的公钥去**验签**。
3. 如果签名验证通过，说明这个证书**确实是 CA 签发的**，里面的公钥就是真的。

**关键链条**：浏览器信任 CA → CA 信任 example.com 的公钥 → 所以你信任 example.com 的公钥。这叫**信任链（chain of trust）**。

**看一个真实证书长什么样**（你的浏览器地址栏点小锁就能看）：

```text
颁发给：www.example.com
颁发者：DigiCert TLS RSA SHA256 2020 CA1
有效期：2023-01-01 至 2024-01-01
指纹： 一串 hash
```

> 一句话记住它：证书 = CA 给"公钥"盖的章；浏览器内置 CA 的公钥来验签，验签通过就相信"这个公钥是真的"，从而破解中间人偷换公钥。

---

## 05.6 数字签名与证书链：信任是怎么传递的

**先说结论**：证书不是孤立的，它们组成一条**链**——从你的证书，一路追到根 CA。浏览器逐级验签，最终信任到"根"，这条链才算通。

**为什么需要链？** 因为 CA 也分很多级。一个 CA（比如根 CA）不可能直接给全世界每个网站签证书，那样它的私钥泄露就全完蛋。所以分了层级：

```text
根 CA（Root CA）        ← 浏览器内置信任，私钥锁在保险柜里
   │ 签发
中间 CA（Intermediate） ← 根 CA 授权它去签
   │ 签发
你的网站证书（Leaf）     ← 你网站的域名 + 公钥
```

**浏览器验证证书的完整流程：**

```text
1. 拿到你的网站证书（Leaf），看到"签发者：中间 CA"
2. 用中间 CA 的公钥，验证 Leaf 的签名
3. 再看中间 CA 的证书，看到"签发者：根 CA"
4. 用根 CA 的公钥（浏览器内置），验证中间 CA 的签名
5. 验证通过 → 信任成立
```

**每一步都在验证"上一级的签名"**，一直追到浏览器内置信任的根，整条链就通了。

**数字签名的原理，用 `node:crypto` 跑一遍**（配套示例第 3 节）：

```js
import crypto from 'node:crypto';

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });

const doc = '转账 100 元给张三';
// 用私钥对消息的哈希签名（别人没有私钥，伪造不了）
const sign = crypto.sign('sha256', Buffer.from(doc), privateKey);
// 验证方用公钥验签
const ok = crypto.verify('sha256', Buffer.from(doc), publicKey, sign);
const tampered = crypto.verify('sha256', Buffer.from('转账 1000 元给张三'), publicKey, sign);
console.log('原消息验签  :', ok);       // true
console.log('篡改后验签  :', tampered); // false
```

实测输出：

```text
原消息验签    : true （通过）
被篡改后验签  : false （失败 = 篡改被发现了）
```

**这就是"防篡改"的数学原理**：签名绑定了"内容和私钥"，内容改一个字，验签就失败。

> 一句话记住它：证书链 = Leaf → 中间 CA → 根 CA，逐级验签；浏览器内置根 CA 的公钥，信任沿着链传下来。

---

## 05.7 TLS 握手：从简到繁的完整过程

**先说结论**：TLS 握手（handshake）是客户端和服务器在真正传数据前，**协商出一把双方共享的对称密钥**的过程。现代 TLS 1.3 把它压缩到了约 1 个往返（1-RTT）。

**完整握手（TLS 1.2，经典四步）：**

```text
客户端                                      服务器
  │ ① ClientHello（我支持的加密套件、随机数 R1）──→ │
  │                                           │
  │ ← ② ServerHello（选定的套件、随机数 R2）+ 证书 ← │
  │                                           │
  │ ③ 用证书里的公钥加密一个 pre-master 秘密，发过去 → │
  │                                           │ ④ 双方用 R1+R2+pre-master 算出对称密钥
  │                 （握手完成，开始对称加密通信）       │
```

**这个握手干了三件事：**

1. **协商加密套件**：双方商量"用哪个加密算法"（比如 AES-256-GCM）。
2. **交换随机数**：双方各给一个随机数，最后合成对称密钥（增加随机性，防重放）。
3. **验证身份**：服务器把证书发给客户端，客户端验证"这真的是我要连的服务器"。

**TLS 1.3 的改进**：把握手压缩到 **1-RTT**（一个往返就完成），还引入了 0-RTT 恢复（重连时不用重新握手）。所以现代 HTTPS 其实比很多人以为的快。

**对你写代码的意义**：TLS 握手全部在 `node:https` / `node:tls` 里**自动完成**。你只需提供证书（服务器）或选择信任策略（客户端），握手细节完全不用管——这又是"站在内核/库的肩膀上"。

> 一句话记住它：TLS 握手 = 协商加密算法 + 交换随机数 + 验证证书，最终产出双方共享的对称密钥；TLS 1.3 把它压到 1 个往返。

---

## 05.8 用 node:https 起一个 HTTPS 服务

**先说结论**：`node:https` 的用法和 `node:http` 几乎一样，唯一区别是**要先有证书和私钥**。生成自签证书后，就能起一个 HTTPS 服务。

**第一步：生成自签证书。** 用 `openssl` 命令（这是系统工具，不是第三方依赖）：

```bash
# 生成私钥 + 自签证书（一条命令，有效期 365 天）
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout key.pem -out cert.pem \
  -days 365 -subj "/CN=localhost"
```

这条命令会生成两个文件：`cert.pem`（证书）和 `key.pem`（私钥）。

**第二步：用 `node:https` 起服务：**

```js
import https from 'node:https';
import fs from 'node:fs';

const server = https.createServer(
  {
    key: fs.readFileSync('key.pem'),   // 私钥
    cert: fs.readFileSync('cert.pem'), // 证书
  },
  (req, res) => {
    res.end('这是 HTTPS 加密通道里的响应');
  },
);

server.listen(8443, () => {
  console.log('HTTPS 服务跑在 https://localhost:8443');
});
```

**第三步：客户端访问。** 用浏览器访问 `https://localhost:8443`，会看到**安全警告**——因为你的证书是**自签的**，没有任何 CA 给它背书。

```text
你的连接不是私密连接
NET::ERR_CERT_AUTHORITY_INVALID
```

**这个警告恰恰是证书机制在工作的证明**：浏览器没法验证你的证书是真的，所以提醒你"这个公钥我没法确认属于谁"。生产环境用 CA 签的证书，就不会有这个警告。

**用 Node 客户端连自签 HTTPS**：默认也会报证书错误，因为 Node 也不信任自签证书。想连，得**显式告诉 Node "我信任这个自签证书"**（仅测试用，生产别这么干）：

```js
import https from 'node:https';

const req = https.request({
  host: 'localhost',
  port: 8443,
  path: '/',
  // 测试环境：忽略证书验证（⚠ 生产环境绝不能这样，等于把加密的门关了）
  rejectUnauthorized: false,
}, (res) => {
  res.on('data', (d) => console.log(d.toString()));
});
req.end();
```

> 一句话记住它：`node:https` 用法同 `node:http`，只需多传 `key` 和 `cert`；自签证书会触发 `ERR_CERT_AUTHORITY_INVALID` 警告——这恰恰说明证书校验在工作。

---

## 05.9 本章常见坑速查

| 坑 | 现象 | 原因 | 正确做法 |
|---|---|---|---|
| 自签证书被浏览器拒绝 | `NET::ERR_CERT_AUTHORITY_INVALID` | 自签证书没有 CA 背书 | 生产用 CA 签的证书；测试可手动信任 |
| Node 客户端连自签 HTTPS 报错 | `self-signed certificate` | Node 默认验证证书 | 测试设 `rejectUnauthorized: false`（生产禁用） |
| 证书过期 | 浏览器报"证书已过期" | 证书有有效期 | 续期证书，别让过期 |
| 私钥泄露 | 攻击者能解密所有流量 | 私钥被公开 | 私钥严格保密，泄露立即重签证书 |
| 混用 http 和 https | 页面资源加载失败 | 混合内容（https 页面加载 http 资源） | 全部资源走 https |
| 证书域名不匹配 | 警告"证书和域名不符" | 证书签给 A 域名，却用在 B 域名 | 为正确域名申请证书 |

---

## 05.10 本章小结

- **HTTPS = HTTP + TLS**；TLS 解决三件事：加密、完整性、身份验证。
- **对称加密**一把钥匙又锁又开，快，但钥匙分发难。
- **非对称加密**公钥加密私钥解密，解决分发，但慢。
- **混合加密**：非对称加密交换对称密钥，之后全程对称加密——HTTPS 的核心思路。
- **证书** = CA 给公钥盖章；浏览器内置 CA 公钥验签，破解中间人偷换公钥。
- **证书链** = Leaf → 中间 CA → 根 CA，逐级验签。
- **数字签名**：私钥签名、公钥验签，内容改一个字验签就失败（防篡改）。
- **TLS 握手** = 协商算法 + 交换随机数 + 验证证书，产出对称密钥；TLS 1.3 只需 1-RTT。
- **`node:https`** 用法同 `node:http`，多传 `key` + `cert`；自签证书触发 `ERR_CERT_AUTHORITY_INVALID`。

---

## 05.11 动手练习

**1. 为什么 HTTPS 用"混合加密"而不是纯非对称加密或纯对称加密？**

<details><summary>参考答案</summary>

- 纯对称加密：快，但"钥匙怎么安全交给对方"解决不了。
- 纯非对称加密：能安全分发，但太慢，加密大量数据不现实。
- 混合加密：用非对称加密安全地交换一把对称密钥（只干一次、慢点无妨），之后全程用对称加密传数据（快）。取两者长处。

</details>

**2. 证书到底解决了什么问题？没有证书，中间人能怎么攻击？**

<details><summary>参考答案</summary>

证书解决"**这个公钥是不是真的属于目标服务器**"的身份问题。没有证书，中间人可以把**自己的公钥冒充成服务器的公钥**发给客户端，客户端用它加密会话密钥，中间人用自己的私钥解开，就能偷看到所有"加密"的数据——整个加密就白费了（中间人攻击）。

</details>

**3. 浏览器内置了什么，使得它能验证证书？自签证书为什么会被拒绝？**

<details><summary>参考答案</summary>

浏览器内置了**各大根 CA 的公钥**。验证证书时，浏览器沿着证书链（Leaf → 中间 CA → 根 CA）逐级验签，最终用内置的根 CA 公钥验证通过，就信任这条链。

自签证书没有任何 CA 背书（它不是任何 CA 签发的），浏览器没法验证它的签名，所以报 `NET::ERR_CERT_AUTHORITY_INVALID`。

</details>

**4. 下面代码有什么问题？**

```js
import https from 'node:https';

https.request({ host: 'example.com', path: '/' }, (res) => {
  res.on('data', (d) => console.log(d.toString()));
}).end();
```

<details><summary>参考答案</summary>

代码本身没大问题，但注意 `https.request` 默认端口是 **443**，而 `example.com` 走的就是 443，所以能连。真正的坑在于：**生产环境不要随便加 `rejectUnauthorized: false`**——那等于关闭了证书验证，把加密的门开了，任何人都能冒充服务器。测试自签证书时才临时用。

</details>

**5. 用一句话说清 TLS 握手在干什么。**

<details><summary>参考答案</summary>

TLS 握手是客户端和服务器在传数据前，**协商加密算法、交换随机数、验证服务器证书**，最终产出一把双方共享的对称密钥，之后的数据都用这把密钥加密传输。

</details>

---

> 📖 **本章的代码示例**：`examples/http/05-TLS与HTTPS.mjs`
> 跑一下：`node examples/http/05-TLS与HTTPS.mjs`
>
> 下一章讲**缓存与 Cookie**：怎么让"重复访问"变快（缓存），以及"无状态的 HTTP"怎么记住你是谁（Cookie/Session）。
