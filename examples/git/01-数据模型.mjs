// 对应章节：01；运行：node examples/git/01-数据模型.mjs
//
// 第 01 章 · 环境与心智模型：Git 到底往 .git 里写了什么。
//   1. 对象是"内容寻址"的：对象名 = 内容的 SHA-1 哈希
//   2. blob 对象 = "blob <字节长度>\0<内容>"，同样的内容哈希一样（自动去重）
//   3. tree 对象 = 目录清单，commit 对象 = 指向 tree + 父 commit + 元信息
//   4. 用 node:crypto 手算哈希，和真实 git 命令的输出对拍
//
// 本文件零依赖，只用 Node 内置模块。最后一段用真实 git 命令验证（若装了 git）。

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const line = (t) => console.log('\n--- ' + t + ' ---');
const sha1 = (buf) => createHash('sha1').update(buf).digest('hex');

// ---------------------------------------------------------------
// 1. blob 对象的哈希：内容寻址的本质
// ---------------------------------------------------------------
//
// Git 里"一个文件的内容"被存成一个 blob 对象。它的名字（哈希）不是随机给的，
// 而是"blob <字节长度>\0<内容>"这串字节的 SHA-1。所以：
//   - 同样的内容 → 同样的哈希 → 只存一份（自动去重）
//   - 改一个字节 → 哈希完全不同（天然校验）

function blobHash(content) {
  const body = Buffer.from(content, 'utf8');
  const header = Buffer.from(`blob ${body.length}\0`, 'utf8');
  return sha1(Buffer.concat([header, body]));
}

line('1. 手算 blob 哈希（内容寻址）');
console.log("内容 'hello\n' 的 blob 哈希 =", blobHash('hello\n'));
console.log("内容 'hello\n' 再算一次   =", blobHash('hello\n'), '（相同内容 → 相同哈希）');
console.log("内容 'Hello\n'（改一个大写）=", blobHash('Hello\n'), '（改一字节 → 完全不同）');

// ---------------------------------------------------------------
// 2. 去重：两个不同文件名、相同内容，底层只有一个 blob
// ---------------------------------------------------------------
line('2. 内容相同 → 自动去重');

const sameA = blobHash('same content here\n');
const sameB = blobHash('same content here\n');
console.log('a.txt 内容 =', JSON.stringify('same content here\n'), '→', sameA);
console.log('b.md  内容 =', JSON.stringify('same content here\n'), '→', sameB);
console.log('两个文件哈希一样吗？', sameA === sameB, '→ Git 底层只存一个 blob 对象');

// ---------------------------------------------------------------
// 3. 对象大小：字节长度 vs 字符长度（中文要小心）
// ---------------------------------------------------------------
line('3. 字节长度，不是字符长度');

const cn = '你好';
console.log("'你好' 的字符数 =", cn.length, '，字节数 =', Buffer.byteLength(cn, 'utf8'));
console.log('blob 头部用的长度是字节数 →', `blob ${Buffer.byteLength(cn, 'utf8')}\\0`);

// ---------------------------------------------------------------
// 4. 模拟 tree 与 commit 对象（用哈希把它们串起来）
// ---------------------------------------------------------------
//
// tree = 一个目录的清单：每条是 "文件模式 类型 哈希\t文件名"
// commit = 指向一棵 tree + 指向父 commit + 作者/时间/说明
// 三者靠哈希互相引用，串成一张网 —— 这就是第 00 章说的"对象数据库"。

line('4. 用哈希把 blob → tree → commit 串成网');

const blob = blobHash('hello from git model\n');
const treeEntry = `100644 blob ${blob}\tmessage.txt`;
const tree = sha1(Buffer.from(`tree ${Buffer.byteLength(treeEntry)}\0${treeEntry}`, 'utf8'));

console.log('blob  (文件内容) =', blob);
console.log('tree  (目录清单) =', tree, `\n  内部一条记录：[${treeEntry}]`);

const author = 'Tutor <t@example.com>';
const timestamp = 1700000000;
const commitBody = `tree ${tree}\nauthor ${author} ${timestamp} +0800\ncommitter ${author} ${timestamp} +0800\n\nfirst commit\n`;
const commit = sha1(Buffer.from(`commit ${Buffer.byteLength(commitBody)}\0${commitBody}`, 'utf8'));
console.log('commit（快照节点） =', commit);
console.log('\n三者关系：commit ──tree──> tree ──blob──> blob（内容）');
console.log('这就是为什么：commit 的哈希一变，说明它引用的东西一定被动过。');

// ---------------------------------------------------------------
// 5. 和真实 git 对拍（若装了 git）
// ---------------------------------------------------------------
line('5. 与真实 git 命令对拍');

function hasGit() {
  try {
    execFileSync('git', ['--version'], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

if (!hasGit()) {
  console.log('（本机未检测到 git，跳过真实对拍。上面 1~4 节的哈希已演示完整数据模型。）');
} else {
  const dir = mkdtempSync(join(tmpdir(), 'git-model-'));
  try {
    writeFileSync(join(dir, 'message.txt'), 'hello from git model\n', 'utf8');
    // git hash-object 不加 -w 只算哈希不写对象，正好用来对拍
    const real = execFileSync('git', ['hash-object', 'message.txt'], {
      cwd: dir,
      encoding: 'utf8',
    }).trim();
    console.log('git hash-object 算出的真实哈希 =', real);
    console.log('我们手算的 blob 哈希          =', blob);
    console.log('两者一致吗？', real === blob, '→ 手算的就是 git 内部算法');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------
// 小结
// ---------------------------------------------------------------
line('小结');
console.log('1) Git 的对象是内容寻址的：对象名 = 内容的 SHA-1 哈希。');
console.log('2) blob = "blob <字节长度>\\0<内容>"；同样内容哈希一样，自动去重。');
console.log('3) tree 存目录清单，commit 存 tree + 父 commit + 元信息。');
console.log('4) 哈希串成一张网：commit → tree → blob，任一环改动都会让上层哈希变。');
