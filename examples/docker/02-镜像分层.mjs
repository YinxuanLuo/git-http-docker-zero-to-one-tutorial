/**
 * 02 章 · 镜像分层演示（纯 Node 内置模块，零依赖）
 *
 * 演示三件 Docker 镜像机制背后的事：
 *   1. 内容寻址：层的 digest 由"内容"算出来，内容一样 digest 就一样（可复用）
 *   2. 分层：每个镜像由一串只读层叠起来，上一层覆盖下一层
 *   3. 层缓存：只有"内容变了"的层才需要重新构建
 *
 * 运行：node examples/docker/02-镜像分层.mjs
 */

import { createHash } from 'node:crypto';

// ---- 1. 内容寻址：digest = sha256(内容) ----
// Docker 给每一层算一个 sha256 摘要，作为它的"身份证"。
// 内容相同 → 摘要相同 → 层可以直接复用，不用重新下载/构建。
console.log('==================== 1. 内容寻址 ====================');
const sha256 = (s) => createHash('sha256').update(s).digest('hex');

const layerA = 'echo hello';
const layerB = 'echo hello';   // 和 A 一模一样
const layerC = 'echo HELLO';   // 只改了一个字符

console.log('layerA 内容:', JSON.stringify(layerA));
console.log('layerA digest:', sha256(layerA).slice(0, 16) + '…');
console.log('layerB 内容:', JSON.stringify(layerB));
console.log('layerB digest:', sha256(layerB).slice(0, 16) + '…');
console.log('layerA 与 layerB 相同吗?', sha256(layerA) === sha256(layerB) ? '是 → 层可复用' : '否');
console.log('layerC 内容:', JSON.stringify(layerC));
console.log('layerC digest:', sha256(layerC).slice(0, 16) + '…');
console.log('layerA 与 layerC 相同吗?', sha256(layerA) === sha256(layerC) ? '是' : '否 → 内容一变，digest 全变');

// ---- 2. 分层：一串只读层，上一层覆盖下一层 ----
console.log('\n==================== 2. 分层（UnionFS 覆盖语义） ====================');
// 一个镜像 = 从底到顶的一串只读层。
// 底层放基础系统，顶层放你的应用代码。上下层有同名文件时，上层"盖住"下层。
function buildImage(layers) {
  // 模拟 UnionFS：从底层往上合并文件系统，后出现的同名文件覆盖前面的
  const fs = {};
  for (const layer of layers) {
    for (const [path, content] of Object.entries(layer)) {
      fs[path] = content;   // 上层覆盖下层
    }
  }
  return fs;
}

const baseLayer = { '/etc/os-release': 'debian:12', '/app/config.json': '{"port": 8080}' };
const depsLayer = { '/app/node_modules/left-pad': 'x', '/app/config.json': '{"port": 3000}' };  // 覆盖了 config
const appLayer = { '/app/server.js': 'console.log("hi")' };

const merged = buildImage([baseLayer, depsLayer, appLayer]);
console.log('合并后的文件系统视图（上层覆盖下层）：');
for (const [p, c] of Object.entries(merged)) {
  console.log('  ' + p.padEnd(32) + ' = ' + c);
}
console.log('注意 /app/config.json 被 depsLayer 覆盖了：', merged['/app/config.json']);

// ---- 3. 层缓存：只有"变了"的层才重建 ----
console.log('\n==================== 3. 层缓存（build 缓存失效） ====================');
// Docker build 时按顺序执行指令，每条指令产生一层。
// 如果某条指令的"输入"没变（指令内容 + 上一层 digest 都没变），就直接用缓存层，不再执行。
function buildSteps(steps) {
  let prevDigest = 'scratch';   // 起始于空
  const log = [];
  for (const step of steps) {
    const input = prevDigest + '|' + step.cmd;
    const digest = sha256(input).slice(0, 12);
    log.push({ cmd: step.cmd, cacheHit: step.cached ? 'CACHED' : 'RUN ', digest });
    prevDigest = digest;
  }
  return log;
}

const firstBuild = [
  { cmd: 'FROM node:22' },
  { cmd: 'COPY package.json .' },
  { cmd: 'RUN npm install' },
  { cmd: 'COPY . .' },
];
console.log('第一次构建（全部 RUN）：');
for (const l of buildSteps(firstBuild)) {
  console.log('  [' + l.cacheHit + '] ' + l.digest + '  ' + l.cmd);
}

const secondBuild = [
  { cmd: 'FROM node:22', cached: true },
  { cmd: 'COPY package.json .', cached: true },
  { cmd: 'RUN npm install', cached: true },
  { cmd: 'COPY . .' },   // 源码变了，从这层开始全部重跑
];
console.log('第二次构建（改了源码，前 3 层命中缓存）：');
for (const l of buildSteps(secondBuild)) {
  console.log('  [' + l.cacheHit + '] ' + l.digest + '  ' + l.cmd);
}

console.log('\n==================== 小结 ====================');
console.log('镜像 = 一串只读层叠起来；层 = 内容寻址（sha256）；');
console.log('内容没变的层直接复用缓存，内容变了的层及它上面所有层都要重建。');
