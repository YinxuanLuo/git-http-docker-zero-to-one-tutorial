/**
 * 第 05 章配套示例 · 对称加密、非对称加密与"TLS 握手直觉"
 *
 * 用 node:crypto 亲手跑一遍加密的三种原料，理解 HTTPS 为什么安全：
 *  1. 对称加密（AES-GCM）：一把钥匙又锁又开，快，但"钥匙怎么安全交给对方"是难题
 *  2. 非对称加密（RSA）：公钥加密、私钥解密，慢，但能安全交换钥匙
 *  3. 数字签名 / 哈希：验证"这条消息没被篡改"
 *  4. 把上面拼起来 = TLS 握手的直觉：用非对称加密交换一把对称密钥，之后全用对称加密
 *
 * 运行：node 05-TLS与HTTPS.mjs
 * 全程只用 node:crypto，零第三方依赖，进程自然退出。
 */

import crypto from 'node:crypto';

console.log('===== 1. 对称加密（AES-256-GCM）：一把钥匙又锁又开 =====');

const symmetricKey = crypto.randomBytes(32); // 256 位的对称密钥
function aesEncrypt(plaintext, key) {
  const iv = crypto.randomBytes(12); // GCM 需要的随机初始向量
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag(); // 认证标签，防篡改
  return { iv, encrypted, authTag };
}
function aesDecrypt({ iv, encrypted, authTag }, key) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

const secret = '银行卡密码：123456';
const box = aesEncrypt(secret, symmetricKey);
console.log('明文      :', secret);
console.log('加密后(hex):', box.encrypted.toString('hex'));
console.log('解密回来  :', aesDecrypt(box, symmetricKey));
console.log('');

console.log('===== 2. 非对称加密（RSA）：公钥加密，私钥解密 =====');

// 生成一对密钥。公钥可以公开，私钥必须藏好。
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
});

function rsaEncrypt(plaintext, pub) {
  return crypto.publicEncrypt(pub, Buffer.from(plaintext, 'utf8'));
}
function rsaDecrypt(ciphertext, priv) {
  return crypto.privateDecrypt(priv, ciphertext).toString('utf8');
}

const msg = '这把对称密钥，请安全收下';
const enc = rsaEncrypt(msg, publicKey);
console.log('公钥加密  :', enc.toString('hex').slice(0, 80) + '...');
console.log('私钥解密  :', rsaDecrypt(enc, privateKey));
console.log('');

console.log('===== 3. 数字签名：证明"消息来自我、且没被改" =====');

const doc = '转账 100 元给张三';
// 用私钥对消息的哈希签名（别人只有公钥，伪造不了签名）
const sign = crypto.sign('sha256', Buffer.from(doc), privateKey);
// 验证方用公钥验签
const ok = crypto.verify('sha256', Buffer.from(doc), publicKey, sign);
const tampered = crypto.verify('sha256', Buffer.from('转账 1000 元给张三'), publicKey, sign);
console.log('原消息验签    :', ok, '（通过）');
console.log('被篡改后验签  :', tampered, '（失败 = 篡改被发现了）');
console.log('');

console.log('===== 4. TLS 握手直觉：非对称换对称，之后全程对称 =====');

// 真实 TLS 握手（简化的思路）：
//   1. 客户端：生成一把"临时对称密钥" sessionKey
//   2. 客户端：用服务器的公钥把 sessionKey 加密，发给服务器
//   3. 服务器：用私钥解出 sessionKey
//   4. 双方：之后所有数据都用 sessionKey 做对称加密（快）
// 证书在这里的作用是：证明"这把公钥确实是服务器的"，防止中间人偷换公钥。

const sessionKey = crypto.randomBytes(32); // 客户端生成的对称密钥
const wrappedKey = rsaEncrypt(sessionKey.toString('hex'), publicKey); // 用公钥"包裹"
const unwrappedKey = rsaDecrypt(wrappedKey, privateKey); // 服务器用私钥解开

console.log('客户端生成的会话密钥 :', sessionKey.toString('hex').slice(0, 32) + '...');
console.log('服务器解出来的密钥   :', unwrappedKey.slice(0, 32) + '...');
console.log('两把一致              :', sessionKey.toString('hex') === unwrappedKey);
console.log('');
console.log('之后，双方就用这把对称密钥通信（回到第 1 步的 AES）：');
const shared = aesEncrypt('HTTPS 的正式通信内容', Buffer.from(unwrappedKey, 'hex'));
console.log('用会话密钥加密传输  :', shared.encrypted.toString('hex').slice(0, 60) + '...');
console.log('');
console.log('结论：非对称加密只干"交换钥匙"这件慢活，大批量数据走对称加密（快）。');
console.log('这是 HTTPS "既安全又不太慢"的根本原因。');
